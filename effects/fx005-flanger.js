import { ToneAudioNode, Gain, Delay, LFO, CrossFade } from "tone";

class FlangerProcessor extends ToneAudioNode {
  name = "SymphonyFlanger";

  constructor() {
    super();

    this.input = new Gain(1);
    this.output = new Gain(1);

    // Very short delay, modulated by an oscillator.
    this.delay = new Delay({
      delayTime: 0.004,
      maxDelay: 0.03
    });

    // Keep feedback below unity for stability.
    this.feedbackGain = new Gain(0.25);

    // Equal-power dry/wet mixer.
    this.mixer = new CrossFade(0.65);

    this.lfo = new LFO({
      frequency: 0.35,
      min: 0.001,
      max: 0.008,
      amplitude: 0.8
    });

    // Dry signal path.
    this.input.connect(this.mixer.a);

    // Wet signal path with feedback.
    this.input.connect(this.delay);
    this.delay.connect(this.mixer.b);
    this.delay.connect(this.feedbackGain);
    this.feedbackGain.connect(this.delay);

    // Modulate the short delay time.
    this.lfo.connect(this.delay.delayTime);

    // Final mixed output.
    this.mixer.connect(this.output);

    this.started = false;
  }

  start() {
    if (!this.started) {
      this.lfo.start();
      this.started = true;
    }
    return this;
  }

  setRate(hz) {
    const value = Number(hz);
    if (!Number.isFinite(value) ||
        value < 0.05 || value > 5) {
      throw new RangeError("Rate must be 0.05 to 5 Hz.");
    }
    this.lfo.frequency.value = value;
  }

  setDepth(amount) {
    const value = Number(amount);
    if (!Number.isFinite(value) ||
        value < 0 || value > 1) {
      throw new RangeError("Depth must be 0 to 1.");
    }
    this.lfo.amplitude.value = value;
  }

  setFeedback(amount) {
    const value = Number(amount);
    if (!Number.isFinite(value) ||
        value < 0 || value > 0.7) {
      throw new RangeError("Feedback must be 0 to 0.7.");
    }
    this.feedbackGain.gain.value = value;
  }

  setWet(amount) {
    const value = Number(amount);
    if (!Number.isFinite(value) ||
        value < 0 || value > 1) {
      throw new RangeError("Wet mix must be 0 to 1.");
    }
    this.savedWet = value;
    if (!this.bypassed) {
      this.mixer.fade.value = value;
    }
  }

  setBypass(value) {
    this.bypassed = Boolean(value);
    this.mixer.fade.value =
      this.bypassed ? 0 : (this.savedWet ?? 0.65);
  }

  dispose() {
    super.dispose();
    this.lfo.dispose();
    this.feedbackGain.dispose();
    this.delay.dispose();
    this.mixer.dispose();
    this.input.dispose();
    this.output.dispose();
    return this;
  }
}

export function createFlanger() {
  const node = new FlangerProcessor();

  return {
    node,
    start: () => node.start(),
    setRate: value => node.setRate(value),
    setDepth: value => node.setDepth(value),
    setFeedback: value => node.setFeedback(value),
    setWet: value => node.setWet(value),
    setBypass: value => node.setBypass(value),
    dispose: () => node.dispose()
  };
}
