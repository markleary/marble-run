import { access, mkdir, mkdtemp, rename, rm, writeFile } from 'node:fs/promises';
import { execFileSync, spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderCruxScore } from './crux-score.mjs';

const directory = new URL('../public/audio/', import.meta.url);
function elevenLabsKey() {
  if (!process.env.ELEVENLABS_API_KEY) throw new Error('Set ELEVENLABS_API_KEY in the local .env file.');
  return process.env.ELEVENLABS_API_KEY;
}
const clips = [
  ['gate', 1.1, false, 'One crisp mechanical release of a miniature spring-loaded metal starting gate on a wooden toy race track. A quick click-clack then silence. Close microphone, dry foley.'],
  ['roll-lacquer', 4, true, 'Close dry foley of one small solid glass marble steadily rolling over a smooth lacquered wooden toy track. A delicate continuous low rasp with a clear fine spinning whirr. Uniform throughout.'],
  ['roll-timber', 4, true, 'Tiny glass marble rolling steadily over bare maple planks with very fine wood grain. Soft warm woody rolling rumble with little grain texture. Uniform continuous sound.'],
  ['roll-ice', 4, true, 'Close foley of a glass marble gliding smoothly over a clear frozen ice rink, a light fine crystalline sliding hiss and soft rolling whirr with steady pitch. Quiet, continuous and uniform throughout for a small tabletop racing game. No impacts, cracking, wind, music or voices.'],
  ['roll-wire', 4, true, 'Dry close-miked tabletop foley of a single small glass marble rolling on two thin steel wire rails. Delicate, sustained wire buzz with a light metallic bearing rattle at steady speed. Continuous texture with no distinct hits, voices or music.'],
  ['contact', 0.6, false, 'Two small hard glass marbles tapping against each other once. A short bright glass tick with immediate onset in a quiet room.'],
  ['bell', 1.7, false, 'Single light tap on a small brass counter bell at a tabletop marble race. A sweet clear high ding with a short natural decay.']
];
await mkdir(directory, { recursive: true });
for (const [name, duration, loop, prompt] of clips) {
  const file = new URL(name + '.mp3', directory);
  if (await access(file).then(() => true, () => false)) continue;
  const response = await fetch('https://api.elevenlabs.io/v1/sound-generation?output_format=mp3_44100_128', {
    method: 'POST',
    headers: { 'xi-api-key': elevenLabsKey(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: prompt, duration_seconds: duration, loop, model_id: 'eleven_text_to_sound_v3' })
  });
  if (!response.ok) throw new Error('ElevenLabs returned HTTP ' + response.status + ' for ' + name);
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.length < 1000) throw new Error('Incomplete audio for ' + name);
  await writeFile(file, bytes);
  console.log('Generated ' + name);
}
const scores = [
  ['prism', 120, 'Sunny lacquered toy speedway. Lean 1970s instrumental synth-funk in D major, a rounded electric piano playing short syncopated chords, walking muted electric bass and brushed kick. A little playful detuned analog lead answers the keys.'],
  ['timber', 100, 'Warm cabinetmaker workshop. An acoustic chamber-folk ostinato in 4/4, fingerpicked nylon guitar, pizzicato upright bass, mellow viola and warm woody marimba phrases, with a gently loping pulse as the marbles spiral.'],
  ['wireworks', 116, 'Mechanical kinetic sculpture gallery. Minimalist motorik electronica in A minor with a rubbery muted mono synth bass, soft low-pass electric organ pulses and a repeating interlocked plucked melody. Restrained machine groove, understated percussion, plenty of rhythmic space.'],
  ['frostline', 108, 'Snowy alpine rally village. Airy winter chamber score in 4/4 with felt piano, warm sustained string trio, and a lilting clarinet countermelody over plucked bass. An optimistic flowing pulse. Keep the high register very soft.'],
  ['orrery', 112, 'Midnight Orrery, a miniature brass clockwork observatory tracing the orbits of planets. A nocturnal chamber ostinato in E minor, gentle celesta notes turning against pulsing bass clarinet, with clipped viola harmonics and a muted French horn answer. Interlock two quiet three-note patterns across a steady four-beat measure to suggest meshing gears. Curious, precise, forward-moving.'],
  ['tideglass', 104, 'Tideglass Conservatory, a seaside glasshouse with winding aquamarine flumes and lush foliage. A breezy instrumental bossa nova in G major. A syncopated nylon-string guitar and round fretless bass carry the rhythm, a breathy alto flute plays a rising then falling phrase, soft brushed rim and shaker tucked underneath. Keep the swaying groove intimate and buoyant.'],
  ['kepler', 110, 'Kepler Relay, an original orbital relay race score titled Signal Return. Cinematic analog space electronica in D Dorian, 4/4. Start in motion with a rounded pulsing synth bass, a warm stereo sequencer answering itself across the beat, and a little muted electronic kick. A solitary, lyrical portamento lead climbs a fourth and hangs in the air over broad, slowly opening string-synth chords. Develop the signal motif over four eight-bar phrases: a spare transmission, a busier descending sequence, an airy suspended phrase, then a low, driving reprise. Keep the pulse and harmonic turnaround continuous under the race. Warm, spacious, quietly propulsive.', 32],
];
// Compare short windows of the original recording to find a matching pair of bar lines.
// Moving the exit a little allows for an imperfect generated tempo.
function chooseLoop(source, bpm, loopBars) {
  const rate = 4000, frame = 80;
  const pcm = execFileSync('ffmpeg', ['-v', 'error', '-i', source, '-f', 'f32le', '-ar', String(rate), '-ac', '1', '-'], { maxBuffer: 4000000 });
  const samples = new Float32Array(pcm.buffer, pcm.byteOffset, pcm.length / 4);
  const envelopes = [];
  let low = 0, mid = 0;
  for (let start = 0; start + frame <= samples.length; start += frame) {
    const energy = [0, 0, 0];
    for (let i = start; i < start + frame; i++) {
      low += .16 * (samples[i] - low);
      mid += .6 * (samples[i] - mid);
      energy[0] += low ** 2;
      energy[1] += (mid - low) ** 2;
      energy[2] += (samples[i] - mid) ** 2;
    }
    envelopes.push(energy.map(v => Math.log(v / frame + 0.00001)));
  }
  const hz = rate / frame;
  const bars = loopBars * 4 * 60 / bpm * hz;
  const context = Math.round(hz * 1.2);
  let best = Infinity, bestStart = 0, bestEnd = 0;
  for (let length = Math.round(bars * .87); length <= bars * 1.13; length++) {
    for (let a = Math.round(hz * .7); a + length + context < envelopes.length - hz * .55; a += 2) {
      let mismatch = 0;
      for (let k = 0; k < context; k += 2) {
        for (let b = 0; b < 3; b++) mismatch += Math.abs(envelopes[a + k][b] - envelopes[a + length + k][b]);
      }
      const score = mismatch / context + Math.abs(length - bars) / bars;
      if (score < best) { best = score; bestStart = a; bestEnd = a + length; }
    }
  }
  if (!bestEnd) throw new Error('Recording was too short for a ' + loopBars + '-bar loop.');
  return { start: bestStart / hz, end: bestEnd / hz };
}

const cache = new URL('../node_modules/.cache/marble-run-audio/', import.meta.url);
await mkdir(cache, { recursive: true });
function masterLoop(id, inputArgs, output) {
  const meter = spawnSync('ffmpeg', ['-hide_banner', '-nostats', ...inputArgs, '-af', 'ebur128', '-f', 'null', '-'], { encoding: 'utf8' });
  const lufs = Number(meter.stderr?.match(/Integrated loudness:\s+I:\s+(-?[\d.]+) LUFS/)?.[1]);
  if (!Number.isFinite(lufs) || meter.status !== 0) throw new Error('Could not measure the ' + id + ' score.');
  execFileSync('ffmpeg', ['-v', 'error', ...inputArgs, '-af', 'volume=' + (-22 - lufs).toFixed(2) + 'dB',
    '-ar', '44100', '-ac', '2', '-codec:a', 'libmp3lame', '-b:a', '128k', output]);
}

for (const [id, bpm, brief, loopBars = 8] of scores) {
  const output = new URL('music-' + id + '.mp3', directory);
  if (await access(output).then(() => true, () => false)) continue;
  const source = new URL(id + '-source.mp3', cache);
  if (!await access(source).then(() => true, () => false)) {
    const response = await fetch('https://api.elevenlabs.io/v1/music?output_format=mp3_44100_128', {
      method: 'POST', headers: { 'xi-api-key': elevenLabsKey(), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model_id: 'music_v2_5', force_instrumental: true,
        music_length_ms: Math.round((loopBars + 4) * 4 * 60 / bpm * 1000),
        prompt: brief + ' Instrumental music for a miniature marble race, exactly ' + bpm + ' BPM. ' +
          (loopBars === 8 ? 'Repeat a four-bar motif with a consistent first beat and constant orchestration for all twelve bars.' : 'Following the final turnaround, repeat the opening four bars so the cut can loop on the downbeat.') +
          ' Begin in the groove, continue at full pulse through the last beat. No intro, outro, breaks, vocals, sound effects, bright percussion, or big dynamic accents.',
      }),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error('Eleven Music returned HTTP ' + response.status + ' for ' + id + ' (' + JSON.stringify(error.detail ?? error.error ?? {}).slice(0, 450) + ')');
    }
    const audio = new Uint8Array(await response.arrayBuffer());
    if (audio.length < 1000) throw new Error('Incomplete score for ' + id);
    await writeFile(source, audio);
  }
  const { start, end } = chooseLoop(fileURLToPath(source), bpm, loopBars);
  const overlap = .16;
  // Put the crossfade at the very end. Its final sample leads directly into the
  // next sample of the recording at the loop head, preserving the pulse.
  const filter = '[0:a]asplit=3[body][tail][head];' +
    '[body]atrim=start=' + (start + overlap) + ':end=' + end + ',asetpts=PTS-STARTPTS[bodytrim];' +
    '[tail]atrim=start=' + end + ':end=' + (end + overlap) + ',asetpts=PTS-STARTPTS[tailtrim];' +
    '[head]atrim=start=' + start + ':end=' + (start + overlap) + ',asetpts=PTS-STARTPTS[headtrim];' +
    '[tailtrim][headtrim]acrossfade=d=' + overlap + '[seam];' +
    '[bodytrim][seam]concat=n=2:v=0:a=1[out]';
  const work = await mkdtemp(new URL('master-', cache));
  try {
    const loop = join(work, 'loop.wav');
    const mastered = join(work, 'loop.mp3');
    execFileSync('ffmpeg', ['-v', 'error', '-i', fileURLToPath(source), '-filter_complex', filter, '-map', '[out]', '-c:a', 'pcm_f32le', loop]);
    masterLoop(id, ['-i', loop], mastered);
    await rename(mastered, output);
    console.log('Generated music-' + id + ' (' + (end - start).toFixed(2) + ' s)');
  } finally { await rm(work, { recursive: true, force: true }); }
}

const cruxScore = new URL('music-crux.mp3', directory);
if (!await access(cruxScore).then(() => true, () => false)) {
  const work = await mkdtemp(new URL('crux-', cache));
  try {
    const pcm = join(work, 'score.f32'), mastered = join(work, 'score.mp3');
    await renderCruxScore(pcm);
    masterLoop('crux', ['-f', 'f32le', '-ar', '44100', '-ac', '2', '-i', pcm], mastered);
    await rename(mastered, cruxScore);
    console.log('Generated music-crux (128.00 s)');
  } finally { await rm(work, { recursive: true, force: true }); }
}
