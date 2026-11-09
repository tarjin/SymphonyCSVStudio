import { AutoWah } from "tone";

export function createAutoWah() {
  const node = new AutoWah({
    baseFrequency: 150,
    octaves: 5,
    sensitivity: -25,
    Q: 6,
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

    setSensitivity(db) {
      node.sensitivity =
        validate(db, -40, 0, "Sensitivity");
    },

    setBaseFrequency(hz) {
      node.baseFrequency =
        validate(hz, 60, 800, "Base frequency");
    },

    setOctaves(value) {
      node.octaves =
        validate(value, 1, 7, "Sweep octaves");
    },

    setResonance(value) {
      node.Q.value =
        validate(value, 0.5, 15, "Resonance");
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
