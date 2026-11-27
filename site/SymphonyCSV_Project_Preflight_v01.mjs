/* SymphonyCSV Studio — P005A read-only musical project preflight.
 * Stage 1 of the transactional Project Open workflow: ZIP + JSON + every
 * source CSV must be acceptable BEFORE any live Studio state can be changed.
 *
 * This module deliberately has NO commit function and NO browser globals.
 * Its caller supplies the existing Rust/WASM validation callback
 * (window.SymphonyCSVPreflightRecoveryFromCSV in the current Studio).
 * The active composition must never be cleared here.
 */
import {readProjectZip} from './SymphonyCSV_Project_ZIP_Reader_v01.mjs?v=mastergain02';
import {validateWavOnset} from './SymphonyCSV_WAV_Core_v01.mjs';

const utf8 = new TextDecoder('utf-8', {fatal:true});
const requireValue = (ok,message) => {if (!ok) throw Error(message);};

/**
 * @param {Blob|Uint8Array|ArrayBuffer} zipBytes Project ZIP.
 * @param {{preflightCSV: (entries: Array<{slot:number,filename:string,csvText:string}>)=>Promise<object>,
 *          defaultProjectName?:string}} options
 * @returns {Promise<{inventory:object,manifest:object,usedDefaults:boolean,
 *   entries:Array<{slot:number,filename:string,csvText:string}>,song:object}>}
 *
 * An entry's filename remains the canonical Track_N.csv name used by the
 * archive. A separate project settings JSON may name a SoundFont, but this
 * phase does not attempt to load external instruments or apply effects.
 */
export async function preflightProjectImport(zipBytes,{preflightCSV,compositionEndMs,defaultProjectName='Untitled Project'}={}) {
  requireValue(typeof preflightCSV==='function',
    'Project preflight requires the six-track Rust/WASM CSV validator.');
  const {inventory,manifest,usedDefaults,sources,audioSources,soundFonts} =
    await readProjectZip(zipBytes,{defaultProjectName});

  // ZIP reader already authenticates entry names, CRC, ZIP limits, manifest
  // schema and current six-track scope. CSV must ALSO be valid UTF-8 before
  // it is offered to the authoritative semantic validator.
  const entries=sources.map(source=>{
    let csvText;
    try {csvText=utf8.decode(source.bytes);}
    catch {throw Error(`Track ${source.slot} CSV is not valid UTF-8.`);}
    requireValue(csvText.trim().length>0,
      `Track ${source.slot} CSV is empty.`);
    requireValue(!csvText.includes('\0'),
      `Track ${source.slot} CSV contains NUL bytes.`);
    return {slot:source.slot,filename:source.filename,csvText};
  });

  // The callback checks the real Pitch/TAB/Drums Rust/WASM schemas, shared
  // composition identity, and bundled drum-kit mapping availability. It
  // must be the existing non-mutating PREflight, never the recovery IMPORT.
  const song=await preflightCSV(entries);
  requireValue(song && typeof song==='object',
    'Project musical preflight did not return a validated composition.');
  if(audioSources.length){
    requireValue(typeof compositionEndMs==='function',
      'WAV project preflight requires the authoritative musical clock.');
    const duration=compositionEndMs(song);
    for(const wav of audioSources){
      const config=manifest.tracks.find(t=>t.slot===wav.slot);
      validateWavOnset(config.onset_ms,duration);
    }
  }
  return {inventory,manifest,usedDefaults,entries,song,audioSources,soundFonts};
}
