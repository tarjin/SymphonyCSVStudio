/* SymphonyCSV Projects P005B2A — prepare a complete musical replacement.
 * This module contains NO live Studio/session/player mutations or browser globals.
 * The importer callback must prepare its musical object without changing Studio.
 * It is NOT an import commit function: the future player handoff is separate.
 */

import {isProjectMusicalSourceFilename} from './SymphonyCSV_Project_Inventory_v01.mjs';

function requireValue(ok,message){if(!ok)throw Error(message);}

/**
 * @param {object} plan Result of preflightProjectImport (P005A).
 * @param {{prepareMusicalTrack: (entry:object,referenceSong:object|null)=>Promise<object>,
 *          compareSong:(referenceSong:object|null,candidateSong:object)=>{ok:boolean,mismatches?:string[]}}} helpers
 * @returns {Promise<{song:object,tracks:object[],filenames:(string|null)[],
 *     sources:object[],manifest:object,usedDefaults:boolean}>}
 *
 * Callback result must be {song,imported}. `imported` is the fully prepared
 * Rust/WASM-derived object that the future player handoff will install.
 * No callback may call SymphonyCSVApplyTrack, modify SymphonyCSVImportSession,
 * dispatch session events, or alter player state.
 */
export async function stageProjectMusicalRestore(plan,{prepareMusicalTrack,compareSong}={}) {
  requireValue(plan&&typeof plan==='object'&&Array.isArray(plan.entries)&&
    plan.entries.length>=1&&plan.entries.length<=6&&plan.song&&
    plan.manifest&&Array.isArray(plan.manifest.tracks),
  'A validated project preflight plan is required before staging.');
  requireValue(typeof prepareMusicalTrack==='function'&&typeof compareSong==='function',
    'Read-only Rust/WASM track preparation and song comparison are required.');

  // The six-track musical staging boundary remains authoritative. WAV assets
  // are validated and staged independently before the final atomic commit.
  requireValue(plan.manifest.tracks.filter(t=>t.slot<=6).length===plan.entries.length &&
    plan.manifest.tracks.every(t=>t&&t.slot>=1&&t.slot<=8),
    'Invalid musical or WAV project staging inventory.');

  const slots=Array(6).fill(null);
  const filenames=Array(6).fill(null);
  const sources=Array(6).fill(null);
  const sorted=[...plan.entries].sort((a,b)=>a.slot-b.slot);
  const seen=new Set();
  let referenceSong=null;
  for(const entry of sorted){
    const slot=entry?.slot;
    requireValue(Number.isInteger(slot)&&slot>=1&&slot<=6&&!seen.has(slot),
      'Duplicate or invalid staged musical track.');
    seen.add(slot);
    requireValue(isProjectMusicalSourceFilename(slot,entry.filename)&&
      typeof entry.csvText==='string'&&entry.csvText.length>0,
      `Invalid Track ${slot} authoritative CSV staging source.`);
    requireValue(plan.manifest.tracks.some(t=>t.slot===slot&&t.source_file===entry.filename),
      `Project manifest is missing Track ${slot}.`);

    // This is the ONLY async preparation operation; nothing installed yet.
    const result=await prepareMusicalTrack({...entry},referenceSong);
    requireValue(result&&result.song&&result.imported&&typeof result.imported==='object',
      `Track ${slot} did not produce a prepared musical object.`);
    const compared=compareSong(referenceSong,result.song);
    requireValue(compared?.ok===true,
      `Track ${slot} composition differs from other project tracks: `+
      (compared?.mismatches?.join('; ')||'incompatible composition'));
    const vsPreflight=compareSong(plan.song,result.song);
    requireValue(vsPreflight?.ok===true,
      `Track ${slot} differs from the validated preflight composition: `+
      (vsPreflight?.mismatches?.join('; ')||'incompatible composition'));
    if(!referenceSong)referenceSong=result.song;
    slots[slot-1]=result.imported;
    filenames[slot-1]=entry.filename;
    sources[slot-1]={...entry};
  }
  requireValue(plan.manifest.tracks.filter(t=>t.slot<=6).every(t=>seen.has(t.slot)),
    'The staged project is missing an authoritative musical track.');
  // Arrays are exactly six slots long, with nulls for tracks not in the ZIP.
  // The importer must install or reject this COMPLETE snapshot as one operation.
  return {song:referenceSong,tracks:slots,filenames,
    sources:sources.filter(Boolean),manifest:plan.manifest,
    usedDefaults:plan.usedDefaults===true};
}
