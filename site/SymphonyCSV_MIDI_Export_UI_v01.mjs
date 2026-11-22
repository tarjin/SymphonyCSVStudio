/* Step 106: non-invasive export controls for the current selected musical slot.
 * Both downloads use the same validated in-memory Rust/WASM import session.
 */
import { prepareSymphonyCSVTrackExport, makeMidiSidecar } from './SymphonyCSV_MIDI_Export_Core_v01.mjs';

function ready() {
  if (document.getElementById('scsv-midi-export-panel')) return;
  const workspace = document.querySelector('main.workspace');
  const viewer = document.querySelector('#view-playback');
  if (!workspace || !viewer) return;

  const panel = document.createElement('div');
  panel.id = 'scsv-midi-export-panel';
  panel.setAttribute('role', 'group');
  panel.setAttribute('aria-label', 'MIDI export for the selected track');
  panel.style.cssText = 'margin:0 0 16px;padding:12px 16px;background:#241b34;'+
    'border:1px solid #5e427c;border-radius:11px;display:flex;gap:12px;'+
    'flex-wrap:wrap;align-items:center;color:#f0dfff;';

  const label = document.createElement('span');
  label.textContent = 'MIDI export · selected Track 1';
  label.style.cssText = 'font-size:13px;font-weight:700;margin-right:auto;';
  const midiButton = document.createElement('button');
  midiButton.type = 'button';
  midiButton.textContent = '↓ Download .mid';
  midiButton.className = 'soft-button';
  const txtButton = document.createElement('button');
  txtButton.type = 'button';
  txtButton.textContent = '↓ Download .txt receipt';
  txtButton.className = 'soft-button';
  const info = document.createElement('span');
  info.style.cssText = 'width:100%;font-size:12px;color:#d2bfe6;';
  info.setAttribute('role', 'status');
  info.setAttribute('aria-live', 'polite');
  panel.append(label, midiButton, txtButton, info);
  viewer.before(panel);

  let activeExport = null;
  function currentSlot() {
    const selected = document.querySelector('#sixTrackNav .track-tab.selected[data-track]');
    return Number(selected?.dataset.track) || 1;
  }
  function update() {
    // MIDI exports are defined only for musical Tracks 1–6.
    const wavSelected = Boolean(window.SymphonyCSVWAVRuntime?.selectedSlot?.());
    panel.style.display = wavSelected ? 'none' : 'flex';
    if (wavSelected) { activeExport = null; return; }
    const session = window.SymphonyCSVImportSession;
    const slot = currentSlot();
    const loaded = Boolean(session?.tracks?.[slot-1]);
    label.textContent = `MIDI export · selected Track ${slot}`;
    midiButton.disabled = txtButton.disabled = !loaded;
    info.textContent = loaded ? 'Downloads preserve CSV musical ticks, not audio tail padding.' :
      'Import a validated SymphonyCSV track to enable MIDI export.';
    activeExport = null;
  }
  function chooseExport() {
    const session = window.SymphonyCSVImportSession;
    const slot = currentSlot();
    if (!session) throw Error('SymphonyCSV import session is unavailable.');
    if (!activeExport || activeExport.slot !== slot || activeExport.sessionTrack !== session.tracks[slot-1] ||
        activeExport.song !== session.song) {
      activeExport = {
        slot, sessionTrack:session.tracks[slot-1], song:session.song,
        data:prepareSymphonyCSVTrackExport(session,slot)
      };
    }
    return activeExport.data;
  }
  function download(filename, bytes, mime) {
    const url = URL.createObjectURL(new Blob([bytes], {type:mime}));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.hidden = true;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    // Delayed revocation permits browsers to start the download.
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }
  function filename(e, extension) {
    return `Track_${String(e.slot).padStart(2,'0')}_SymphonyCSV.${extension}`;
  }
  midiButton.addEventListener('click', () => {
    try {
      const e = chooseExport();
      download(filename(e,'mid'), e.bytes, 'audio/midi');
      info.textContent = `Downloaded ${e.noteCount} validated MIDI events; ${e.settings.totalMeasures} complete measures.`;
    } catch (err) {
      info.textContent = `MIDI export rejected: ${err.message || String(err)}`;
      console.error(err);
    }
  });
  txtButton.addEventListener('click', async () => {
    try {
      txtButton.disabled = true;
      const e = chooseExport();
      const digest = await crypto.subtle.digest('SHA-256', e.bytes);
      const sha256 = Array.from(new Uint8Array(digest), b=>b.toString(16).padStart(2,'0')).join('');
      const receipt = makeMidiSidecar(e, sha256, new Date());
      download(filename(e,'txt'), receipt, 'text/plain;charset=utf-8');
      info.textContent = 'Download receipt includes the MIDI SHA-256 and timing details.';
    } catch (err) {
      info.textContent = `Receipt export rejected: ${err.message || String(err)}`;
      console.error(err);
    } finally { update(); }
  });
  document.querySelectorAll('#sixTrackNav .track-tab[data-track]').forEach(tab => {
    tab.addEventListener('click', () => queueMicrotask(update));
  });
  window.addEventListener('symphonycsv:session-changed', update);
  window.addEventListener('symphonycsv:wav-workspace-selected', update);
  update();
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ready, {once:true});
else ready();
