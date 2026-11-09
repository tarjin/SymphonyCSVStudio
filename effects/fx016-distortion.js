import { Distortion } from "tone";

export function createDistortion() {
  const node = new Distortion({
    distortion: 0.35,
    oversample: "2x",
    wet: 0.75
  });

  let wetMix = 0.75;
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

    setAmount(amount) {
      node.distortion =
        validate(amount, 0, 1, "Distortion");
    },

    setOversample(value) {
      if (!["none", "2x", "4x"].includes(value)) {
        throw new RangeError(
          "Oversampling must be none, 2x or 4x."
        );
      }

      node.oversample = value;
    },

    setWet(amount) {
      wetMix = validate(amount, 0, 1, "Wet mix");

      if (!bypassed) {
        node.wet.value = wetMix;
      }
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
