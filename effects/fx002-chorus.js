import { Chorus } from "tone";

export function createChorus() {
  const node = new Chorus({
    frequency: 1.5,
    delayTime: 4,
    depth: 0.7,
    spread: 180,
    wet: 0.7
  });

  let wetMix = 0.7;
  let bypassed = false;
  let started = false;

  return {
    node,
    start() {
      if (!started) {
        node.start();
        started = true;
      }
    },
    setRate(hz) {
      node.frequency.value = Number(hz);
    },
    setDepth(amount) {
      node.depth = Number(amount);
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
