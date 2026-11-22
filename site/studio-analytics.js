/* SymphonyCSV Studio — optional, independent, one-way aggregate telemetry.
 * Deliberately separate from Vite/Rust bundles; disabled configuration is inert.
 * studio_ready means core Studio UI boot completed and DOM is available;
 * it does not claim that lazy WASM or SoundFonts have finished loading.
 * No persistent IDs, files, composition data, or music ever leave the browser.
 */
(function (host) {
  'use strict';
  const OUTPUTS=Object.freeze({
    project_export:'{"event":"project_export","version":1}',
    studio_ready:'{"event":"studio_ready","version":1}'
  });
  function report(name) {
    try {
      if(!Object.hasOwn(OUTPUTS,name))return;
      const cfg=host.SymphonyCSVAnalyticsConfig;
      if(cfg?.enabled!==true || typeof cfg.endpoint!=='string' || !cfg.endpoint)return;
      const url=new URL(cfg.endpoint,host.location?.href||'https://symphonycsvstudio.com/');
      if(url.protocol!=='https:' || url.username || url.password || url.hash || url.search)return;
      const nav=host.navigator;
      if(nav?.globalPrivacyControl===true || nav?.doNotTrack==='1')return;
      const payload=OUTPUTS[name];
      if(typeof nav?.sendBeacon==='function'){
        try {
          if(nav.sendBeacon(url.href,new Blob([payload],{type:'text/plain'})))return;
        }catch { /* Fall back without affecting the Studio. */ }
      }
      if(typeof host.fetch==='function'){
        try {
          const request=host.fetch(url.href,{
            method:'POST',mode:'cors',credentials:'omit',cache:'no-store',
            keepalive:true,headers:{'Content-Type':'text/plain'},body:payload
          });
          if(request && typeof request.catch==='function')request.catch(()=>{});
        }catch { /* One-way best effort only. */ }
      }
    }catch { /* An analytics problem must never affect composing or exporting. */ }
  }
  let readyChecked=false;
  function maybeReportStudioReady() {
    if(readyChecked)return;
    readyChecked=true; // At most one readiness count per actual page load.
    try {
      const doc=host.document;
      if(host.SymphonyCSVStudioBootReady!==true || !doc)return;
      if(doc.querySelectorAll('#sixTrackNav .track-tab[data-track]').length!==6 ||
         !doc.getElementById('view-playback') || !doc.getElementById('view-projects'))return;
      report('studio_ready');
    }catch { /* A partial or failed boot must not become a counted launch. */ }
  }
  try {
    host.addEventListener('symphonycsv:project-export-complete',()=>report('project_export'));
    const doc=host.document;
    if(doc?.readyState==='loading')
      doc.addEventListener('DOMContentLoaded',maybeReportStudioReady,{once:true});
    else maybeReportStudioReady();
  }catch { /* Telemetry is entirely optional. */ }
})(window);
