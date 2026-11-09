import { PitchShift } from "tone";

export function createPitchShift() {
  const node = new PitchShift({
    pitch: 7,
    windowSize: 0.08,
    feedback: 0,
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

    setPitch(value) {
      const semitones = validate(
        value, -12, 12, "Pitch"
      );

      if (!Number.isInteger(semitones)) {
        throw new RangeError(
          "Pitch must be a whole number of semitones."
        );
      }

      node.pitch = semitones;
    },

    setWindowSize(value) {
      node.windowSize = validate(
        value, 0.03, 0.1, "Window Size"
      );
    },

    setFeedback(value) {
      node.feedback.value = validate(
        value, 0, 0.5, "Feedback"
      );
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
      node.wet.value = bypassed ? 0 : savedWet;
    },

    getPitch() {
      return node.pitch;
    },

    dispose() {
      node.dispose();
    }
  };
}
