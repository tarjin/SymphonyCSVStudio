import { ToneAudioNode, Gain, Gate, CrossFade } from "tone";

class NoiseGateProcessor extends ToneAudioNode {
  name = "SymphonyNoiseGate";

  constructor() {
    super();

    this.input = new Gain(1);
    this.output = new Gain(1);

    this.gate = new Gate({
      threshold: -35,
      smoothing: 0.08
    });

    this.mixer = new CrossFade(1);
    this.savedWet = 1;
    this.bypassed = false;

    // Dry signal path.
    this.input.connect(this.mixer.a);

    // Noise-gated signal path.
    this.input.connect(this.gate);
    this.gate.connect(this.mixer.b);

    // Final output.
    this.mixer.connect(this.output);
  }

  validate(value, min, max, label) {
    const number = Number(value);

    if (!Number.isFinite(number) ||
        number < min || number > max) {
      throw new RangeError(
        `${label} must be between ${min} and ${max}.`
      );
    }

    return number;
  }

  setThreshold(db) {
    this.gate.threshold =
      this.validate(db, -70, -10, "Threshold");
  }

  setSmoothing(seconds) {
    this.gate.smoothing =
      this.validate(seconds, 0.01, 0.5, "Smoothing");
  }

  setWet(amount) {
    this.savedWet =
      this.validate(amount, 0, 1, "Wet mix");

    if (!this.bypassed) {
      this.mixer.fade.value = this.savedWet;
    }
  }

  setBypass(value) {
    this.bypassed = Boolean(value);
    this.mixer.fade.value =
      this.bypassed ? 0 : this.savedWet;
  }

  dispose() {
    super.dispose();
    this.gate.dispose();
    this.mixer.dispose();
    this.input.dispose();
    this.output.dispose();
    return this;
  }
}

export function createNoiseGate() {
  const node = new NoiseGateProcessor();

  return {
    node,
    setThreshold: value => node.setThreshold(value),
    setSmoothing: value => node.setSmoothing(value),
    setWet: value => node.setWet(value),
    setBypass: value => node.setBypass(value),
    dispose: () => node.dispose()
  };
}
