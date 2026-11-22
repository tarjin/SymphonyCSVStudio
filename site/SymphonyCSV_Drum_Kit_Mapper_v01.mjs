export function mapDrumEventsToKit(events, mappings) {
  if (!Array.isArray(events) || !Array.isArray(mappings)) {
    throw new Error("Drum events and kit mappings must be arrays.");
  }

  return events.map(event => {
    const variant = event.variant_id ?? "";

    const candidates = mappings.filter(row =>
      row.SurfaceId === event.surface_id &&
      row.Articulation === event.articulation &&
      (variant === "" || row.VariantId === variant)
    );

    const defaults = candidates.filter(row =>
      String(row.IsDefault).toLowerCase() === "true"
    );

    const selected = variant !== ""
      ? (candidates.length === 1 ? candidates[0] : null)
      : (defaults.length === 1
          ? defaults[0]
          : (candidates.length === 1 ? candidates[0] : null));

    if (!selected) {
      throw new Error(
        `Missing or ambiguous drum mapping: ` +
        `${event.surface_id}/${event.articulation}/${variant}`
      );
    }

    const midi_note = Number(selected.MidiNote);
    const bank = Number(selected.Bank);
    const program = Number(selected.Program);

    if (!Number.isInteger(midi_note) ||
        midi_note < 0 || midi_note > 127 ||
        !Number.isInteger(bank) || bank < 0 ||
        !Number.isInteger(program) ||
        program < 0 || program > 127) {
      throw new Error("Invalid MIDI assignment in kit profile.");
    }

    return {
      ...event,
      midi_note,
      bank,
      program
    };
  });
}
