import { Reverb } from "tone";

export function createReverb() {
  const node = new Reverb({
    decay: 2.8,
    preDelay: 0.03,
    wet: 0.65
  });

  let wetMix = 0.65;
  let bypassed = false;

  return {
    node,

    // Reverb impulse responses are generated asynchronously.
    ready() {
      return node.ready;
    },

    setDecay(seconds) {
      node.decay = Number(seconds);
      return node.ready;
    },

    setPreDelay(seconds) {
      node.preDelay = Number(seconds);
      return node.ready;
    },

    setWet(amount) {
      wetMix = Number(amount);
      if (!bypassed) node.wet.value = wetMix;
    },

    setBypass(value) {
      bypassed = Boolean(value);
      node.wet.value = bypassed ? 0 : wetMix;
    },

    dispose() {
      node.dispose();
    }
  };
}
