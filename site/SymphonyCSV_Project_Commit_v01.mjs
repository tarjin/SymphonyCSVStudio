/* Projects — guarded synchronous restoration handoff.
 * CSV parsing and SoundFont-independent note/event projection are completed
 * before this function is entered. IndexedDB sessions are never touched.
 */
export function commitStagedProject({snapshot,host=globalThis}={}){
  const session=host.SymphonyCSVImportSession;
  const runtime=host.SymphonyCSVProjectPlayerRuntime;
  const sources=host.SymphonyCSVProjectSourcesRuntime;
  const fontRuntime=host.SymphonyCSVSoundFontRuntime;
  const wavRuntime=host.SymphonyCSVWAVRuntime;
  if(snapshot?.stagedWAV&&!wavRuntime?.commitRestore)
    throw Error('WAV restoration bridge unavailable.');
  if(snapshot?.stagedSoundFonts&&typeof fontRuntime?.commit!=='function')
    throw Error('Project SoundFont commit bridge is unavailable.');
  if(!snapshot?.song||!Array.isArray(snapshot.tracks)||snapshot.tracks.length!==6||
     !Array.isArray(snapshot.filenames)||snapshot.filenames.length!==6||
     !Array.isArray(snapshot.sources)||!snapshot.sources.length)
    throw Error('Complete validated six-track project snapshot is required.');
  if(!session||!Array.isArray(session.tracks)||session.tracks.length!==6||
    typeof runtime?.prepare!=='function'||typeof runtime?.commit!=='function'||
    typeof runtime?.rollback!=='function'||typeof sources?.replace!=='function')
    throw Error('Project restoration handoff is not ready. The current composition is unchanged.');
  // The player prepares all note arrays and all project settings read-only.
  const stagedPlayer=runtime.prepare(snapshot);
  // Preserve independent staff stompboxes and the nominal volume behind a
  // muted track. The underlying P060 player still owns all audio routing;
  // this only enriches its read-only prepared settings before the live swap.
  if(stagedPlayer?.next&&typeof stagedPlayer.next==='object'&&
     !Array.isArray(stagedPlayer.next)&&Array.isArray(snapshot.manifest?.tracks)){
    const next=stagedPlayer.next;
    const muteLevels=Array(6).fill(null);
    for(const track of snapshot.manifest.tracks){
      if(!Number.isInteger(track.slot)||track.slot<1||track.slot>6)continue;
      if(track.muted)muteLevels[track.slot-1]={muted:true,volume_percent:track.volume_percent};
      if(track.slot<=2){
        // P060 uses staff gain gates independently of the volume slider.
        // Keep the nominal level while both staffs are muted, so unmuting
        // either staff actually restores audible playback at that level.
        if(Array.isArray(next.trackVolumes)&&next.trackVolumes.length===6)
          next.trackVolumes[track.slot-1]=track.volume_percent/100;
        const flags=track.staff_mutes??{upper:track.muted,lower:track.muted};
        const property=track.slot===1?'staffMuted':'stringsStaffMuted';
        if(next[property]&&typeof next[property]==='object')
          next[property]={'Upper staff':flags.upper,'Lower staff':flags.lower};
      }
    }
    next.projectMutedLevels=muteLevels;
  }
  const old={song:session.song,tracks:session.tracks,filenames:session.filenames,
    accepted:sources.capture(),player:runtime.capture(),
    wav:snapshot.stagedWAV?wavRuntime.captureRestorable?.():null};
  if(snapshot.stagedWAV&&!old.wav)throw Error('WAV restoration rollback bridge unavailable.');
  let committed=false;
  try{
    // The live swap is synchronous, after all async parsing and checks.
    session.song=snapshot.song;
    session.tracks=snapshot.tracks;
    session.filenames=snapshot.filenames;
    sources.replace(snapshot.sources,snapshot.filenames);
    runtime.commit(stagedPlayer);
    // SF2 data was validated and LocalSF2 instances prepared before entering
    // this synchronous transaction. A failing SF2 commit rolls back both.
    if(snapshot.stagedSoundFonts)fontRuntime.commit(snapshot.stagedSoundFonts,'project ZIP');
    if(snapshot.stagedWAV)wavRuntime.commitRestore(snapshot.stagedWAV);
    committed=true;
  }catch(error){
    session.song=old.song;session.tracks=old.tracks;session.filenames=old.filenames;
    sources.replace(old.accepted.filter(Boolean),old.filenames);
    runtime.rollback(old.player);
    if(old.wav){
      try{wavRuntime.commitRestore(old.wav);}catch(rollbackError){
        throw Error('Project WAV rollback failed: '+rollbackError.message+'; initial error: '+error.message);
      }
    }
    throw Error('Project restoration rolled back: '+(error?.message||String(error)));
  }
  if(committed){
    try{
      host.dispatchEvent?.(new CustomEvent('symphonycsv:session-changed',
        {detail:{projectRestored:true,appliedToPlayer:true}}));
    }catch(error){host.console?.warn?.('Project restored; UI event failed',error);}
  }
  return {title:snapshot.song.title,tracks:snapshot.tracks.filter(Boolean).length,
    usedDefaults:snapshot.usedDefaults};
}
