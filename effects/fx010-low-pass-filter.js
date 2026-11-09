import { ToneAudioNode, Gain, Filter, CrossFade } from "tone";

class LowPassProcessor extends ToneAudioNode {
  name = "SymphonyLowPass";

  constructor() {
    super();

    this.input = new Gain(1);
    this.output = new Gain(1);

    this.filter = new Filter({
      type: "lowpass",
      frequency: 1200,
      Q: 1,
      rolloff: -24
    });

    this.mixer = new CrossFade(1);
    this.savedWet = 1;
    this.bypassed = false;

    // Unfiltered signal.
    this.input.connect(this.mixer.a);

    // Filtered signal.
    this.input.connect(this.filter);
    this.filter.connect(this.mixer.b);

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

  setCutoff(hz) {
    this.filter.frequency.rampTo(
      this.validate(hz, 80, 12000, "Cutoff"), 0.05
    );
  }

  setResonance(value) {
    this.filter.Q.value =
      this.validate(value, 0.1, 12, "Resonance");
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
    this.filter.dispose();
    this.mixer.dispose();
    this.input.dispose();
    this.output.dispose();
    return this;
  }
}

export function createLowPassFilter() {
  const node = new LowPassProcessor();

  return {
    node,
    setCutoff: value => node.setCutoff(value),
    setResonance: value => node.setResonance(value),
    setWet: value => node.setWet(value),
    setBypass: value => node.setBypass(value),
    dispose: () => node.dispose()
  };
}
