/* SymphonyCSV Studio — project ZIP inventory contract (P002).
 * Pure preflight of entry NAMES only. Does not open a ZIP, parse music,
 * inspect file bytes, apply settings, or mutate the active composition.
 * Import canonicalizes authoritative file roles, not user attachments.
 */

export const PROJECT_SETTINGS_FILENAME = 'SymphonyCSV_Project.json';
const RESERVED_TRACK_FILE = /^Track_(\d+)\.(csv|mid|wav|mp3)$/i;

function assertEntryName(name) {
  if (typeof name !== 'string' || !name || name.length > 1024 ||
      name.includes('\0') || name.includes('\\') || name.startsWith('/') ||
      /^[A-Za-z]:/.test(name) || name.split('/').some(x => x === '..' || x === '.')) {
    throw Error('Unsafe project ZIP entry path.');
  }
}

// ZIP imports accept both canonical Track_1.csv and padded Track_01.csv.
// The role/slot is still determined by inventory, never by the file body.
export function isProjectMusicalSourceFilename(slot,filename) {
  return Number.isInteger(slot) && slot>=1 && slot<=6 &&
    typeof filename==='string' &&
    new RegExp(String.raw`^Track_0*${slot}\.csv$`,'i').test(filename);
}

export function projectTrackFilename(slot, role = 'source') {
  if (!Number.isInteger(slot) || slot < 1 || slot > 12)
    throw Error('Project track slot must be 1–12.');
  if (role !== 'source' && role !== 'export')
    throw Error('Project track role must be source or export.');
  return `Track_${slot}.${slot <= 6
    ? (role === 'source' ? 'csv' : 'mid')
    : (role === 'source' ? 'wav' : 'mp3')}`;
}

/**
 * @param {string[]} entryNames Exact paths from a future ZIP reader.
 * @returns {{manifestFile: string|null, sources: object[], exports: object[], ignoredCount: number}}
 */
export function inventoryProjectEntries(entryNames) {
  if (!Array.isArray(entryNames)) throw Error('ZIP entries must be a list.');
  const sourceSlots = new Map();
  const exportSlots = new Map();
  let manifestFile = null;
  let ignoredCount = 0;
  for (const name of entryNames) {
    assertEntryName(name);
    if (name.toLowerCase() === PROJECT_SETTINGS_FILENAME.toLowerCase()) {
      if (manifestFile !== null) throw Error('Duplicate project settings file.');
      manifestFile = name;
      continue;
    }
    // A supported project is flat; arbitrary notes/folders are ignored.
    if (name.includes('/') || name.endsWith('/')) { ignoredCount++; continue; }
    const match = RESERVED_TRACK_FILE.exec(name);
    if (!match) { ignoredCount++; continue; }
    const slot = Number(match[1]);
    const ext = match[2].toLowerCase();
    if (!Number.isInteger(slot) || slot < 1 || slot > 12)
      throw Error(`Unsupported project track slot in ${name}.`);
    const sourceExt = slot <= 6 ? 'csv' : 'wav';
    const exportExt = slot <= 6 ? 'mid' : 'mp3';
    if (ext !== sourceExt && ext !== exportExt)
      throw Error(`Track ${slot} has an unsupported file type: ${ext}.`);
    const isSource = ext === sourceExt;
    const slots = isSource ? sourceSlots : exportSlots;
    if (slots.has(slot)) throw Error(`Duplicate Track ${slot} ${isSource ? 'source' : 'export'} file.`);
    slots.set(slot, {slot, filename:name, type:slot <= 6 ? 'musical' : 'audio'});
  }
  if (sourceSlots.size === 0)
    throw Error('Project ZIP needs at least one authoritative track CSV or WAV.');
  // Derivatives are ignored when importing: a .mid or .mp3 is not a source.
  const bySlot = (a,b) => a.slot-b.slot;
  return {
    manifestFile,
    sources:[...sourceSlots.values()].sort(bySlot),
    exports:[...exportSlots.values()].sort(bySlot),
    ignoredCount
  };
}
