import BasePlugin from "../../libs/BasePlugin.js";

/**
 * ToneBoosterPlugin
 *
 * Encore Karaoke vocal-chain plugin providing:
 * - Master Gain: 0–200 %
 * - Bass: -12 to +12 dB
 * - Treble: -12 to +12 dB
 * - Boost: 0 to +12 dB
 *
 * Signal path:
 * input -> bass EQ -> treble EQ -> boost gain -> limiter -> master gain -> output
 */
export default class ToneBoosterPlugin extends BasePlugin {
  constructor(audioContext) {
    super(audioContext);

    this.name = "Tone Booster";

    this.bassFilter = this.audioContext.createBiquadFilter();
    this.bassFilter.type = "lowshelf";
    this.bassFilter.frequency.value = 120;
    this.bassFilter.gain.value = 0;

    this.trebleFilter = this.audioContext.createBiquadFilter();
    this.trebleFilter.type = "highshelf";
    this.trebleFilter.frequency.value = 6000;
    this.trebleFilter.gain.value = 0;

    this.boostGain = this.audioContext.createGain();
    this.boostGain.gain.value = 1;

    this.limiter = this.audioContext.createDynamicsCompressor();
    this.limiter.threshold.value = -3;
    this.limiter.knee.value = 0;
    this.limiter.ratio.value = 20;
    this.limiter.attack.value = 0.003;
    this.limiter.release.value = 0.15;

    this.masterGain = this.audioContext.createGain();
    this.masterGain.gain.value = 1;

    this.parameters = {
      master_gain: {
        type: "slider",
        min: 0,
        max: 2,
        step: 0.01,
        unit: "x",
        value: 1.0,
      },
      bass: {
        type: "slider",
        min: -12,
        max: 12,
        step: 0.5,
        unit: "dB",
        value: 0,
      },
      treble: {
        type: "slider",
        min: -12,
        max: 12,
        step: 0.5,
        unit: "dB",
        value: 0,
      },
      boost: {
        type: "slider",
        min: 0,
        max: 12,
        step: 0.5,
        unit: "dB",
        value: 0,
      },
    };

    this.input
      .connect(this.bassFilter)
      .connect(this.trebleFilter)
      .connect(this.boostGain)
      .connect(this.limiter)
      .connect(this.masterGain)
      .connect(this.output);
  }

  setParameter(key, value) {
    const param = this.parameters[key];
    if (!param) return;

    const numericValue = Number(value);
    if (!Number.isFinite(numericValue)) return;

    const clamped = Math.max(param.min, Math.min(param.max, numericValue));
    param.value = clamped;

    const now = this.audioContext.currentTime;

    switch (key) {
      case "master_gain":
        this.masterGain.gain.setTargetAtTime(clamped, now, 0.01);
        break;

      case "bass":
        this.bassFilter.gain.setTargetAtTime(clamped, now, 0.01);
        break;

      case "treble":
        this.trebleFilter.gain.setTargetAtTime(clamped, now, 0.01);
        break;

      case "boost": {
        const linearGain = Math.pow(10, clamped / 20);
        this.boostGain.gain.setTargetAtTime(linearGain, now, 0.01);
        break;
      }
    }
  }

  disconnect() {
    super.disconnect();

    const nodes = [
      this.bassFilter,
      this.trebleFilter,
      this.boostGain,
      this.limiter,
      this.masterGain,
    ];

    for (const node of nodes) {
      try {
        node.disconnect();
      } catch (_) {}
    }

    try {
      this.output.disconnect();
    } catch (_) {}
  }
}
