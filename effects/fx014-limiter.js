import { ToneAudioNode, Gain, Limiter, CrossFade } from "tone";

class LimiterProcessor extends ToneAudioNode {
  name = "SymphonyLimiter";

  constructor() {
    super();

    this.input = new Gain(1);
    this.output = new Gain(1);

    this.limiter = new Limiter({
      threshold: -12
    });

    this.mixer = new CrossFade(1);
    this.savedWet = 1;
    this.bypassed = false;

    // Dry signal path.
    this.input.connect(this.mixer.a);

    // Limited signal path.
    this.input.connect(this.limiter);
    this.limiter.connect(this.mixer.b);

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
    this.limiter.threshold.value =
      this.validate(db, -40, 0, "Threshold");
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

  getReduction() {
    return this.limiter.reduction;
  }

  dispose() {
    super.dispose();
    this.limiter.dispose();
    this.mixer.dispose();
    this.input.dispose();
    this.output.dispose();
    return this;
  }
}

export function createLimiter() {
  const node = new LimiterProcessor();

  return {
    node,
    setThreshold: value => node.setThreshold(value),
    setWet: value => node.setWet(value),
    setBypass: value => node.setBypass(value),
    getReduction: () => node.getReduction(),
    dispose: () => node.dispose()
  };
}
