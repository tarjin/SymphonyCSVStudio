/* SymphonyCSV Studio performance/render preferences — Step 103.
 * Music is authoritative in CSV; this module never changes note ticks.
 * Media export policy is an interface contract, NOT an audio/video exporter.
 */
(function(root) {
  'use strict';
  const DEFAULT_PADDING_MS = 2000; // V1 candidate default; user may set 0.
  const MAX_PADDING_MS = 60000;     // V1 safety ceiling; configurable product policy.
  const DEFAULT_MASTER_DRUM_PERCENT = 100;
  const MAX_MASTER_DRUM_PERCENT = 400;
  // Maximum practical per-voice release guard; unlike the legacy 1.8s
  // truncation, this is an explicit resource ceiling for malformed/exotic SF2s.
  const MAX_SF2_RELEASE_SECONDS = 60;
  const PROJECT_FORMAT = 'SymphonyCSV_Project';
  const PROJECT_VERSION = 1;
  const MEDIA = new Set(['wav','mp3','mp4']);
  const MUSICAL = new Set(['csv','mid','midi','musicxml','xml']);

  function paddingMs(value) {
    if (typeof value === 'string' && !/^\d+$/.test(value.trim())) {
      throw new Error('Natural Decay Padding must be a whole number of milliseconds.');
    }
    const n = Number(value);
    if (!Number.isSafeInteger(n) || n < 0 || n > MAX_PADDING_MS) {
      throw new Error(`Natural Decay Padding must be 0–${MAX_PADDING_MS} ms.`);
    }
    return n;
  }
  function masterDrumPercent(value) {
    if (typeof value === 'string' && !/^\d+$/.test(value.trim())) {
      throw new Error('Master Drum Volume must be an integer percentage.');
    }
    const n = Number(value);
    if (!Number.isSafeInteger(n) || n < 0 || n > MAX_MASTER_DRUM_PERCENT) {
      throw new Error(`Master Drum Volume must be 0–${MAX_MASTER_DRUM_PERCENT}%.`);
    }
    return n;
  }
  function sf2ReleaseSeconds(timecents) {
    // SoundFont releaseVolEnv is signed timecents: seconds = 2^(tc/1200).
    // Lower 1ms bound avoids zero-time exponential automation; upper bound
    // is a product safety ceiling, not an arbitrary 1.8-second music cutoff.
    if (!Number.isFinite(timecents)) throw Error('Invalid SoundFont release timecents.');
    return Math.max(0.001,Math.min(MAX_SF2_RELEASE_SECONDS,Math.pow(2,timecents/1200)));
  }
  function elapsedPaddingMs(currentAudioSeconds,deadlineSeconds,value) {
    const padding=paddingMs(value);
    if (![currentAudioSeconds,deadlineSeconds].every(Number.isFinite))
      throw Error('Invalid audio clock or natural decay deadline.');
    const start=deadlineSeconds-padding/1000;
    return Math.max(0,Math.min(padding,(currentAudioSeconds-start)*1000));
  }
  function newProject() {
    return {format:PROJECT_FORMAT,version:PROJECT_VERSION,
      natural_decay_padding_ms:DEFAULT_PADDING_MS,
      master_drum_volume_percent:DEFAULT_MASTER_DRUM_PERCENT};
  }
  function loadProject(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value) ||
      value.format!==PROJECT_FORMAT || value.version!==PROJECT_VERSION ||
      !Object.hasOwn(value,'natural_decay_padding_ms')) {
      throw new Error('Not a supported SymphonyCSV_Project.json (version 1).');
    }
    // Preserve future project-level fields so merely changing padding does
    // not discard them; reject malformed padding transactionally.
    return {...value,
      natural_decay_padding_ms:paddingMs(value.natural_decay_padding_ms),
      master_drum_volume_percent:masterDrumPercent(
        Object.hasOwn(value,'master_drum_volume_percent')
          ? value.master_drum_volume_percent : DEFAULT_MASTER_DRUM_PERCENT)};
  }
  function saveProject(project, value) {
    return {...loadProject(project),natural_decay_padding_ms:paddingMs(value)};
  }
  function saveMasterDrumVolume(project,value) {
    return {...loadProject(project),master_drum_volume_percent:masterDrumPercent(value)};
  }
  function renderDurationMs(musicalEndMs, value, extension) {
    const ms=Number(musicalEndMs);
    if (!Number.isFinite(ms) || ms < 0) throw Error('Invalid musical endpoint.');
    const padding=paddingMs(value);
    const kind=String(extension||'').trim().toLowerCase().replace(/^\./,'');
    if (MEDIA.has(kind)) return ms+padding;
    if (MUSICAL.has(kind)) return ms;
    throw Error(`Unsupported export format: ${extension}`);
  }
  const api=Object.freeze({paddingMs,newProject,loadProject,saveProject,
    masterDrumPercent,saveMasterDrumVolume,sf2ReleaseSeconds,elapsedPaddingMs,
    renderDurationMs,DEFAULT_PADDING_MS,MAX_PADDING_MS,
    DEFAULT_MASTER_DRUM_PERCENT,MAX_MASTER_DRUM_PERCENT,MAX_SF2_RELEASE_SECONDS,
    PROJECT_FORMAT,PROJECT_VERSION});
  root.SymphonyCSVPerformance=api;
  if(typeof module==='object' && module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
