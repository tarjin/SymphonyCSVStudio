import { Gain } from "tone";

// Each entry has a unique instance ID and a Tone.js audio node.
// Example: { id: "chorus-1", node: chorus.node }
export function createEffectsChain(entries) {
  if (!Array.isArray(entries)) {
    throw new Error("Effects entries must be an array.");
  }

  const effects = new Map();

  for (const entry of entries) {
    if (!entry || typeof entry.id !== "string" ||
        !entry.id || !entry.node ||
        typeof entry.node.connect !== "function" ||
        typeof entry.node.disconnect !== "function" ||
        effects.has(entry.id)) {
      throw new Error("Invalid or duplicate effect instance.");
    }

    effects.set(entry.id, entry.node);
  }

  const input = new Gain(1);
  const output = new Gain(1);

  let connections = [];
  let currentOrder = [];
  let disposed = false;

  function setOrder(ids) {
    if (disposed) {
      throw new Error("Effects chain has been disposed.");
    }

    if (!Array.isArray(ids) ||
        ids.length !== effects.size ||
        new Set(ids).size !== effects.size ||
        ids.some(id => !effects.has(id))) {
      throw new Error("Order must contain every instance exactly once.");
    }

    // Remove only connections managed by this chain.
    for (const [source, target] of connections) {
      source.disconnect(target);
    }

    connections = [];

    const path = [
      input,
      ...ids.map(id => effects.get(id)),
      output
    ];

    for (let i = 0; i < path.length - 1; i++) {
      path[i].connect(path[i + 1]);
      connections.push([path[i], path[i + 1]]);
    }

    currentOrder = [...ids];
  }

  // Establish the initial signal path.
  setOrder([...effects.keys()]);

  return {
    input,
    output,
    setOrder,
    getOrder() {
      return [...currentOrder];
    },
    dispose() {
      if (disposed) return;

      for (const [source, target] of connections) {
        source.disconnect(target);
      }

      connections = [];
      input.dispose();
      output.dispose();
      disposed = true;

      // Effect instances remain owned by their creators.
    }
  };
}
