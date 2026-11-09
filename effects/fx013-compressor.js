import { ToneAudioNode, Gain, Compressor, CrossFade } from "tone";

class CompressorProcessor extends ToneAudioNode {
  name = "SymphonyCompressor";

  constructor() {
    super();

    this.input = new Gain(1);
    this.output = new Gain(1);

    this.compressor = new Compressor({
      threshold: -28,
      ratio: 4,
      attack: 0.01,
      release: 0.2,
      knee: 10
    });

    this.mixer = new CrossFade(1);
    this.savedWet = 1;
    this.bypassed = false;

    // Uncompressed signal.
    this.input.connect(this.mixer.a);

    // Compressed signal.
    this.input.connect(this.compressor);
    this.compressor.connect(this.mixer.b);

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
    this.compressor.threshold.value =
      this.validate(db, -60, 0, "Threshold");
  }

  setRatio(value) {
    this.compressor.ratio.value =
      this.validate(value, 1, 20, "Ratio");
  }

  setAttack(seconds) {
    this.compressor.attack.value =
      this.validate(seconds, 0.001, 0.5, "Attack");
  }

  setRelease(seconds) {
    this.compressor.release.value =
      this.validate(seconds, 0.01, 1, "Release");
  }

  setKnee(db) {
    this.compressor.knee.value =
      this.validate(db, 0, 40, "Knee");
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
    return this.compressor.reduction;
  }

  dispose() {
    super.dispose();
    this.compressor.dispose();
    this.mixer.dispose();
    this.input.dispose();
    this.output.dispose();
    return this;
  }
}

export function createCompressor() {
  const node = new CompressorProcessor();

  return {
    node,
    setThreshold: v => node.setThreshold(v),
    setRatio: v => node.setRatio(v),
    setAttack: v => node.setAttack(v),
    setRelease: v => node.setRelease(v),
    setKnee: v => node.setKnee(v),
    setWet: v => node.setWet(v),
    setBypass: v => node.setBypass(v),
    getReduction: () => node.getReduction(),
    dispose: () => node.dispose()
  };
}
