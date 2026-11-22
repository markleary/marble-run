const clips = ['gate', 'roll-lacquer', 'roll-timber', 'contact', 'bell'] as const;
type Clip = typeof clips[number];

export class RaceSound {
  private context?: AudioContext;
  private output?: GainNode;
  private buffers = new Map<Clip, AudioBuffer>();
  private loops: { source: AudioBufferSourceNode; gain: GainNode }[] = [];
  private enabled = true;
  private lastContact = -1;

  unlock() {
    if (!this.context) {
      try {
        this.context = new AudioContext();
        this.output = this.context.createGain();
        this.output.gain.value = this.enabled ? 0.72 : 0;
        this.output.connect(this.context.destination);
        void Promise.all(clips.map(async clip => {
          const response = await fetch(import.meta.env.BASE_URL + 'audio/' + clip + '.mp3');
          if (response.ok) this.buffers.set(clip, await this.context!.decodeAudioData(await response.arrayBuffer()));
        })).catch(() => {});
      } catch { return; }
    }
    if (this.context.state === 'suspended') void this.context.resume().catch(() => {});
  }

  enable(value: boolean) {
    this.enabled = value;
    if (this.context && this.output) this.output.gain.setTargetAtTime(value ? 0.72 : 0, this.context.currentTime, 0.025);
  }

  play(clip: 'contact' | 'gate' | 'bell', volume = 1) {
    const context = this.context;
    const buffer = this.buffers.get(clip);
    if (!this.enabled || !context || !buffer || !this.output) return;
    if (clip === 'contact') {
      if (context.currentTime - this.lastContact < 0.18) return;
      this.lastContact = context.currentTime;
    }
    const source = context.createBufferSource();
    const gain = context.createGain();
    source.buffer = buffer;
    source.playbackRate.value = clip === 'contact' ? 0.92 + Math.random() * 0.18 : 1;
    gain.gain.value = Math.min(1, volume);
    source.connect(gain).connect(this.output);
    source.onended = () => { source.disconnect(); gain.disconnect(); };
    source.start();
  }

  rolling(speed: number, wood: number) {
    const context = this.context;
    if (!context || !this.output || !this.enabled || speed < 0.02) { this.stopRolling(); return; }
    if (!this.loops.length) {
      const buffers = [this.buffers.get('roll-lacquer'), this.buffers.get('roll-timber')];
      if (!buffers.every(Boolean)) return;
      for (const buffer of buffers) {
        const source = context.createBufferSource();
        const gain = context.createGain();
        source.buffer = buffer!;
        source.loop = true;
        gain.gain.value = 0;
        source.connect(gain).connect(this.output);
        source.start();
        this.loops.push({ source, gain });
      }
    }
    this.loops.forEach(({ source, gain }, index) => {
      gain.gain.setTargetAtTime((index ? wood : 1 - wood) * Math.min(0.4, speed * 0.1), context.currentTime, 0.15);
      source.playbackRate.setTargetAtTime(Math.min(1.8, 0.65 + speed * 0.16), context.currentTime, 0.12);
    });
  }

  stopRolling() {
    for (const { source, gain } of this.loops) {
      source.stop();
      source.disconnect();
      gain.disconnect();
    }
    this.loops = [];
  }
}
