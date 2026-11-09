import { PingPongDelay } from "tone";

export function createPingPongDelay() {
  const node = new PingPongDelay({
    delayTime: 0.35,
    feedback: 0.4,
    wet: 0.65
  });

  let wetMix = 0.65;
  let bypassed = false;

  return {
    node,

    setDelay(seconds) {
      const value = Number(seconds);
      if (!Number.isFinite(value) || value < 0.1 || value > 0.9) {
        throw new RangeError("Delay must be between 0.1 and 0.9 seconds.");
      }
      node.delayTime.value = value;
    },

    setFeedback(amount) {
      const value = Number(amount);
      if (!Number.isFinite(value) || value < 0 || value > 0.85) {
        throw new RangeError("Feedback must be between 0 and 0.85.");
      }
      node.feedback.value = value;
    },

    setWet(amount) {
      const value = Number(amount);
      if (!Number.isFinite(value) || value < 0 || value > 1) {
        throw new RangeError("Wet mix must be between 0 and 1.");
      }
      wetMix = value;
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
