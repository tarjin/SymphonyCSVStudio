import { Tremolo } from "tone";

export function createTremolo() {
  const node = new Tremolo({
    frequency: 4,
    depth: 0.75,
    spread: 0,
    type: "sine",
    wet: 0.8
  });

  let wetMix = 0.8;
  let bypassed = false;
  let started = false;

  function validate(value, min, max, label) {
    const number = Number(value);

    if (!Number.isFinite(number) ||
        number < min || number > max) {
      throw new RangeError(
        `${label} must be between ${min} and ${max}.`
      );
    }

    return number;
  }

  return {
    node,

    start() {
      if (!started) {
        node.start();
        started = true;
      }
    },

    setRate(hz) {
      node.frequency.value =
        validate(hz, 0.1, 15, "Rate");
    },

    setDepth(amount) {
      node.depth.value =
        validate(amount, 0, 1, "Depth");
    },

    setWet(amount) {
      wetMix = validate(amount, 0, 1, "Wet mix");
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
