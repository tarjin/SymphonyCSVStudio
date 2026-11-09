import { BitCrusher } from "tone";

export function createBitcrusher() {
  const node = new BitCrusher({
    bits: 8,
    wet: 0.75
  });

  let savedWet = 0.75;
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

    setBits(value) {
      const bits = validate(
        value, 1, 16, "Bit depth"
      );

      if (!Number.isInteger(bits)) {
        throw new RangeError(
          "Bit depth must be a whole number."
        );
      }

      node.bits.value = bits;
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

    getBits() {
      return node.bits.value;
    },

    dispose() {
      node.dispose();
    }
  };
}
