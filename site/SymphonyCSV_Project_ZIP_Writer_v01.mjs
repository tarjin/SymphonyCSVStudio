/* SymphonyCSV Projects — portable ZIP export (STORE, no external dependencies).
 * All files are prepared before calling this function. ZIP bytes are returned
 * only when every input passes validation. No browser storage or session writes.
 */
import {inventoryProjectEntries} from './SymphonyCSV_Project_Inventory_v01.mjs';
import {readProjectManifest} from './SymphonyCSV_Project_Manifest_v01.mjs';
import {projectZipCrc32,PROJECT_ZIP_MAX_BYTES} from './SymphonyCSV_Project_ZIP_Reader_v01.mjs';

const enc=new TextEncoder();
const must=(condition,message)=>{if(!condition)throw Error(message);};
const asBytes=value=>value instanceof Uint8Array ? value :
  value instanceof ArrayBuffer ? new Uint8Array(value) :
  typeof value==='string' ? enc.encode(value) : null;
const maxOutput=PROJECT_ZIP_MAX_BYTES;

/**
 * @param {Array<{name:string,data:Uint8Array|ArrayBuffer|string}>} files
 * Flat canonical Project ZIP inputs. Existing audio bytes may be passed as-is.
 * Uses STORE rather than DEFLATE so that MP3/WAV and large CSV sources are
 * byte-exact and no unbounded in-browser compression job is required.
 */
export function writeSymphonyCSVProjectZip(files){
  must(Array.isArray(files)&&files.length>=2&&files.length<=30,
    'A project ZIP requires authoritative track files and JSON settings.');
  const seen=new Set(),normalized=[];
  for(const f of files){
    must(f&&typeof f.name==='string'&&f.name.length>0,
      'Project export includes an invalid filename.');
    must(/^(?:Track_(?:[1-9]|1[0-2])\.(?:csv|mid|wav|mp3)|SymphonyCSV_Project\.json|SymphonyCSV_Project_Details\.txt|SoundFonts\/[a-f0-9]{64}\.sf2|Mix_All\.(?:wav|mp3))$/.test(f.name),
      `Unsupported project export filename: ${f.name}.`);
    must(!seen.has(f.name.toLowerCase()),`Duplicate project output: ${f.name}.`);
    seen.add(f.name.toLowerCase());
    const data=asBytes(f.data);
    must(data instanceof Uint8Array&&data.byteLength>0,
      `Project file ${f.name} is empty or invalid.`);
    const nameBytes=enc.encode(f.name);
    must(nameBytes.length<=65535,'Project ZIP filename is too long.');
    normalized.push({name:f.name,nameBytes,data,crc:projectZipCrc32(data)});
  }
  const inv=inventoryProjectEntries(normalized.map(x=>x.name));
  must(inv.sources.some(s=>s.slot<=6),'An audio-only project is not valid.');
  must(inv.manifestFile!==null,'Every exported project needs SymphonyCSV_Project.json.');
  const json=normalized.find(f=>f.name==='SymphonyCSV_Project.json');
  const {manifest}=readProjectManifest(new TextDecoder('utf-8',{fatal:true}).decode(json.data),inv);
  const required=new Set(manifest.tracks.map(t=>t.soundfont?.embedded_file).filter(Boolean));
  const actual=normalized.filter(f=>f.name.startsWith('SoundFonts/'));
  must(actual.length===required.size&&actual.every(f=>required.has(f.name)),
    'Project SoundFont inventory contains a missing or unreferenced asset.');
  for(const track of manifest.tracks){
    if(track.slot<=6&&track.soundfont&&!track.soundfont.embedded_file)
      throw Error(`Track ${track.slot} SoundFont must be embedded for a portable Project ZIP.`);
  }
  for(const d of inv.exports){
    must(inv.sources.some(s=>s.slot===d.slot),
      `Derived Track ${d.slot} has no authoritative source.`);
  }
  let offset=0,centralSize=0;
  for(const f of normalized){
    f.offset=offset;
    offset+=30+f.nameBytes.length+f.data.length;
    centralSize+=46+f.nameBytes.length;
    must(offset+centralSize+22<=maxOutput&&offset<=0xffffffff,
      'Project ZIP exceeds the supported size.');
  }
  must(normalized.length<=65535 && centralSize<=0xffffffff,
    'Project ZIP exceeds classic ZIP limits.');
  const bytes=new Uint8Array(offset+centralSize+22);
  const view=new DataView(bytes.buffer);
  const u16=(p,v)=>view.setUint16(p,v,true);
  const u32=(p,v)=>view.setUint32(p,v>>>0,true);
  for(const f of normalized){
    const p=f.offset;
    u32(p,0x04034b50);u16(p+4,20);u16(p+6,0x800);u16(p+8,0);
    u32(p+14,f.crc);u32(p+18,f.data.length);u32(p+22,f.data.length);
    u16(p+26,f.nameBytes.length);u16(p+28,0);
    bytes.set(f.nameBytes,p+30);
    bytes.set(f.data,p+30+f.nameBytes.length);
  }
  let p=offset;
  for(const f of normalized){
    u32(p,0x02014b50);u16(p+4,20);u16(p+6,20);u16(p+8,0x800);u16(p+10,0);
    u32(p+16,f.crc);u32(p+20,f.data.length);u32(p+24,f.data.length);
    u16(p+28,f.nameBytes.length);u16(p+30,0);u16(p+32,0);
    u16(p+34,0);u16(p+36,0);u32(p+38,0);u32(p+42,f.offset);
    bytes.set(f.nameBytes,p+46);
    p+=46+f.nameBytes.length;
  }
  u32(p,0x06054b50);u16(p+4,0);u16(p+6,0);
  u16(p+8,normalized.length);u16(p+10,normalized.length);
  u32(p+12,centralSize);u32(p+16,offset);u16(p+20,0);
  must(p+22===bytes.length,'ZIP output size invariant failed.');
  return bytes;
}
