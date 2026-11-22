import type { CourseId } from './courses/catalog';

const clips = ['gate', 'roll-lacquer', 'roll-timber', 'roll-ice', 'roll-wire', 'contact', 'bell'] as const;
type Clip = typeof clips[number];
type RollClip = Extract<Clip, `roll-${string}`>;
interface Loop { source: AudioBufferSourceNode; gain: GainNode }

// The scores are mastered to the same loudness. Keep them around 21 dB below
// that level, with further momentary headroom for gate, impact and finish cues.
const MUSIC_GAIN = 0.09;
const MASTER_GAIN = 0.72;
// Match quieter recordings of wood, ice and wire to the lacquer bed.
const rollingSurfaces: { clip: RollClip; trim: number }[] = [
  { clip: 'roll-lacquer', trim: 1 },
  { clip: 'roll-timber', trim: 1.5 },
  { clip: 'roll-ice', trim: 2.5 },
  { clip: 'roll-wire', trim: 2 },
];

export class RaceSound {
  private context?: AudioContext;
  private output?: GainNode;
  private buffers = new Map<Clip, AudioBuffer>();
  private rollingLoops = new Map<RollClip, Loop>();
  private enabled = true;
  private paused = false;
  private lastContact = -1;
  private course?: CourseId;
  private music?: Loop;
  private musicLoad?: { course: CourseId; buffer: Promise<AudioBuffer> };
  private musicRequest = 0;

  private async load(name: string, context: AudioContext) {
    const response = await fetch(import.meta.env.BASE_URL + 'audio/' + name + '.mp3');
    if (!response.ok) throw new Error('Could not load audio: ' + name);
    return context.decodeAudioData(await response.arrayBuffer());
  }

  unlock() {
    if (!this.enabled) return;
    if (!this.context) {
      try {
        const context = new AudioContext();
        this.context = context;
        this.output = context.createGain();
        this.output.gain.value = MASTER_GAIN;
        this.output.connect(context.destination);
        for (const clip of clips) {
          void this.load(clip, context).then(buffer => this.buffers.set(clip, buffer)).catch(() => {});
        }
        void this.syncMusic();
      } catch { return; }
    }
    if (!this.paused && this.context.state !== 'running') void this.context.resume().catch(() => {});
  }

  enable(value: boolean) {
    this.enabled = value;
    if (this.context && this.output) {
      this.output.gain.setTargetAtTime(value ? MASTER_GAIN : 0, this.context.currentTime, 0.015);
    }
    if (value) void this.syncMusic();
    else {
      this.stopMusicSource();
      this.stopRolling();
    }
  }

  setPaused(value: boolean) {
    this.paused = value;
    if (!this.context) return;
    if (value) {
      this.stopRolling();
      void this.context.suspend().catch(() => {});
    } else if (this.enabled) {
      void this.context.resume().catch(() => {});
      void this.syncMusic();
    }
  }

  startMusic(course: CourseId) {
    this.stopMusicSource();
    this.course = course;
    void this.syncMusic();
  }

  stopMusic() {
    this.course = undefined;
    this.stopMusicSource();
  }

  private stopMusicSource() {
    ++this.musicRequest;
    const loop = this.music;
    this.music = undefined;
    if (!this.context || !loop) return;
    const now = this.context.currentTime;
    loop.gain.gain.cancelScheduledValues(now);
    loop.gain.gain.setTargetAtTime(0, now, 0.018);
    loop.source.stop(now + 0.12);
  }

  private async syncMusic() {
    const { context, output, course } = this;
    if (!course || !context || !output || !this.enabled || this.paused || this.music) return;
    const request = ++this.musicRequest;
    if (this.musicLoad?.course !== course) {
      // Retain just the selected score's decoded audio for instant rematches.
      this.musicLoad = { course, buffer: this.load('music-' + course, context) };
    }
    const asset = this.musicLoad;
    let buffer: AudioBuffer;
    try { buffer = await asset.buffer; } catch {
      if (this.musicLoad === asset) this.musicLoad = undefined;
      return;
    }
    if (this.musicRequest !== request || this.paused) return;
    const source = context.createBufferSource();
    const gain = context.createGain();
    source.buffer = buffer;
    source.loop = true;
    source.connect(gain).connect(output);
    gain.gain.value = 0;
    gain.gain.setTargetAtTime(MUSIC_GAIN, context.currentTime, 0.06);
    source.onended = () => { source.disconnect(); gain.disconnect(); };
    source.start();
    this.music = { source, gain };
  }

  play(clip: 'contact' | 'gate' | 'bell', volume = 1) {
    const context = this.context;
    const buffer = this.buffers.get(clip);
    if (!this.enabled || this.paused || !context || !buffer || !this.output) return;
    if (clip === 'contact') {
      if (context.currentTime - this.lastContact < 0.18) return;
      this.lastContact = context.currentTime;
    }
    if (this.music) {
      const level = this.music.gain.gain;
      const now = context.currentTime;
      level.cancelScheduledValues(now);
      level.setTargetAtTime(MUSIC_GAIN * 0.45, now, 0.012);
      level.setTargetAtTime(MUSIC_GAIN, now + (clip === 'bell' ? 0.45 : 0.15), 0.1);
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

  rolling(speed: number, wood: number, ice: number, wire = 0) {
    const context = this.context;
    if (!context || !this.output || !this.enabled || this.paused || speed < 0.02) { this.stopRolling(); return; }
    const blend = [Math.max(0, 1 - wood - ice - wire), wood, ice, wire];
    rollingSurfaces.forEach(({clip, trim}, index) => {
      let layer = this.rollingLoops.get(clip);
      if (!layer) {
        const buffer = this.buffers.get(clip);
        if (!buffer || blend[index] <= 0) return;
        const source = context.createBufferSource();
        const gain = context.createGain();
        source.buffer = buffer;
        source.loop = true;
        gain.gain.value = 0;
        source.connect(gain).connect(this.output!);
        source.start();
        layer = { source, gain };
        this.rollingLoops.set(clip, layer);
      }
      layer.gain.gain.setTargetAtTime(trim * blend[index] * Math.min(0.4, speed * 0.1), context.currentTime, 0.15);
      layer.source.playbackRate.setTargetAtTime(Math.min(1.8, 0.65 + speed * 0.16), context.currentTime, 0.12);
    });
  }

  stopRolling() {
    for (const { source, gain } of this.rollingLoops.values()) {
      source.stop();
      source.disconnect();
      gain.disconnect();
    }
    this.rollingLoops.clear();
  }
}
