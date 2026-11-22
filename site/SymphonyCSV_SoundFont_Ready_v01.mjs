/* P061D2 — prepare musical SF2s before an explicit browser-session save.
 * Await ongoing local/default loads; initialize missing defaults without
 * changing the selected track or replacing an already-loaded SoundFont.
 * This module neither captures nor writes the saved browser session.
 */
const assert=(ok,message)=>{if(!ok)throw Error(message);};

export async function prepareSoundFontsForSession(slots,bridge,{
  maxWaitMs=120000,pollMs=100,
  now=()=>Date.now(),pause=ms=>new Promise(resolve=>setTimeout(resolve,ms))
}={}){
  assert(Array.isArray(slots)&&slots.length<=6&&slots.every(slot=>
    Number.isInteger(slot)&&slot>=1&&slot<=6)&&new Set(slots).size===slots.length,
    'Invalid musical SoundFont slots.');
  assert(typeof bridge?.getLoadState==='function'&&typeof bridge?.loadDefault==='function',
    'SoundFont preparation bridge is unavailable. Session not saved.');
  assert(Number.isFinite(maxWaitMs)&&maxWaitMs>0&&Number.isFinite(pollMs)&&pollMs>0,
    'Invalid SoundFont preparation timeout.');

  await Promise.all(slots.map(async slot=>{
    const status=()=>{
      const value=bridge.getLoadState(slot);
      assert(value&&typeof value.ready==='boolean'&&typeof value.busy==='boolean',
        `Track ${slot} SoundFont readiness is unavailable.`);
      return value;
    };
    const waitForLoading=async()=>{
      const started=now();
      let current=status();
      while(current.busy){
        if(now()-started>=maxWaitMs)
          throw Error(`Track ${slot} SoundFont loading timed out. Session not saved.`);
        await pause(pollMs);
        current=status();
      }
      return current;
    };

    let current=status();
    if(current.busy){
      // A user-selected SF2 or startup default is already being loaded.
      // Never start a competing default or snapshot the old instrument.
      current=await waitForLoading();
    }else if(!current.ready){
      // Track 4 is intentionally lazy-loaded; the other defaults may also be
      // missing if the user pressed Save immediately after opening Studio.
      await bridge.loadDefault(slot);
      current=await waitForLoading();
    }
    if(!current.ready)
      throw Error(`Track ${slot} SoundFont is unavailable`+
        (current.error?`: ${current.error}`:'')+'. Session not saved.');
  }));
}
