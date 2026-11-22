/* SymphonyCSV Projects P005B2B — browser/Rust-WASM preparation adapter.
 * Produces the complete read-only P005B2A snapshot from authoritative CSV.
 * Deliberately DOES NOT modify SymphonyCSVImportSession, accepted sources,
 * playback, instrument selections, local storage, or DOM. Commit is later.
 */
import {stageProjectMusicalRestore} from './SymphonyCSV_Project_Stage_v01.mjs';
import {isProjectMusicalSourceFilename} from './SymphonyCSV_Project_Inventory_v01.mjs';
import {soundFontAssignmentsWithBytes} from './SymphonyCSV_SoundFont_Assets_v01.mjs';

const MODULES=Object.freeze({
  pitched:'/SymphonyCSV_WASM_Import_Bridge_v01.js',
  tab:'/SymphonyCSV_TAB_WASM_Import_Bridge_v01.mjs',
  tabTransport:'/SymphonyCSV_TAB_Studio_Transport_v01.mjs',
  drums:'/SymphonyCSV_Drums_WASM_Import_Bridge_v01.mjs',
  drumTransport:'/SymphonyCSV_Drums_Studio_Transport_v01.mjs'
});
const defaultLoad=type=>import(MODULES[type]);
const defaultReadProfile=async url=>{
  const response=await fetch(url);
  if(!response.ok)throw Error(`Bundled drum-kit mapping unavailable: HTTP ${response.status}`);
  return response.text();
};
const requireValue=(condition,message)=>{if(!condition)throw Error(message);};

/* Services are injectable so unit tests can exercise the same data-shaping
 * operations without requiring a browser, AudioContext, or a compiled WASM pkg.
 * In Studio the default module loader uses the real Rust/WASM bridges. */
export async function prepareProjectTrackWithBrowserWasm(entry,referenceSong=null,{
  host=globalThis,loadModule=defaultLoad,readDrumProfile=defaultReadProfile
}={}){
  const slot=entry?.slot;
  requireValue(Number.isInteger(slot)&&slot>=1&&slot<=6&&
    isProjectMusicalSourceFilename(slot,entry.filename)&&typeof entry.csvText==='string',
    'Musical project staging requires a validated Track_N.csv source.');
  const timing=host.SymphonyCSVTiming;
  const importer=host.SymphonyCSVImport;
  requireValue(typeof timing?.prepareSong==='function'&&
    typeof timing?.create==='function'&&typeof importer?.parseCSV==='function'&&
    typeof importer?.compareSong==='function',
    'Studio timing and CSV import helpers are not ready for project staging.');

  if(slot===3||slot===4){
    const [{importTabText},{tabImportToStudioEvents}]=await Promise.all([
      loadModule('tab'),loadModule('tabTransport')
    ]);
    requireValue(typeof importTabText==='function'&&typeof tabImportToStudioEvents==='function',
      'The TAB Rust/WASM staging adapters are unavailable.');
    const tab=await importTabText(entry.csvText,entry.filename);
    requireValue(tab&&tab.song,'TAB staging returned no composition metadata.');
    const song=timing.prepareSong(tab.song,tab.records,tab.headers);
    const studioEvents=tabImportToStudioEvents({...tab,song},slot);
    requireValue(Array.isArray(studioEvents),'TAB staging returned invalid musical events.');
    return {song,imported:{...tab,song,studioEvents,summary:{
      noteEvents:studioEvents.length,csvColumns:tab.columnCount,dataRows:tab.rowCount
    }}};
  }

  if(slot===5||slot===6){
    const [{importDrumText},transport]=await Promise.all([
      loadModule('drums'),loadModule('drumTransport')
    ]);
    requireValue(typeof importDrumText==='function'&&
      typeof transport?.parseDrumKitProfile==='function'&&
      typeof transport?.projectDrumTrack==='function',
      'The Drums Rust/WASM staging adapters are unavailable.');
    const kit=transport.BUNDLED_DRUM_KITS?.[slot];
    requireValue(kit&&typeof kit.profileUrl==='string'&&typeof kit.name==='string',
      `Bundled drum-kit mapping unavailable for Track ${slot}.`);
    const drums=await importDrumText(entry.csvText,entry.filename);
    requireValue(drums&&drums.song,'Drums staging returned no composition metadata.');
    const song=drums.song;
    // Prepare against the candidate song after verifying it matches the
    // previously prepared composition; this never changes the live clock.
    const agreement=importer.compareSong(referenceSong,song);
    requireValue(agreement?.ok===true,`Track ${slot} differs from the staged song: `+
      (agreement?.mismatches?.join('; ')||'incompatible composition'));
    const clock=timing.create(referenceSong||song);
    const mappings=transport.parseDrumKitProfile(
      await readDrumProfile(kit.profileUrl),importer.parseCSV);
    const studioEvents=transport.projectDrumTrack(drums,slot,mappings,clock);
    requireValue(Array.isArray(studioEvents),'Drums staging returned invalid musical events.');
    return {song,imported:{...drums,studioEvents,kitName:kit.name,summary:{
      ...drums.summary,noteEvents:studioEvents.length
    }}};
  }

  const {importText}=await loadModule('pitched');
  requireValue(typeof importText==='function','The pitched Rust/WASM staging adapter is unavailable.');
  const parsed=await importText(entry.csvText,entry.filename);
  requireValue(parsed&&parsed.song,'Pitched staging returned no composition metadata.');
  const song=timing.prepareSong(parsed.song,parsed.rows);
  return {song,imported:{...parsed,song}};
}

export async function stageProjectWithBrowserWasm(plan,services={}){
  const host=services.host??globalThis;
  requireValue(typeof host.SymphonyCSVImport?.compareSong==='function',
    'Studio composition identity comparison is unavailable.');
  const snapshot=await stageProjectMusicalRestore(plan,{
    prepareMusicalTrack:(entry,referenceSong)=>
      prepareProjectTrackWithBrowserWasm(entry,referenceSong,{...services,host}),
    compareSong:(referenceSong,candidateSong)=>
      host.SymphonyCSVImport.compareSong(referenceSong,candidateSong)
  });
  if(plan.soundFonts){
    const bridge=host.SymphonyCSVSoundFontRuntime;
    requireValue(typeof bridge?.stage==='function'&&typeof bridge?.commit==='function',
      'Embedded SoundFont restoration is not available in this Studio.');
    snapshot.stagedSoundFonts=bridge.stage(
      await soundFontAssignmentsWithBytes(plan.soundFonts));
  }
  return snapshot;
}
