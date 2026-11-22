/* SymphonyCSV Projects: ZIP chooser, full read-only Rust/WASM staging,
 * explicit replacement consent, then synchronous guarded Studio commit.
 * Browser Save/Recover Session storage is never accessed here.
 */
import {preflightProjectImport} from './SymphonyCSV_Project_Preflight_v01.mjs';
import {stageProjectWithBrowserWasm} from './SymphonyCSV_Project_Browser_Stage_v01.mjs';
import {commitStagedProject} from './SymphonyCSV_Project_Commit_v01.mjs';
import {readAudioCompanionZip} from './SymphonyCSV_Project_Audio_Companion_v01.mjs';
import {chooseProjectAudioRestore} from './SymphonyCSV_Project_Dialogs_v01.mjs';

export async function validateProjectZipSelection(file,preflightCSV) {
  if(!file||typeof file.name!=='string'||!/\.zip$/i.test(file.name))
    throw Error('Choose one SymphonyCSV project .zip file.');
  if(typeof preflightCSV!=='function')
    throw Error('Rust/WASM musical preflight is not ready. Reload Studio and try again.');
  return preflightProjectImport(file,{
    preflightCSV,
    compositionEndMs:song=>window.SymphonyCSVTiming.create(song).endMs,
    defaultProjectName:file.name.replace(/\.zip$/i,'').slice(0,200)||'Untitled Project'
  });
}

export function initializeProjectOpenUI({root=document,host=window,stage=stageProjectWithBrowserWasm,commit=commitStagedProject}={}) {
  const open=root.getElementById('scsv-projects-open');
  const input=root.getElementById('scsv-projects-input');
  const drop=root.getElementById('scsv-projects-drop');
  const status=root.getElementById('scsv-projects-status');
  if(!open||!input||!drop||!status)return false;
  if(open.dataset.projectOpenReady==='yes')return true;
  open.dataset.projectOpenReady='yes';
  open.disabled=false;
  open.textContent='Choose ZIP — open project';
  open.title='Validate and restore a project after your approval';
  let busy=false;
  const show=(message,kind='info')=>{
    status.textContent=message;
    status.dataset.state=kind;
  };
  async function processFile(file){
    if(busy)return;
    busy=true;
    open.disabled=true;
    show(`Opening Project · Validating ${file?.name||'selected ZIP'}…`,'working');
    try {
      const preflight=host.SymphonyCSVPreflightRecoveryFromCSV;
      const result=await validateProjectZipSelection(file,preflight);
      const count=result.entries.length;
      const title=result.song?.title||result.manifest.project.name;
      show(`Opening Project · Validating ${count} musical track(s) for ${title} through Rust/WASM…`,'working');
      // Do not stage or commit the replacement until the companion decision
      // has been made. A wrong companion can be retried without touching the
      // current song, SoundFonts or WAV assets.
      let chosenAudio=null,skipped=false;
      const companion=result.manifest.project.companion_audio;
      if(companion){
        let reason='';
        for(;;){
          show(`Opening Project · Companion audio is available for ${title}. Choose Load, Skip or Cancel.`,'warning');
          const answer=await chooseProjectAudioRestore({root,title,fileName:companion.filename,reason});
          if(answer.action==='cancel'){
            show('Project opening cancelled. Your current composition is unchanged.','warning');
            return;
          }
          if(answer.action==='skip'){skipped=true;break;}
          if(answer.action==='load'){
            try{
              show('Opening Project · Validating companion WAV archive and pairing checksum…','working');
              chosenAudio=await readAudioCompanionZip(answer.file,{expected:companion,
                songDurationMs:host.SymphonyCSVTiming.create(result.song).endMs});
              break;
            }catch(error){
              reason='The selected Audio ZIP was rejected: '+(error?.message||String(error))+
                '. Choose another ZIP, Skip Audio, or Cancel.';
              show(reason,'error');
            }
          }
        }
      }
      show(`Opening Project · Restoring validated sources and settings for ${title}…`,'working');
      const snapshot=await stage(result,{host});
      if(host.SymphonyCSVWAVRuntime?.prepareRestore){
        snapshot.stagedWAV=await host.SymphonyCSVWAVRuntime.prepareRestore(
          chosenAudio?.audioSources??result.audioSources??[],
          chosenAudio?.manifest??result.manifest,result.song);
      }else if(chosenAudio?.audioSources?.length||result.audioSources?.length){
        throw Error('WAV restoration runtime is unavailable. Original composition unchanged.');
      }
      const current=host.SymphonyCSVImportSession?.song?.title;
      if(current){
        if(typeof host.confirm!=='function')
          throw Error('Replacement confirmation is unavailable; composition not changed.');
        if(!host.confirm(`Replace the currently loaded composition (${current}) with ${title}? `+
          'Any changes not saved to a project ZIP or Save to Browser will be lost.')){
          show('Project opening cancelled. Your current composition is unchanged.','warning');
          return;
        }
      }
      const restored=commit({snapshot,host});
      show(`PROJECT OPENED: ${restored.title} · ${restored.tracks} musical track(s) · `+
        (restored.usedDefaults?'default project settings':'project settings restored')+
        (skipped?' · Companion WAV recordings SKIPPED; Tracks 7–8 are empty.':
          chosenAudio?` · ${chosenAudio.audioSources.length} original WAV(s) restored.`:'')+
        ' Browser recovery copy unchanged.',skipped?'warning':'ok');
      host.console?.info?.('Project ZIP opened',{title,tracks:count,usedDefaults:result.usedDefaults});
    }catch(error){
      show('NOT OPENED: '+(error?.message||String(error)),'error');
      host.console?.warn?.('Project ZIP preflight rejected (no import)',error);
    }finally{
      busy=false;
      open.disabled=false;
      input.value=''; // choosing the same ZIP again must work
    }
  }
  open.addEventListener('click',()=>input.click());
  input.addEventListener('change',()=>{
    const files=input.files;
    if(files?.length===1)void processFile(files[0]);
    else if(files?.length>1)show('Choose exactly one project ZIP.','error');
  });
  drop.addEventListener('dragover',event=>{
    event.preventDefault();
    if(event.dataTransfer)event.dataTransfer.dropEffect='copy';
    drop.classList.add('scsv-projects-dragover');
  });
  drop.addEventListener('dragleave',()=>drop.classList.remove('scsv-projects-dragover'));
  drop.addEventListener('drop',event=>{
    event.preventDefault();
    drop.classList.remove('scsv-projects-dragover');
    const files=event.dataTransfer?.files;
    if(files?.length!==1){show('Drop exactly one project ZIP.','error');return;}
    void processFile(files[0]);
  });
  return true;
}

if(typeof document!=='undefined'&&typeof window!=='undefined'){
  if(document.readyState==='loading')
    document.addEventListener('DOMContentLoaded',()=>initializeProjectOpenUI(),{once:true});
  else initializeProjectOpenUI();
}
