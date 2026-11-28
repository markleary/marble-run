// Traditional Welsh carol "Nos Galan" (Deck the Halls), arranged for two toy music boxes.
// The recorded ensemble opens in D major at 120 BPM. The second box answers at bar 17.
export const santaTitle = 'Special Delivery'
const rate = 44100
export const santaTineFormat = ['-f', 'f32le', '-ar', String(rate), '-ac', '2']
const melody = [
  // MIDI pitch, length in eighth notes. The four bars finish on the tonic.
  [81, 3], [79, 1], [78, 2], [76, 2], [74, 2], [76, 2], [78, 2], [74, 2],
  [76, 1], [78, 1], [79, 1], [76, 1], [78, 3], [76, 1], [74, 2], [73, 2], [74, 4],
]

export function santaMusicBoxes() {
  const eighth = .25
  const stereo = new Float32Array(42 * rate * 2)
  const leftReflection = Math.round(.031 * rate) * 2
  const rightReflection = Math.round(.0483 * rate) * 2 + 1
  for (const [start, gain, cabinet] of [[0, .26, -.08], [32, .20, .16]]) {
    let count = 0
    for (const [note, eighths] of melody) {
      // The short notes sit just behind the ensemble's swung offbeat.
      const when = start + count * eighth + (count % 2 ? .033 : 0) + .018
      const velocity = (count % 8 === 0 ? 1 : count % 2 === 0 ? .89 : .77) * gain
      const f = 440 * 2 ** ((note - 69) / 12)
      const pan = cabinet + (note - 76) * .045
      const duration = eighths * eighth
      const dampAt = duration * .83
      const head = Math.round(when * rate)
      for (let i = 0; i < (duration + .65) * rate; i++) {
        const t = i / rate
        const phase = 2 * Math.PI * f * t
        // Hammer transient, paired steel tines, then the key's felt damper.
        const attack = 1 - Math.exp(-t / .0038)
        const chime = (.80 * Math.sin(phase) + .18 * Math.sin(phase * 1.0014)) * Math.exp(-t / .64)
          + .26 * Math.sin(phase * 2.002) * Math.exp(-t / .27)
          + .15 * Math.sin(phase * 4.04) * Math.exp(-t / .11)
          + .075 * Math.sin(phase * 6.18) * Math.exp(-t / .041)
        const dry = velocity * chime * attack * Math.exp(-Math.max(0, t - dampAt) / .12)
        const frame = (head + i) * 2
        stereo[frame] += dry * (1 - pan)
        stereo[frame + 1] += dry * (1 + pan)
        // A pair of quiet early reflections places the tinkling keys in the room.
        stereo[frame + leftReflection] += .12 * dry
        stereo[frame + rightReflection] += .10 * dry
      }
      count += eighths
    }
  }
  return Buffer.from(stereo.buffer)
}
