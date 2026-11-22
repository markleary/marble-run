// “Chalk & Gravity” — a 64-bar score for Crux Mountain Masters.
// Render the arrangement on a circular tape so instrument releases and room
// reflections from the last bar are already ringing at the first downbeat.
import { writeFile } from 'node:fs/promises';

const rate = 44100;
const beat = .5;
const frames = 64 * 4 * beat * rate;
const tau = 2 * Math.PI;
const pitch = midi => 440 * 2 ** ((midi - 69) / 12);
const wave = cycles => Math.sin(tau * cycles);

// Bass root, right-hand chord voicing and four hook tones for each harmony.
const harmony = {
  d: [38, [53, 57, 60, 64], [69, 72, 74, 77]],       // Dm9
  b: [34, [53, 57, 60, 62], [69, 72, 74, 77]],       // Bbmaj9
  f: [41, [52, 55, 57, 60], [67, 69, 72, 76]],       // Fmaj9
  c: [36, [52, 55, 60, 62], [67, 72, 74, 76]],       // Cadd9
  g: [31, [53, 57, 58, 62], [65, 69, 70, 74]],       // Gm9
  a: [33, [52, 55, 57, 61], [67, 69, 73, 76]],       // A7
};
// Eight bars per phrase. The quiet middle passage rebuilds to the last hook.
const phrases = [
  'ddbbffca', 'ddbbgcca', 'bfcdgbca', 'bfcdgbca',
  'ggddbbca', 'gdbfgbca', 'bfcdgbca', 'ddbbffca',
];
// [beat, tone in chord, duration in beats] — a short reach and a long landing.
const reach = [[.5, 0, .44], [1.25, 1, .21], [1.5, 2, .8], [2.75, 1, .25], [3, 0, .70]];
const answer = [[0, 2, .68], [.75, 3, .43], [1.5, 2, .65], [2.5, 0, 1.16]];
const crest = [[0, 2, 1.15], [1.5, 3, .74], [2.5, 2, .31], [3, 1, .76]];
const breath = [[.5, 1, 1.1], [2.25, 2, 1.24]];

export async function renderCruxScore(path) {
  const left = new Float32Array(frames), right = new Float32Array(frames);
  const room = new Float32Array(frames);
  let state = 0x43525558;
  const random = () => (state = (Math.imul(state, 1664525) + 1013904223) >>> 0) / 0x100000000;

  function play(at, seconds, level, pan, send, voice) {
    const start = Math.round(at * beat * rate);
    const l = level * Math.sqrt((1 - pan) / 2), r = level * Math.sqrt((1 + pan) / 2);
    for (let i = 0, count = Math.ceil(seconds * rate); i < count; i++) {
      const atFrame = (start + i) % frames;
      const sample = voice(i / rate) * Math.min(1, i / 36, (count - i) / 160);
      left[atFrame] += l * sample;
      right[atFrame] += r * sample;
      room[atFrame] += send * level * sample;
    }
  }

  function bass(at, note, length, amplitude) {
    const f = pitch(note), hold = length * beat;
    play(at, hold + .14, amplitude, -.04, .035, t => {
      const sustain = Math.exp(-t * 1.7 - Math.max(0, t - hold) * 42);
      const string = .84 * wave(f * t) + .35 * wave(2 * f * t) + .17 * wave(3.002 * f * t);
      return sustain * (string + .23 * Math.exp(-t * 13) * wave(5 * f * t));
    });
  }

  function keys(at, note, length, amplitude, pan) {
    const f = pitch(note), hold = length * beat;
    play(at, hold + .55, amplitude, pan, .22, t =>
      (1 - Math.exp(-t * 115)) * Math.exp(-1.4 * t - 8 * Math.max(0, t - hold))
      * Math.sin(tau * f * t + .85 * Math.exp(-4 * t) * wave(2 * f * t)));
  }

  function mallet(at, note, length, amplitude, pan) {
    const f = pitch(note), hold = length * beat;
    play(at, hold + .43, amplitude, pan, .25, t =>
      Math.exp(-2.4 * t - 10 * Math.max(0, t - hold)) *
      (wave(f * t) + .29 * Math.exp(-4 * t) * wave(2.001 * f * t)
        + .30 * Math.exp(-16 * t) * wave(3.97 * f * t)
        + .10 * Math.exp(-26 * t) * wave(7.92 * f * t)));
  }

  function drums(at, kind, amplitude, pan = 0, tuning = 95) {
    let low = 0, previous = 0;
    const length = { kick: .31, snare: .22, shaker: .09, tom: .45 }[kind];
    play(at, length, amplitude, pan, kind === 'kick' ? .02 : .22, t => {
      const noise = 2 * random() - 1;
      low += .28 * (noise - low);
      const high = noise - previous;
      previous = noise;
      if (kind === 'kick') return Math.exp(-t * 12) * wave(48 * t + .94 * (1 - Math.exp(-55 * t)));
      if (kind === 'tom') return Math.exp(-t * 8) * (wave(tuning * t + .62 * (1 - Math.exp(-25 * t)))
        + .38 * wave(1.53 * tuning * t) * Math.exp(-t * 8));
      if (kind === 'shaker') return high * Math.sin(Math.PI * t / length) ** 2 * Math.exp(-23 * t);
      return .52 * Math.exp(-28 * t) * wave(183 * t + .24 * (1 - Math.exp(-57 * t)))
        + (low + .26 * high) * Math.exp(-22 * t);
    });
  }

  for (let bar = 0; bar < 64; bar++) {
    const section = Math.floor(bar / 8), within = bar % 8, at = bar * 4;
    const [root, voicing, tones] = harmony[phrases[section][within]];
    const sparse = section === 4, full = [2, 3, 6].includes(section);
    for (const offset of sparse ? [0, 2.5] : [0, 1.5, 2.75, 3.5]) {
      const note = offset === 1.5 ? root + 7 : offset === 3.5 ? root + 12 : root;
      bass(at + offset, note, offset === 0 ? 1.08 : .38, offset === 0 ? .45 : .34);
    }
    for (const offset of sparse ? [0] : [.75, 2.25]) {
      voicing.forEach((note, index) => keys(at + offset + .011 * index, note, sparse ? 2.8 : .64,
        sparse ? .095 : .084, -.48 + .28 * index));
    }
    const melody = sparse ? breath : full && within % 4 < 2 ? crest : within % 2 ? answer : reach;
    for (const [offset, degree, length] of melody) {
      mallet(at + offset, tones[degree] - (sparse ? 12 : 0), length,
        offset % 1 === 0 ? .30 : .25, .12);
    }
    if (full || section === 5 && within >= 4) {
      // A lower, muted reply threads through rests in the main mallet line.
      for (const [offset, degree] of [[.75, 0], [1.75, 2], [3.5, 1]]) {
        keys(at + offset, tones[degree] - 12, .37, .16, -.35);
      }
    }
    for (const offset of sparse ? [0] : [0, 2, ...(full && within % 2 ? [2.75] : [])]) {
      drums(at + offset, 'kick', offset === 0 ? .64 : .48);
    }
    for (const offset of sparse ? [2] : [1.013, 3.016]) drums(at + offset, 'snare', sparse ? .25 : .48, -.12);
    for (let h = 0; h < (sparse ? 4 : 8); h++) {
      drums(at + h * (sparse ? 1 : .5) + (h % 2 ? .017 : 0), 'shaker', h % 2 ? .13 : .08, .32);
    }
    if (within % 4 === 3 || full && within % 2 === 0) {
      const fill = within === 7 ? [[2.5, 149], [3.25, 118], [3.5, 98], [3.75, 78]]
        : [[2.5, 118], [3.5, 88]];
      for (const [offset, note] of fill) drums(at + offset, 'tom', sparse ? .21 : .31, (note - 108) / 120, note);
    }
  }

  // Short stereo reflections leave space for the gate, rolling noise and bell.
  for (const [channel, delay, gain] of [
    [left, .031, .50], [right, .046, .47], [left, .117, .34], [right, .177, .30],
    [left, .372, .22], [right, .377, .17], [left, .738, .07], [right, .749, .09],
  ]) {
    const offset = Math.round(delay * rate);
    for (let i = 0; i < frames; i++) channel[(i + offset) % frames] += gain * room[i];
  }
  const stereo = new Float32Array(frames * 2);
  for (let i = 0; i < frames; i++) {
    stereo[2 * i] = left[i];
    stereo[2 * i + 1] = right[i];
  }
  await writeFile(path, new Uint8Array(stereo.buffer));
}
