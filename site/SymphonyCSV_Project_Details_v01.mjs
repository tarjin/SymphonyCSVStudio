/* P061E — readable, deterministic, private project inventory.
 * The TXT is informational; JSON and authoritative CSVs remain the source of truth.
 */
export function buildProjectDetailsText({manifest,song}={}) {
  if(!manifest?.project||!manifest?.playback||!Array.isArray(manifest.tracks)||!song)
    throw Error('Project details require validated composition and settings.');
  const p=manifest.playback;
  const lines=[
    'SymphonyCSV Studio — Project Details',
    '===================================',
    'Informational inventory. SymphonyCSV_Project.json is the settings authority.',
    '',
    `Project: ${manifest.project.name}`,
    `Composition: ${song.title||manifest.project.name}`,
    `Tempo: ${song.tempoBpm??'Unknown'} BPM`,
    `Time signature: ${song.timeSignature||'Unknown'}`,
    `Measures: ${song.totalMeasures??'Unknown'}`,
    `Natural decay padding: ${p.natural_decay_padding_ms} ms`,
    `Master drum volume: ${p.master_drum_volume_percent}%`,
    '',
    'MUSICAL TRACKS',
    '--------------'
  ];
  for(const t of manifest.tracks.filter(x=>x.slot<=6)){
    lines.push(`Track ${t.slot} (${t.type}) — ${t.source_file}`);
    lines.push(`  MIDI derivative: Track_${t.slot}.mid`);
    lines.push(`  Volume: ${t.volume_percent}%  Muted: ${t.muted?'yes':'no'}`);
    const sf=t.soundfont;
    if(sf){
      lines.push(`  SoundFont: ${sf.filename}`);
      lines.push(`  Preset: bank ${sf.preset?.bank??'default'}, program ${sf.preset?.program??'default'}`);
      lines.push(`  Embedded: ${sf.embedded_file??'not embedded (legacy)'}`);
      if(sf.sha256)lines.push(`  SHA-256: ${sf.sha256}`);
    }else lines.push('  SoundFont: Not included (legacy ZIP)');
    if(t.staff_mutes)lines.push(`  Staff mutes: upper=${t.staff_mutes.upper}, lower=${t.staff_mutes.lower}`);
  }
  const wavTracks=manifest.tracks.filter(t=>t.slot>=7);
  if(wavTracks.length){
    lines.push('', 'ORIGINAL RECORDED WAV AUDIO', '---------------------------');
    for(const t of wavTracks){
      lines.push(`Track ${t.slot} — ${t.source_file} (original WAV retained unedited)`);
      lines.push(`  Onset: ${t.onset_ms} ms  Volume: ${t.volume_percent}%  Pan: ${t.pan_position??0}  Muted: ${t.muted?'yes':'no'}`);
    }
  }
  lines.push('', 'GLOBAL EFFECTS', '--------------');
  for(const [key,value] of Object.entries(p.global_effects))lines.push(`${key}: ${value}`);
  for(const effect of ['reverb','chorus','delay']){
    lines.push(`${effect} sends (%): ${p[effect+'_sends_percent'].join(', ')}`);
    lines.push(`${effect} send mutes: ${p.parallel_send_mutes[effect].join(', ')}`);
  }
  if(wavTracks.length)for(const fx of ['chorus','delay','reverb']){
    lines.push(`WAV ${fx} sends (%): ${(p.audio_sends_percent?.[fx]||[0,0]).join(', ')}`);
    lines.push(`WAV ${fx} send mutes: ${(p.audio_send_mutes?.[fx]||[false,false]).join(', ')}`);
  }
  lines.push('', 'Privacy: this ZIP contains local SoundFont binaries if embedded.',
    'No audio master is included unless a Mix_All file is explicitly exported.',
    '',
    'SOUNDFONT LICENSING AND SHARING',
    '-------------------------------',
    'Embedded SoundFonts may carry separate copyright, licensing, attribution and redistribution requirements.',
    'Studio-curated SoundFonts remain subject to their own licenses; consult their accompanying licensing information.',
    'For externally supplied SoundFonts, SymphonyCSV Studio cannot verify or grant redistribution permission.',
    'Permission to use a SoundFont locally does not necessarily permit sharing its binary in a Project ZIP.',
    'Before sharing this ZIP, verify redistribution rights for each embedded SoundFont and supply any required license terms, copyright notices and attribution with the project.',
    'You remain responsible for permissions when sharing externally supplied SoundFonts.',
    'Exporting a Project ZIP does not transfer ownership of your original musical composition.',
    '',
    'Powered by SymphonyCSV Studio.',
    'Visit SymphonyCSVStudio.com');
  return lines.join('\n');
}
