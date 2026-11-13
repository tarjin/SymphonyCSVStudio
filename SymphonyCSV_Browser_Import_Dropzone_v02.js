/* SymphonyCSV Studio — browser import/drop-zone prototype v0.2.
 * Requires window.SymphonyCSVImport (the existing, tested CSV import core).
 * Step 36: invokes an optional guarded player hook for Track 1 only.
 * Track 2–6 data remain in independently validated session slots.
 * Do not interpret CSV validation as evidence of audio playback.
 */
(() => {
  'use strict';

  function initialize() {
    const importer = window.SymphonyCSVImport;
    const title = document.querySelector('#playback-title');
    const viewTop = document.querySelector('#view-playback .view-top');
    const leftHeader = document.querySelector('#view-playback .view-top > div:first-child');
    const trackTabs = document.querySelectorAll('#sixTrackNav .track-tab[data-track]');
    if (!importer || !title || !viewTop || !leftHeader || trackTabs.length !== 6) {
      console.error('SymphonyCSV drop-zone integration guard failed', {
        importer: !!importer, title: !!title, leftHeader: !!leftHeader,
        trackTabs: trackTabs.length
      });
      return;
    }
    if (document.querySelector('#scsv-import-file')) return;

    // A pending track hides the Playback Viewer itself in Exploration 01.8.
    // Move the existing title/header out to a shared, always-visible location,
    // rather than building a second, competing upload target for Track 2–6.
    const sharedHeader = document.createElement('div');
    sharedHeader.className = 'view-top scsv-shared-title';
    const pendingPanel = document.querySelector('#sixTrackPending');
    (pendingPanel || document.querySelector('#view-playback')).before(sharedHeader);
    sharedHeader.append(leftHeader);
    const topActions = viewTop.querySelector('.top-actions');
    if (topActions) sharedHeader.append(topActions);
    viewTop.hidden = true;
    const eyebrow = leftHeader.querySelector('.eyebrow');
    if (eyebrow) eyebrow.textContent = 'CURRENT COMPOSITION';

    const session = {
      song: null,
      tracks: Array(6).fill(null),
      filenames: Array(6).fill(null),
      version: 'browser-dropzone-v0.2',
    };
    // Accessible only in this local prototype; no persistence or network upload.
    window.SymphonyCSVImportSession = session;

    const style = document.createElement('style');
    style.textContent = `
      #view-playback .view-top[hidden]{display:none!important;}
      .scsv-shared-title{margin:0 0 24px;}
      .scsv-dropzone{border:1px dashed #71549a;border-radius:12px;padding:12px 16px;
        margin:-12px -16px;transition:border-color .15s,background .15s;cursor:copy;}
      .scsv-dropzone:hover,.scsv-dropzone:focus-visible,.scsv-dropzone.scsv-over{
        border-color:#d1a2ff;background:#30203e88;outline:none;}
      .scsv-import-hint{font-size:12px;line-height:1.5;color:#c4acd9;
        margin-top:11px;display:flex;align-items:center;gap:9px;}
      .scsv-import-status{font-size:12px;line-height:1.5;color:#cdb8e2;
        margin-top:8px;max-width:800px;}
      .scsv-import-status[data-result="ok"]{color:#a2edc9;}
      .scsv-import-status[data-result="error"]{color:#ffc4b6;}
      .scsv-file-input{position:absolute;width:1px;height:1px;opacity:0;
        overflow:hidden;pointer-events:none;}
    `;
    document.head.append(style);

    const input = document.createElement('input');
    input.type = 'file';
    input.id = 'scsv-import-file';
    input.className = 'scsv-file-input';
    input.accept = '.csv,text/csv';
    input.setAttribute('aria-label', 'Choose SymphonyCSV for selected track');
    leftHeader.append(input);

    leftHeader.classList.add('scsv-dropzone');
    leftHeader.tabIndex = 0;
    leftHeader.setAttribute('role','button');
    leftHeader.setAttribute('aria-label',
      'Import a SymphonyCSV file into the selected track');

    const hint = document.createElement('p');
    hint.className = 'scsv-import-hint';
    hint.textContent = '↓ Drop SymphonyCSV for the selected track, or click to browse';
    const status = document.createElement('p');
    status.className = 'scsv-import-status';
    status.id = 'scsv-import-status';
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live','polite');
    status.textContent = 'Import validation experiment: the player still uses the original embedded piano notes.';
    leftHeader.append(hint, status);

    const activeSlot = () => {
      const active = document.querySelector('#sixTrackNav .track-tab.selected[data-track]');
      const number = Number(active?.dataset.track);
      return Number.isInteger(number) && number >= 1 && number <= 6 ? number : 1;
    };
    const updateEditingAction = () => {
      if (topActions) topActions.style.display = activeSlot() === 1 ? '' : 'none';
    };
    for (const tab of trackTabs) tab.addEventListener('click',updateEditingAction);
    updateEditingAction();
    const displayStatus = (message, outcome = 'info') => {
      status.dataset.result = outcome;
      status.textContent = message;
    };

    async function importFile(file) {
      if (!file) return;
      const slot = activeSlot();
      if (!/\.csv$/i.test(file.name)) {
        displayStatus('Only SymphonyCSV (.csv) files are accepted in Studio.','error');
        return;
      }
      displayStatus(`Reading ${file.name} for Track ${slot}…`);
      try {
        // Parse and validate before modifying any session slot.
        const parsed = importer.importText(await file.text(), file.name);
        const agreement = importer.compareSong(session.song, parsed.song);
        if (!agreement.ok) {
          displayStatus(`Track ${slot} rejected: ${agreement.mismatches.join('; ')}`, 'error');
          return;
        }
        if (session.tracks[slot - 1] && !window.confirm(
          `Track ${slot} already has a validated CSV. Replace its in-memory import?`
        )) {
          displayStatus('Import cancelled. Existing in-memory CSV preserved.');
          return;
        }
        // Let the existing player accept or reject a new Track 1 data set
        // BEFORE modifying the validated CSV session. On Track 2–6, this
        // intentionally returns false; their audio/editor bridges come later.
        const appliedToPlayer = typeof window.SymphonyCSVApplyTrack === 'function'
          ? window.SymphonyCSVApplyTrack(slot, parsed, session) === true
          : false;
        session.tracks[slot - 1] = parsed;
        session.filenames[slot - 1] = file.name;
        if (!session.song) session.song = parsed.song;
        const used = session.tracks.filter(Boolean).length;
        displayStatus(
          `Validated Track ${slot}: ${file.name} · ${parsed.summary.noteEvents} notes · ` +
          `${parsed.song.totalMeasures} measures · ${used}/6 imported. ` +
          (appliedToPlayer ? 'Track '+slot+' is connected to the shared player.' :
            'CSV validated; this track is not yet connected to audio.'),
          'ok'
        );
        window.dispatchEvent(new CustomEvent('symphonycsv:session-changed', {
          detail: { slot, appliedToPlayer }
        }));
        console.info('SymphonyCSV import validation passed',{
          slot, filename:file.name, notes:parsed.summary.noteEvents,
          song:parsed.song, csvColumns:parsed.summary.csvColumns
        });
      } catch (err) {
        console.error('SymphonyCSV import rejected', err);
        displayStatus(`Track ${slot} rejected: ${err?.message || String(err)}`, 'error');
      }
    }

    leftHeader.addEventListener('click', event => {
      if (event.target.closest('a,button,input,select,textarea')) return;
      input.click();
    });
    leftHeader.addEventListener('keydown', event => {
      if (event.target !== leftHeader) return;
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        input.click();
      }
    });
    leftHeader.addEventListener('dragenter', event => {
      event.preventDefault(); leftHeader.classList.add('scsv-over');
    });
    leftHeader.addEventListener('dragover', event => {
      event.preventDefault(); event.dataTransfer.dropEffect = 'copy';
      leftHeader.classList.add('scsv-over');
    });
    leftHeader.addEventListener('dragleave', event => {
      if (!leftHeader.contains(event.relatedTarget)) leftHeader.classList.remove('scsv-over');
    });
    leftHeader.addEventListener('drop', event => {
      event.preventDefault();leftHeader.classList.remove('scsv-over');
      const files = event.dataTransfer?.files;
      if (files?.length !== 1) {
        displayStatus('Drop exactly one SymphonyCSV file at a time.','error');
        return;
      }
      void importFile(files[0]);
    });
    input.addEventListener('change', () => {
      const selected = input.files?.[0];
      input.value = ''; // Picking the same file again must trigger change.
      void importFile(selected);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize, { once:true });
  } else initialize();
})();
