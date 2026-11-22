import {readMidi,prepareMidi,convertPitchedToCsv,drumEventPreview,preciseDurationText} from './midi-core.mjs';
import {convertDrumsToCsv,readProfile} from './drum-schema.mjs';
const $=id=>document.getElementById(id);
const controls=['source-part','target-track','song-title','tempo-bpm','total-measures'];
const HOST_READY='symphonycsv:midi:host-ready';
const IMPORT_REQUEST='symphonycsv:midi:import-request';
const IMPORT_RESULT='symphonycsv:midi:import-result';
const profiles={5:'/docs/drum-mappings/Step104_MuldjordKit_LABS_Profile_v01.csv',
  6:'/docs/drum-mappings/Step104_SynthesizerPercussion_LABS_Profile_v01.csv'};
let midi=null,csv=null,url=null,hostReady=false,importPending=false,requestedTrack=1;
let confirmedNonPercussion=false,confirmedMixed=false,conversionPending=false;
const isDrum=()=>[5,6].includes(Number($('target-track').value));
const setStatus=(message,kind='')=>{
 $('status').textContent=message;$('status').className='status '+kind;
 if(window.parent!==window)window.parent.postMessage({type:'symphonycsv:midi:status',message,kind},window.location.origin);
};
function invalidate(){csv=null;$('download').hidden=true;$('download').removeAttribute('href');
 if(url){URL.revokeObjectURL(url);url=null;} $('drum-results').hidden=true;render();}
function updateDirectButton(){const allowed=[1,2,5,6].includes(Number($('target-track').value));
 $('import-direct').disabled=!hostReady || !csv || importPending || !allowed;
 $('import-direct').title=hostReady?'Load through the existing Studio Rust/WASM importer':'Open this workspace from Studio to import directly';}
function setLoadedFeedback(file=null){
 const zone=$('drop-zone');
 zone.classList.toggle('loaded',Boolean(file));
 if(!file){
   $('drop-title').textContent='♫ Drop your .mid or .midi file here';
   $('drop-detail').textContent='or click to choose a local file · Standard MIDI Format 0/1 · PPQ timing';
   zone.setAttribute('aria-label','Choose a MIDI file');
 }else{
   $('drop-title').textContent='✓ MIDI file loaded · '+file.name;
   $('drop-detail').textContent=`${midi.notes.length} notes · ${midi.suggestedMeasures} measures · Click here to choose a different MIDI file`;
   zone.setAttribute('aria-label','MIDI loaded: '+file.name+'. Click to choose another file.');
 }
}
function updatePartHint(){
 $('part-hint').textContent=isDrum()
 ? 'Drum mapping uses the selected bundled kit. Channel 10 is conventional GM percussion; other notes require confirmation.'
 : 'Piano Roll merges selected MIDI notes into one Studio SoundFont; original MIDI program sounds are not retained.';
}
function reset(){midi=null;confirmedNonPercussion=false;confirmedMixed=false;setLoadedFeedback();$('filename').textContent='Nothing leaves your computer.';invalidate();$('source-facts').hidden=true;
 $('reduction-warning').hidden=true;$('musical-metrics').hidden=true;$('source-part').replaceChildren();
 $('warnings').replaceChildren();$('routing-advice').hidden=true;for(const id of controls)$(id).disabled=true;$('meter').disabled=true;}
function facts(element,values){element.replaceChildren(...values.map(([caption,value])=>{const box=document.createElement('div');box.className='metric';
 const a=document.createElement('span');a.textContent=caption;const b=document.createElement('strong');b.textContent=String(value);
 box.append(a,b);return box;}));element.hidden=false;}
function addOption(value,label){const o=document.createElement('option');o.value=value;o.textContent=label;$('source-part').append(o);}
function selectDefaultSource(){if(!midi)return;const ch10=midi.notes.filter(n=>n.channel===9);
 $('source-part').value=isDrum()?(ch10.length?'__ALL_PERCUSSION__':(midi.parts[0]?.key||'')):'__ALL_NOTES__';
 confirmedNonPercussion=false;confirmedMixed=false;}
function warningText(){
 $('warnings').replaceChildren();
 for(const msg of midi?.warnings||[]){const d=document.createElement('div');d.textContent='⚠ '+msg;$('warnings').append(d);}
 if(midi?.tempoChanges||midi?.meterChanges||midi?.notePairErrors||midi?.denominator!==4){
   const d=document.createElement('div');d.textContent='Conversion blocked: this LABS engine requires constant tempo, constant quarter-note-based meter, and paired MIDI note events.';
   $('warnings').append(d);
 }
}
function routingAdvice(){const elem=$('routing-advice');elem.hidden=true;
 if(!midi||!isDrum())return;
 const select=$('source-part').value;
 const selected=select==='__ALL_PERCUSSION__'?midi.notes.filter(n=>n.channel===9):midi.notes.filter(n=>n.track+':'+n.channel===select);
 const nonGM=selected.some(n=>n.channel!==9);
 const excluded=midi.notes.length-selected.length;
 if(nonGM){elem.hidden=false;$('routing-message').textContent=
   `This MIDI source does not use standard percussion channel 10. It may be pitched music. Drum interpretation is blocked unless you explicitly approve General MIDI drum mapping. No notes will be silently converted to drums.`;
   $('route-one').hidden=false;$('route-two').hidden=false;$('route-confirm').hidden=confirmedNonPercussion;
   $('route-confirm').textContent='Interpret selected notes as GM drums';
 }else if(excluded>0){elem.hidden=false;
   $('routing-message').textContent=`Mixed MIDI detected: ${selected.length} channel-10 percussion notes selected; ${excluded} other MIDI notes will NOT be imported into this drum track. Confirm this deliberate selection.`;
   $('route-one').hidden=false;$('route-two').hidden=false;$('route-confirm').hidden=confirmedMixed;
   $('route-confirm').textContent='Use percussion notes only';
 }else{
   $('route-one').hidden=true;$('route-two').hidden=true;$('route-confirm').hidden=true;
 }
}
function render(){updatePartHint();if(!midi){$('convert').disabled=true;updateDirectButton();return;}
 const bpm=Number($('tempo-bpm').value),measures=Number($('total-measures').value);
 const okay=Number.isFinite(bpm)&&bpm>=1&&bpm<=1000&&Number.isInteger(measures)&&measures>0&&measures<=100000;
 const duration=okay?measures*midi.numerator*4/midi.denominator*60/bpm:0;
 facts($('musical-metrics'),[['PPQ',midi.ppq],['Source end · notes',`${midi.noteMeasures} measures`],
   ['Declared end',okay?measures:'—'],['Musical duration',okay?preciseDurationText(duration):'—']]);
 const dr=isDrum(),select=$('source-part').value;
 $('staff-rule').hidden=dr;
 $('reduction-warning').hidden=dr||select!=='__ALL_NOTES__';
 $('convert').textContent=dr?'Convert percussion to Drums CSV':
   select==='__ALL_NOTES__'?'Convert all notes to one Piano Roll CSV':'Convert to SymphonyCSV';
 const selected=select==='__ALL_PERCUSSION__'?midi.notes.filter(n=>n.channel===9):
   select==='__ALL_NOTES__'?midi.notes:midi.notes.filter(n=>n.track+':'+n.channel===select);
 const ambiguous=dr && selected.some(n=>n.channel!==9) && !confirmedNonPercussion;
 const mixed=dr && selected.every(n=>n.channel===9) && selected.length<midi.notes.length && !confirmedMixed;
 $('convert').disabled=conversionPending||!okay||midi.tempoChanges||midi.meterChanges||midi.notePairErrors||midi.denominator!==4||!selected.length||ambiguous||mixed||(dr&&select==='__ALL_NOTES__');
 routingAdvice();updateDirectButton();
}
async function openFile(file){if(!file||conversionPending)return;
 const destination=midi?Number($('target-track').value):requestedTrack;reset();
 try{if(!/\.midi?$/i.test(file.name))throw Error('Choose a .mid or .midi file.');
   if(file.size>30_000_000)throw Error('MIDI files must be 30 MB or less.');
   midi=readMidi(await file.arrayBuffer());
   $('filename').textContent=`${file.name} · ${Intl.NumberFormat().format(file.size)} bytes`;
   facts($('source-facts'),[['Format',midi.format],['Tracks',midi.trackCount],['Notes',midi.notes.length],['Proposed measures',midi.suggestedMeasures]]);
   addOption('__ALL_NOTES__',`All MIDI notes · ${midi.notes.length} (one Piano Roll instrument)`);
   const perc=midi.notes.filter(n=>n.channel===9);
   if(perc.length)addOption('__ALL_PERCUSSION__',`All channel 10 percussion notes · ${perc.length}`);
   for(const p of midi.parts)addOption(p.key,`${p.displayName} · ${p.noteCount} notes`);
   $('target-track').value=String(destination);selectDefaultSource();
   $('song-title').value=file.name.replace(/\.midi?$/i,'').replace(/_/g,' ').slice(0,120);
   $('tempo-bpm').value=Number(midi.tempoBpm.toFixed(6));
   $('total-measures').value=midi.suggestedMeasures;$('meter').value=midi.timeSignature;
   $('tempo-origin').textContent=midi.tempoSource;$('meter-origin').textContent=midi.meterSource;
   for(const id of controls)$(id).disabled=false;$('meter').disabled=false;
   warningText();render();setLoadedFeedback(file);
   setStatus('MIDI loaded and analyzed. Review source notes, BPM, and full measures before conversion.','good');
 }catch(e){reset();setStatus(e?.message||String(e),'bad');}
}
window.addEventListener('message',event=>{
 if(event.source!==window.parent || event.origin!==window.location.origin || !event.data || typeof event.data!=='object')return;
 if(event.data.type===HOST_READY){hostReady=true;requestedTrack=[1,2,5,6].includes(event.data.slot)?event.data.slot:1;
   $('target-track').value=String(requestedTrack);if(midi){selectDefaultSource();invalidate();}
   if(event.data.file)void openFile(event.data.file);else render();
 }else if(event.data.type===IMPORT_RESULT){importPending=false;
   setStatus(event.data.message||(event.data.ok?'Imported into Studio.':'Studio rejected the CSV.'),event.data.ok?'good':'bad');updateDirectButton();}
});
$('midi-file').addEventListener('change',e=>{void openFile(e.target.files?.[0]);e.target.value='';});
const drop=$('drop-zone');
drop.addEventListener('dragover',e=>{e.preventDefault();drop.classList.add('active');});
drop.addEventListener('dragleave',()=>drop.classList.remove('active'));
drop.addEventListener('drop',e=>{e.preventDefault();drop.classList.remove('active');void openFile(e.dataTransfer?.files?.[0]);});
for(const id of controls){$(id).addEventListener('input',()=>{if(id==='target-track')selectDefaultSource();
   if(id==='source-part'){confirmedNonPercussion=false;confirmedMixed=false;}invalidate();});}
$('route-one').addEventListener('click',()=>{$('target-track').value='1';selectDefaultSource();invalidate();});
$('route-two').addEventListener('click',()=>{$('target-track').value='2';selectDefaultSource();invalidate();});
$('route-confirm').addEventListener('click',()=>{const s=$('source-part').value;
 const selected=s==='__ALL_PERCUSSION__'?midi.notes.filter(n=>n.channel===9):midi.notes.filter(n=>n.track+':'+n.channel===s);
 if(selected.some(n=>n.channel!==9))confirmedNonPercussion=true;else confirmedMixed=true;
 render();});
$('convert').addEventListener('click',async()=>{
 if(!midi || $('convert').disabled || conversionPending)return;
 conversionPending=true;
 $('convert').disabled=true;
 for(const id of controls)$(id).disabled=true;
 try{const pre=prepareMidi(midi,{partKey:$('source-part').value,tempoBpm:$('tempo-bpm').value,
   totalMeasures:$('total-measures').value,title:$('song-title').value,target:Number($('target-track').value)});
   // Guard again here, not merely in the UI disabled property.
   if(pre.kind==='drum'){
     if(pre.source.some(n=>n.channel!==9) && !confirmedNonPercussion)throw Error('Confirm non-GM percussion interpretation first.');
     if(pre.source.every(n=>n.channel===9) && pre.source.length<midi.notes.length && !confirmedMixed)throw Error('Confirm channel-10-only selection first.');
   }
   invalidate();
   if(pre.kind==='drum'){
     const response=await fetch(profiles[pre.target]);
     if(!response.ok)throw Error(`Track ${pre.target} bundled drum-kit profile not found (HTTP ${response.status}).`);
     const profile=readProfile(await response.text());
     csv=convertDrumsToCsv(pre,profile);
     const events=drumEventPreview(pre),tbody=$('drum-events');tbody.replaceChildren();
     for(const ev of events.slice(0,120)){const tr=document.createElement('tr');for(const item of [ev.measure,ev.tick,ev.midiPitch,ev.gmSurface,ev.velocity]){
       const td=document.createElement('td');td.textContent=item;tr.append(td);}tbody.append(tr);}
     $('drum-results').hidden=false;
   }else csv=convertPitchedToCsv(pre);
   url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));
   const link=$('download');link.href=url;
   link.download=`Track_${String(pre.target).padStart(2,'0')}_${pre.title.replace(/[^a-z0-9-]+/gi,'_').slice(0,48)}_SymphonyCSV.csv`;
   link.hidden=false;
   setStatus(`Converted ${pre.source.length} MIDI notes to ${pre.kind==='drum'?'20-column Drums':'85-column Piano Roll'} SymphonyCSV. Download is ready.${hostReady?' Direct import into Track '+pre.target+' is ready.':''}`,'good');
 }catch(e){csv=null;setStatus(e?.message||String(e),'bad');}
 finally{conversionPending=false;for(const id of controls)$(id).disabled=false;render();}
});
$('import-direct').addEventListener('click',()=>{
 if(importPending||!hostReady||!csv)return;
 const track=Number($('target-track').value);
 if(![1,2,5,6].includes(track)){setStatus('Select Piano Roll Track 1/2 or Drum Track 5/6.','bad');return;}
 importPending=true;updateDirectButton();setStatus(`Validating and loading Track ${track} with Studio Rust/WASM…`);
 window.parent.postMessage({type:IMPORT_REQUEST,slot:track,filename:$('download').download,csvText:csv},window.location.origin);
});

// Initial state is intentionally explicit before the first MIDI is loaded.
setLoadedFeedback();render();
