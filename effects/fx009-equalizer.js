import { ToneAudioNode, Gain, EQ3, CrossFade } from "tone";

class EqualizerProcessor extends ToneAudioNode {
  name = "SymphonyEqualizer";

  constructor() {
    super();

    this.input = new Gain(1);
    this.output = new Gain(1);

    this.eq = new EQ3({
      low: 0,
      mid: 0,
      high: 0,
      lowFrequency: 400,
      highFrequency: 2500
    });

    this.mixer = new CrossFade(1);
    this.savedWet = 1;
    this.bypassed = false;

    // Dry path
    this.input.connect(this.mixer.a);

    // Equalized path
    this.input.connect(this.eq);
    this.eq.connect(this.mixer.b);

    // Final output
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

  setLow(db) {
    this.eq.low.value =
      this.validate(db, -18, 12, "Bass");
  }

  setMid(db) {
    this.eq.mid.value =
      this.validate(db, -18, 12, "Midrange");
  }

  setHigh(db) {
    this.eq.high.value =
      this.validate(db, -18, 12, "Treble");
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
    this.eq.dispose();
    this.mixer.dispose();
    this.input.dispose();
    this.output.dispose();
    return this;
  }
}

export function createEqualizer() {
  const node = new EqualizerProcessor();

  return {
    node,
    setLow: value => node.setLow(value),
    setMid: value => node.setMid(value),
    setHigh: value => node.setHigh(value),
    setWet: value => node.setWet(value),
    setBypass: value => node.setBypass(value),
    dispose: () => node.dispose()
  };
}
