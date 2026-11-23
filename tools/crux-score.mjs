import { writeFile } from 'node:fs/promises';

export const cruxScoreTitle = 'Five Holds Left';
const sampleRate = 44100;
const beat = 60 / 140;
const tau = 2 * Math.PI;
const pitch = note => 440 * 2 ** ((note - 69) / 12);

// Each letter is one bar. The thinner middle eight and the drum build leave
// headroom for a second, higher guitar to answer the hook in the final section.
const arrangement = [
  ['riff',  'eegaeecb'], ['drive', 'eegaeecb'], ['drive', 'eegdacdb'],
  ['climb', 'cdeecadb'], ['hook',  'gdecgacb'], ['hook',  'gdeccadb'],
  ['break', 'aacdeecb'], ['build', 'aacdcadb'], ['climb', 'cdeecadb'],
  ['peak',  'gdecgacb'], ['peak',  'gdeccadb'], ['peak',  'eegaeecb'],
  ['turn',  'eegdacdb'],
];
const roots = { e: 40, g: 43, a: 45, c: 48, d: 50, b: 47 };
const tones = {
  e: [64, 67, 69, 71, 74], g: [67, 69, 71, 74, 76], a: [64, 67, 69, 72, 76],
  c: [64, 67, 69, 72, 74], d: [66, 69, 71, 74, 76], b: [63, 66, 69, 71, 75],
};
// Beat, melody tone and note length. The low pickup answers on the other guitar.
const climb = [[.50, 0, .32], [1, 1, .37], [1.75, 2, .26], [2, 3, 1.17], [3.5, 1, .36]];
const hook = [[0, 3, 1.22], [1.50, 4, .76], [2.5, 3, .40], [3.25, 1, .61]];
const answer = [[.25, 1, .60], [1.25, 0, .37], [1.75, 2, .22], [2, 3, 1.45]];
const barCount = arrangement.reduce((count, [, bars]) => count + bars.length, 0);
const frames = Math.round(barCount * 4 * beat * sampleRate);

// A plucked string, excited at the pick position and read through a fractional
// delay line. The short moving delay at the front of a lead note bends it up.
function pickedString(hz, seconds, damping, bend, vibrato, random) {
  const period = sampleRate / hz - .38;
  const length = Math.ceil(period * 1.22) + 3;
  const string = new Float32Array(length);
  const attack = .10 + .16 * random(), pickNoise = .045 + .035 * random();
  for (let i = 0; i < length; i++) {
    const phase = (i % period) / period;
    const triangle = phase < attack ? phase / attack : (1 - phase) / (1 - attack);
    string[i] = 2 * triangle - 1 + pickNoise * (2 * random() - 1);
  }
  let cursor = 0, previous = 0;
  const feedback = Math.exp(-1 / (hz * seconds));
  return t => {
    const bendAmount = bend * Math.exp(-20 * t);
    const vibratoAmount = vibrato * Math.min(1, Math.max(0, (t - .16) * 5)) * Math.sin(tau * 5.3 * t);
    let read = cursor - period * (1 + bendAmount + vibratoAmount);
    if (read < 0) read += length;
    const index = Math.floor(read), fraction = read - index;
    const next = index + 1 === length ? 0 : index + 1;
    const value = string[index] + (string[next] - string[index]) * fraction;
    string[cursor] = feedback * (value + damping * (previous - value));
    cursor = cursor + 1 === length ? 0 : cursor + 1;
    previous = value;
    return value;
  };
}

export async function renderCruxScore(path) {
  const left = new Float32Array(frames), right = new Float32Array(frames);
  const guitarLeft = new Float32Array(frames), guitarRight = new Float32Array(frames);
  const lead = new Float32Array(frames), room = new Float32Array(frames);
  let seed = 0x484f4c44;
  const random = () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 0x100000000;

  function play(at, seconds, level, bus, pan, send, voice) {
    const start = Math.round(at * beat * sampleRate);
    const gains = [Math.sqrt((1 - pan) / 2), Math.sqrt((1 + pan) / 2)];
    const count = Math.ceil(seconds * sampleRate);
    for (let i = 0; i < count; i++) {
      const frame = (start + i) % frames;
      const value = level * voice(i / sampleRate) * Math.min(1, i / 28, (count - i) / 95);
      if (bus) bus[frame] += value;
      else {
        left[frame] += gains[0] * value;
        right[frame] += gains[1] * value;
        room[frame] += send * value;
      }
    }
  }

  function stringNote(at, note, duration, level, bus, style = 'open', bend = false) {
    const bass = bus === null, muted = style === 'mute', singing = bus === lead;
    const detune = bus === guitarLeft ? .9984 : bus === guitarRight ? 1.0016 : 1;
    const hold = duration * beat, release = muted ? .045 : singing ? .17 : .10;
    const string = pickedString(pitch(note) * detune, muted ? .18 : bass ? 1.5 : 2.1,
      muted ? .48 : .31, bend ? .106 : 0, singing ? .0048 : 0, random);
    play(at, hold + release, level, bus, -.035, bass ? .022 : 0, t => {
      const tail = Math.exp(-3.9 * Math.max(0, t - hold) / release);
      // A short finger/pick stroke resolves into the clean string fundamental.
      return string(t) * tail * (1 - Math.exp(-(bass ? 680 : 1100) * t));
    });
  }

  function drum(at, kind, level, pan = 0, tune = 100) {
    const seconds = { kick: .32, snare: .24, hat: .063, open: .23, tom: .44, crash: .95 }[kind];
    let colored = 0, previous = 0;
    play(at, seconds, level, null, pan, kind === 'kick' ? .035 : .24, t => {
      const noise = 2 * random() - 1;
      colored += .31 * (noise - colored);
      const high = noise - previous;
      previous = noise;
      if (kind === 'kick') return Math.exp(-13 * t) * Math.sin(tau * (47 * t + .84 * (1 - Math.exp(-72 * t))))
        + .085 * high * Math.exp(-155 * t);
      if (kind === 'snare') return .54 * Math.exp(-26 * t) * Math.sin(tau * (187 * t + .29 * (1 - Math.exp(-62 * t))))
        + (.98 * colored + .31 * high) * Math.exp(-19 * t) * (1 + .13 * Math.sin(tau * 38 * t));
      if (kind === 'tom') return Math.exp(-8.4 * t) * (Math.sin(tau * (tune * t + .46 * (1 - Math.exp(-35 * t))))
        + .29 * Math.sin(tau * 1.57 * tune * t) * Math.exp(-5 * t)) + .09 * noise * Math.exp(-48 * t);
      const metal = Math.sin(tau * 2861 * t + .95 * Math.sin(tau * 1779 * t));
      const decay = kind === 'crash' ? 4.9 : kind === 'open' ? 14 : 54;
      return (.44 * high + .18 * metal + .08 * Math.sin(tau * 3977 * t)) * Math.exp(-decay * t);
    });
  }

  let bar = 0;
  for (const [part, changes] of arrangement) {
    for (const [i, chord] of [...changes].entries()) {
      const at = bar++ * 4, root = roots[chord], notes = tones[chord];
      const chorus = part === 'hook' || part === 'peak', breakBar = part === 'break';
      const build = part === 'build', chopped = part === 'riff' || part === 'drive' || part === 'turn';
      const pickup = roots[changes[(i + 1) % changes.length]] - 1;
      // The bass pushes across the kick on offbeats and walks into the next chord.
      const bassLine = breakBar ? [[0, root, 1.35], [1.75, root + 7, .27], [2.5, root + 12, .64], [3.5, pickup, .36]]
        : [[0, root, .61], [.75, root, .20], [1.25, root + (i % 2 ? 7 : 12), .43],
          [2, root, .39], [2.75, root + 7, .43], [3.5, i % 2 ? pickup : root + 10, .37]];
      for (const [offset, midi, length] of bassLine) stringNote(at + offset, midi - 12, length, .55, null);

      // Distinct rhythm takes play either side of the kit. A slight strum and
      // different chord inversions widen the amp image without a stereo delay.
      const strums = breakBar ? (i < 4 ? [] : [[1.5, .19], [3.5, .31]])
        : chorus ? [[0, 1.33], [1.75, .38], [2.5, 1.22]]
        : [[0, .25], [.75, .18], [1.5, .43], [2.5, .22], [3.25, .51]];
      for (const [offset, length] of strums) {
        const mute = length < .5 || build && i < 4;
        stringNote(at + offset, root, length, .50, guitarLeft, mute ? 'mute' : 'open');
        stringNote(at + offset + .015, root + 7, length * .96, .32, guitarLeft, mute ? 'mute' : 'open');
        const lag = .018 + random() * .011;
        stringNote(at + offset + lag, root + (chorus ? 7 : 0), length, .43, guitarRight, mute ? 'mute' : 'open');
        stringNote(at + offset + lag + .014, root + 12, length * .92, .25, guitarRight, mute ? 'mute' : 'open');
      }
      if (chorus || part === 'climb' || chopped && i % 4 >= 2 || build && i >= 4) {
        const phrase = i % 2 ? answer : chorus ? hook : climb;
        for (const [offset, degree, duration] of phrase) {
          stringNote(at + offset, notes[degree], duration, .43, lead, 'open', duration >= .75);
          if (part === 'peak' && i % 2 && degree >= 2) {
            stringNote(at + offset + .035, notes[degree] - 5, duration * .89, .24, guitarRight);
          }
        }
      }

      const kicks = breakBar || build && i < 4 ? [0, 2.75] : i % 2 ? [0, 1.75, 2.5, 3.50] : [0, .75, 2, 2.75];
      for (const offset of kicks) drum(at + offset, 'kick', offset % 1 === 0 ? .65 : .49);
      for (const offset of breakBar || build && i < 4 ? [2] : [1, 3]) drum(at + offset + .012, 'snare', .65, -.13);
      if (i % 2 && !breakBar) {
        drum(at + 1.50, 'snare', .17, -.17);
        drum(at + 3.76, 'snare', .22, -.11);
      }
      for (let h = 0; h < 8; h++) {
        if (breakBar && h % 2 === 0) continue;
        drum(at + .5 * h + (h % 2 ? .021 : 0), h === 7 && i % 2 ? 'open' : 'hat',
          h % 2 ? .21 : .13, .37);
      }
      if ((chorus || part === 'climb') && i === 0) drum(at, 'crash', .22, -.44);
      if (i === 7 || build && i >= 5) {
        const fill = i === 7 ? [[2.75, 158], [3.25, 121], [3.50, 100], [3.75, 81]] : [[2.5, 128], [3.5, 94]];
        for (const [offset, frequency] of fill) drum(at + offset, 'tom', .36, (frequency - 119) / 115, frequency);
      }
    }
  }

  function cabinet(drive, gain) {
    let rumble = 0, cone = 0, edge = 0;
    return sample => {
      rumble += .019 * (sample - rumble);
      const amp = Math.tanh(drive * (sample - .74 * rumble));
      cone += .34 * (amp - cone);
      edge += .15 * (cone - edge);
      return gain * (.72 * cone + .28 * edge);
    };
  }
  const ampL = cabinet(3.0, .30), ampR = cabinet(2.7, .29), solo = cabinet(3.8, .31);
  // Run the last beats through the cabinets first so their filters already
  // have the right state when playback wraps from the turnaround to bar one.
  const pickupFrames = Math.round(2 * beat * sampleRate);
  for (let i = -pickupFrames; i < frames; i++) {
    const j = (i + frames) % frames;
    const l = ampL(guitarLeft[j]), r = ampR(guitarRight[j]), melody = solo(lead[j]);
    if (i < 0) continue;
    left[i] += l + .16 * r + .64 * melody;
    right[i] += r + .16 * l + .76 * melody;
    room[i] += .16 * (l + r) + .32 * melody;
  }
  for (const [channel, delay, gain] of [
    [left, .027, .54], [right, .041, .53], [right, .113, .30], [left, .157, .30],
    [left, .75 * beat, .18], [right, 1.5 * beat, .16],
  ]) {
    const offset = Math.round(delay * sampleRate);
    for (let i = 0; i < frames; i++) channel[(i + offset) % frames] += gain * room[i];
  }
  const stereo = new Float32Array(2 * frames);
  for (let i = 0; i < frames; i++) {
    stereo[2 * i] = left[i];
    stereo[2 * i + 1] = right[i];
  }
  await writeFile(path, new Uint8Array(stereo.buffer));
  return frames / sampleRate;
}
