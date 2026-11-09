import { Vibrato } from "tone";

export function createVibrato() {
  const node = new Vibrato({
    frequency: 5,
    depth: 0.35,
    type: "sine",
    wet: 0.8
  });

  let wetMix = 0.8;
  let bypassed = false;

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

    setRate(hz) {
      node.frequency.value =
        validate(hz, 0.1, 12, "Rate");
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
