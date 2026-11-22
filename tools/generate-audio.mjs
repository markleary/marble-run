import { access, mkdir, writeFile } from 'node:fs/promises';

const directory = new URL('../public/audio/', import.meta.url);
const key = process.env.ELEVENLABS_API_KEY;
if (!key) throw new Error('Set ELEVENLABS_API_KEY in the local .env file.');
const clips = [
  ['gate', 1.1, false, 'One crisp mechanical release of a miniature spring-loaded metal starting gate on a wooden toy race track. A quick click-clack then silence. Close microphone, dry foley.'],
  ['roll-lacquer', 4, true, 'Close dry foley of one small solid glass marble steadily rolling over a smooth lacquered wooden toy track. A delicate continuous low rasp with a clear fine spinning whirr. Uniform throughout.'],
  ['roll-timber', 4, true, 'Tiny glass marble rolling steadily over bare maple planks with very fine wood grain. Soft warm woody rolling rumble with little grain texture. Uniform continuous sound.'],
  ['contact', 0.6, false, 'Two small hard glass marbles tapping against each other once. A short bright glass tick with immediate onset in a quiet room.'],
  ['bell', 1.7, false, 'Single light tap on a small brass counter bell at a tabletop marble race. A sweet clear high ding with a short natural decay.']
];
await mkdir(directory, { recursive: true });
for (const [name, duration, loop, prompt] of clips) {
  const file = new URL(name + '.mp3', directory);
  if (await access(file).then(() => true, () => false)) continue;
  const response = await fetch('https://api.elevenlabs.io/v1/sound-generation?output_format=mp3_44100_128', {
    method: 'POST',
    headers: { 'xi-api-key': key, 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: prompt, duration_seconds: duration, loop, model_id: 'eleven_text_to_sound_v3' })
  });
  if (!response.ok) throw new Error('ElevenLabs returned HTTP ' + response.status + ' for ' + name);
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.length < 1000) throw new Error('Incomplete audio for ' + name);
  await writeFile(file, bytes);
  console.log('Generated ' + name);
}
