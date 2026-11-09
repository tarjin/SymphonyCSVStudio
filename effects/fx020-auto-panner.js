import { AutoPanner } from "tone";

export function createAutoPanner() {
  const node = new AutoPanner({
    frequency: 0.5,
    depth: 0.8,
    type: "sine",
    wet: 1
  }).start();

  let savedWet = 1;
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

    setRate(value) {
      node.frequency.value = validate(
        value, 0.05, 15, "Rate"
      );
    },

    setDepth(value) {
      node.depth.value = validate(
        value, 0, 1, "Depth"
      );
    },

    setWaveform(value) {
      if (!["sine", "triangle", "square"].includes(value)) {
        throw new RangeError(
          "Waveform must be sine, triangle or square."
        );
      }

      node.type = value;
    },

    setWet(value) {
      savedWet = validate(
        value, 0, 1, "Wet mix"
      );

      if (!bypassed) {
        node.wet.value = savedWet;
      }
    },

    setBypass(value) {
      bypassed = Boolean(value);
      node.wet.value =
        bypassed ? 0 : savedWet;
    },

    dispose() {
      node.stop();
      node.dispose();
    }
  };
}
