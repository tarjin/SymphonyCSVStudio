/*
 * SymphonyCSV Studio - Rust/WASM Import Bridge v0.1
 * Local browser execution. No data upload.
 */

import init, { import_text_json }
  from "./crates/symphonycsv_core/pkg/symphonycsv_core.js";

let initialization = null;

function ensureReady() {
  if (!initialization) {
    initialization = init();
  }
  return initialization;
}

export async function importText(
  text,
  filename = "unnamed.csv"
) {
  await ensureReady();

  // Rust validates before returning any composition data.
  const result = import_text_json(text, filename);

  return JSON.parse(result);
}

export async function ready() {
  await ensureReady();
  return true;
}
