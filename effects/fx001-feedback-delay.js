import { FeedbackDelay } from "tone";

export function createFeedbackDelay() {
  const node = new FeedbackDelay({
    delayTime: 0.35,
    feedback: 0.35,
    wet: 0.55
  });

  let wetMix = 0.55;
  let bypassed = false;

  return {
    node,
    setDelay(seconds) {
      node.delayTime.value = Number(seconds);
    },
    setFeedback(amount) {
      node.feedback.value = Number(amount);
    },
    setWet(amount) {
      wetMix = Number(amount);
      if (!bypassed) node.wet.value = wetMix;
    },
    setBypass(value) {
      bypassed = Boolean(value);
      node.wet.value = bypassed ? 0 : wetMix;
    }
  };
}
