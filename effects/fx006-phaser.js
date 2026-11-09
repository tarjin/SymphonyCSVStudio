import { Phaser } from "tone";

export function createPhaser() {
  const node = new Phaser({
    frequency: 0.6,
    octaves: 4,
    baseFrequency: 350,
    Q: 8,
    stages: 10,
    wet: 0.7
  });

  let wetMix = 0.7;
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
        validate(hz, 0.05, 10, "Rate");
    },

    setOctaves(value) {
      node.octaves =
        validate(value, 1, 8, "Octaves");
    },

    setBaseFrequency(hz) {
      node.baseFrequency =
        validate(hz, 100, 2000, "Base frequency");
    },

    setResonance(value) {
      node.Q.value =
        validate(value, 0.1, 20, "Resonance");
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
