import {
  ToneAudioNode,
  Gain,
  WaveShaper,
  Filter,
  CrossFade
} from "tone";

class OverdriveProcessor extends ToneAudioNode {
  name = "SymphonyOverdrive";

  constructor() {
    super();

    this.input = new Gain(1);
    this.output = new Gain(1);

    this.shaper = new WaveShaper(x => x, 2048);
    this.shaper.oversample = "2x";

    this.toneFilter = new Filter({
      type: "lowpass",
      frequency: 6500,
      rolloff: -12,
      Q: 0.7
    });

    this.outputGain = new Gain(0.7);

    this.mixer = new CrossFade(0.75);

    this.savedWet = 0.75;
    this.bypassed = false;

    // Dry path
    this.input.connect(this.mixer.a);

    // Overdrive path
    this.input.connect(this.shaper);
    this.shaper.connect(this.toneFilter);
    this.toneFilter.connect(this.outputGain);
    this.outputGain.connect(this.mixer.b);

    this.mixer.connect(this.output);

    this.setDrive(0.4);
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

  setDrive(amount) {
    const drive = this.validate(
      amount, 0, 1, "Drive"
    );

    // Soft clipping using a normalized tanh curve.
    // Drive 0 is linear; Drive 1 gives strong saturation.
    this.shaper.setMap(x => {
      if (drive === 0) return x;

      const strength = 1 + drive * 14;
      const saturated =
        Math.tanh(strength * x) /
        Math.tanh(strength);

      return (1 - drive) * x +
        drive * saturated;
    }, 2048);
  }

  setTone(hz) {
    this.toneFilter.frequency.value =
      this.validate(hz, 800, 12000, "Tone");
  }

  setLevel(amount) {
    this.outputGain.gain.value =
      this.validate(amount, 0, 1, "Output Level");
  }

  setOversample(value) {
    if (!["none", "2x", "4x"].includes(value)) {
      throw new RangeError(
        "Oversampling must be none, 2x or 4x."
      );
    }

    this.shaper.oversample = value;
  }

  setWet(amount) {
    this.savedWet = this.validate(
      amount, 0, 1, "Wet mix"
    );

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
    this.shaper.dispose();
    this.toneFilter.dispose();
    this.outputGain.dispose();
    this.mixer.dispose();
    this.input.dispose();
    this.output.dispose();
    return this;
  }
}

export function createOverdrive() {
  const node = new OverdriveProcessor();

  return {
    node,
    setDrive: value => node.setDrive(value),
    setTone: value => node.setTone(value),
    setLevel: value => node.setLevel(value),
    setOversample: value => node.setOversample(value),
    setWet: value => node.setWet(value),
    setBypass: value => node.setBypass(value),
    dispose: () => node.dispose()
  };
}
