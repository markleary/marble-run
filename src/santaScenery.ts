import * as THREE from 'three'
import type { CourseTrack } from './track'
import { canvasTexture, lifted, material, SceneryBatch, type Material } from './sceneryKit'
import { addSantaObstacles } from './santaObstacleScenery'
import { santaBeltSpeed } from './courses/santaObstacles'
import { christmasPaint, christmasStar, decorateSantaVillage, type ChristmasPaint } from './santaVillage'
import { santaWinter, winterRandom } from './santaWinter'
import { decorateSantaPromenade } from './santaPromenade'

const tau = Math.PI * 2
const pt = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z)
const lift = (p: THREE.Vector3, y: number) => pt(p.x, p.y + y, p.z)

function snowflake(c: CanvasRenderingContext2D, x: number, y: number, r: number) {
  c.save()
  c.translate(x, y)
  for (let j = 0; j < 6; j++) {
    c.rotate(Math.PI / 3)
    c.beginPath()
    c.moveTo(0, 0)
    c.lineTo(0, r)
    c.moveTo(-r * 0.24, r * 0.72)
    c.lineTo(0, r * 0.48)
    c.lineTo(r * 0.24, r * 0.72)
    c.stroke()
  }
  c.restore()
}

/** Roll-printed paper, foil flourishes and open racing space between the borders. */
function deckPaint(base: string, shade: string, foil: string, kind: 'wood' | 'ice' | 'lacquer', launch = false) {
  const map = canvasTexture(768, 512, (c) => {
    c.fillStyle = base
    c.fillRect(0, 0, 768, 512)
    const rng = winterRandom(702633)
    for (let i = 0; i < 2400; i++) {
      const x = rng() * 768,
        y = rng() * 512
      c.fillStyle = rng() < 0.5 ? 'rgba(45,30,30,.05)' : 'rgba(255,255,244,.09)'
      const length = kind === 'wood' ? 3 + rng() ** 2 * 101 : 1 + rng() * 5
      c.fillRect(x, y, length, 0.45 + rng())
      if (x + length > 768) c.fillRect(x - 768, y, length, 0.8)
    }
    if (launch)
      for (let i = 0; i < 6; i++) {
        const left = (i * 512) / 6,
          h = 512 / 6
        c.fillStyle = ['#9e2638', '#f1ddaf', '#347569', '#b43542', '#eddbb5', '#346c62'][i]
        c.fillRect(0, left, 768, h)
        c.fillStyle = '#d2a968'
        c.fillRect(0, left, 768, 2.1)
        c.fillRect(0, left + h - 4, 768, 0.9)
        c.fillStyle = '#ffffff19'
        c.fillRect(0, left + h * 0.19, 768, 1.2)
      }
    else {
      if (kind === 'wood') {
        // Individual maple boards are bookmatched. Short darker joins and brass nailheads stay underneath the inked border.
        for (let i = 0; i < 6; i++) {
          const y = (512 * i) / 6,
            x = (i * 181 + 63) % 768
          c.fillStyle = i % 2 ? 'rgba(94,52,23,.065)' : 'rgba(255,232,173,.09)'
          c.fillRect(0, y, 768, 512 / 6)
          c.fillStyle = 'rgba(90,55,29,.30)'
          c.fillRect(0, y, 768, 1.1)
          c.fillRect(x, y + 0.5, 0.9, 512 / 6 - 0.5)
          for (const dx of [-5, 5]) {
            c.beginPath()
            c.arc(x + dx, y + 9, 1.25, 0, tau)
            c.fill()
          }
        }
      }
      // Faint stamped stars on the racing line give the ice and lacquer a sense of motion.
      c.strokeStyle = foil
      c.globalAlpha = kind === 'ice' ? 0.66 : 0.31
      c.lineWidth = 2.4
      for (const [x, y, r] of [
        [163, 112, 29],
        [583, 146, 13],
        [319, 367, 13],
        [695, 369, 27],
      ])
        snowflake(c, x, y, r)
      c.globalAlpha = 1
      for (const side of [0, 1]) {
        c.save()
        if (side) {
          c.translate(0, 512)
          c.scale(1, -1)
        }
        c.fillStyle = shade
        c.fillRect(0, 0, 768, 37)
        c.fillStyle = foil
        c.fillRect(0, 6, 768, 1.5)
        c.fillRect(0, 34, 768, 2.2)
        c.fillRect(0, 42, 768, 1.1)
        c.strokeStyle = foil
        c.lineWidth = 1.9
        for (let x = 0; x <= 768; x += 48) {
          c.beginPath()
          c.moveTo(x - 11, 20)
          c.lineTo(x, 12)
          c.lineTo(x + 11, 20)
          c.lineTo(x, 28)
          c.closePath()
          c.stroke()
          c.fillRect(x + 17, 19, 13, 1.6)
        }
        c.restore()
      }
    }
  })
  map.wrapS = THREE.RepeatWrapping
  map.repeat.set(0.32, 1.6 / 8.4)
  const m = material('#fffaf0', kind === 'ice' ? 0.24 : 0.46, kind === 'ice' ? 0.19 : 0.08)
  m.map = map
  return m
}

const beltRepeat = 6.4

function workshopBelt(width: number, slat: string, ink: string, foil: string) {
  const map = canvasTexture(512, 512, c => {
    c.fillStyle = slat
    c.fillRect(0, 0, 512, 512)
    const rng = winterRandom(2977)
    for (let i = 0; i < 8; i++) {
      const x = i * 64
      c.fillStyle = i % 2 ? 'rgba(255,250,215,.06)' : 'rgba(73,47,35,.04)'
      c.fillRect(x, 0, 64, 512)
      c.fillStyle = 'rgba(54,46,39,.46)'
      c.fillRect(x, 0, 2.8, 512)
      c.fillStyle = 'rgba(255,248,218,.67)'
      c.fillRect(x + 3, 0, 1.9, 512)
      for (let j = 0; j < 72; j++) {
        c.fillStyle = rng() < .5 ? 'rgba(255,244,220,.09)' : 'rgba(68,47,40,.05)'
        c.fillRect(x + 6 + rng() * 56, rng() * 512, .8, 3 + rng() * 15)
      }
      for (const y of [11, 501]) {
        c.fillStyle = ink
        c.fillRect(x + 21, y - 1.3, i % 4 === 0 ? 26 : 12, 2.6)
        c.fillStyle = foil
        c.fillRect(x + 21, y + 1.3, 6, 1.2)
      }
    }
    c.globalAlpha = .36
    c.strokeStyle = ink
    c.lineWidth = 2.4
    for (const [x, y] of [[34, 113], [290, 399]]) {
      snowflake(c, x, y, 19)
      c.beginPath()
      c.arc(x, y, 25, 0, tau)
      c.stroke()
    }
  })
  map.wrapS = THREE.RepeatWrapping
  // SceneryBatch.surface maps one UV unit to four units along the track and 1.6 across it.
  map.repeat.set(4 / beltRepeat, 1.6 / width)
  return Object.assign(material('#fff8ed', .53, .11), { map })
}

function sugarStripe() {
  const map = canvasTexture(128, 128, (c) => {
    c.fillStyle = '#fff0ce'
    c.fillRect(0, 0, 128, 128)
    for (let x = -256; x <= 256; x += 128) {
      c.fillStyle = '#b91e34'
      c.beginPath()
      c.moveTo(x, 0)
      c.lineTo(x + 44, 0)
      c.lineTo(x + 172, 128)
      c.lineTo(x + 128, 128)
      c.fill()
      c.fillStyle = '#d65d57'
      c.beginPath()
      c.moveTo(x + 56, 0)
      c.lineTo(x + 62, 0)
      c.lineTo(x + 190, 128)
      c.lineTo(x + 184, 128)
      c.fill()
    }
  })
  map.wrapS = map.wrapT = THREE.RepeatWrapping
  const m = material('#ffffff', 0.32, 0.17)
  m.map = map
  return m
}
function candyPost(batch: SceneryBatch, m: Material, a: THREE.Vector3, b: THREE.Vector3, r: number) {
  const h = b.y - a.y
  if (h < 0.02) return
  const g = new THREE.CylinderGeometry(r, r * 1.04, h, 12),
    uv = g.getAttribute('uv')
  for (let i = 0; i < uv.count; i++) uv.setY(i, (uv.getY(i) * h) / (r * 5.5))
  g.translate(a.x, a.y + h / 2, a.z)
  batch.add(m, g)
}

function marquee(track: CourseTrack, batch: SceneryBatch, p: ChristmasPaint, stripe: Material, s: number, finish: boolean) {
  const line = track.sample(s)
  const yaw = Math.atan2(line.tx, line.tz),
    height = Math.max(track.sample(s, -track.halfWidth).y, track.sample(s, track.halfWidth).y) + 3.18
  const center = pt(line.x, height, line.z),
    span = track.halfWidth * 2 + 0.53
  const design = canvasTexture(1024, 230, (c) => {
    const paper = c.createLinearGradient(0, 0, 0, 230)
    paper.addColorStop(0, '#284d43')
    paper.addColorStop(0.63, '#153d36')
    paper.addColorStop(1, '#0d302f')
    c.fillStyle = paper
    c.fillRect(0, 0, 1024, 230)
    c.lineJoin = 'round'
    for (const [d, w, col] of [
      [7, 4, '#edcb83'],
      [15, 1.6, '#bf955b'],
    ] as const) {
      c.strokeStyle = col
      c.lineWidth = w
      c.beginPath()
      c.roundRect(d, d, 1024 - 2 * d, 230 - 2 * d, 13)
      c.stroke()
    }
    c.strokeStyle = '#b1b58a'
    c.lineWidth = 2.1
    snowflake(c, 80, 112, 34)
    snowflake(c, 944, 112, 34)
    c.textAlign = 'center'
    c.fillStyle = '#f6c979'
    c.font = 'bold 24px Georgia, serif'
    c.fillText(finish ? 'N O R T H   P O L E   P O S T' : 'N O R T H   P O L E', 512, 51)
    c.fillStyle = '#ffefcf'
    c.font = finish ? 'bold 98px Georgia, serif' : 'italic bold 102px Georgia, serif'
    c.fillText(finish ? 'FINISH' : 'Santa’s Balls', 512, 152, 770)
    c.strokeStyle = '#c59253'
    c.lineWidth = 2
    c.beginPath()
    c.moveTo(250, 181)
    c.quadraticCurveTo(330, 186, 397, 181)
    c.moveTo(627, 181)
    c.quadraticCurveTo(694, 186, 774, 181)
    c.stroke()
    c.fillStyle = '#edd5a0'
    c.font = 'bold 17px Georgia,serif'
    c.fillText(finish ? 'SPECIAL DELIVERY' : 'SLEIGH SHED', 512, 187)
  })
  const sign = material('#fff5de', 0.39, 0.09)
  sign.map = sign.emissiveMap = design
  sign.emissive.set('#ffffff')
  sign.emissiveIntensity = 0.2
  batch.box(p.brass, center, [span + 0.34, 1.92, 0.19], yaw)
  for (const face of [-1, 1]) {
    const g = new THREE.PlaneGeometry(span + 0.21, 1.8)
    g.rotateY(yaw + (face < 0 ? Math.PI : 0))
    g.translate(center.x + line.tx * face * 0.101, center.y, center.z + line.tz * face * 0.101)
    batch.add(sign, g)
  }
  for (const side of [-1, 1]) {
    const foot = lifted(track.sample(s, side * (track.halfWidth + 0.26)), -0.45)
    const poleTop = pt(foot.x, height + 1.06, foot.z)
    candyPost(batch, stripe, foot, poleTop, 0.155)
    batch.rod(p.brass, lift(poleTop, -0.15), lift(poleTop, 0.04), 0.23, 12)
    const cap = new THREE.SphereGeometry(0.225, 12, 8)
    cap.translate(poleTop.x, poleTop.y + 0.2, poleTop.z)
    batch.add(p.gold, cap)
  }
  christmasStar(batch, p, lift(center, 1.23), 0.54, yaw)
}

export function createSantaScenery(track: CourseTrack) {
  const group = new THREE.Group()
  group.name = "Santa's Balls"
  const batch = new SceneryBatch(0.41, { indexed: true }),
    p = christmasPaint(),
    stripe = sugarStripe()
  const winter = santaWinter(group, track)
  const grid = deckPaint('#d9b283', '#a24542', '#eedaa9', 'wood', true)
  const pearl = deckPaint('#dac8a2', '#ad3942', '#f6d58e', 'lacquer')
  const holly = deckPaint('#377567', '#194c45', '#d7b971', 'lacquer')
  const wrapping = deckPaint('#d7b88b', '#447567', '#ffdb8a', 'wood')
  const velvet = deckPaint('#a23e50', '#772938', '#e8bf73', 'lacquer')
  const glacier = deckPaint('#a9cdd1', '#50818b', '#f1dfb3', 'ice')
  const boards = [grid, pearl, holly, wrapping, velvet, glacier, glacier, wrapping]
  const w = track.halfWidth
  const at = (s: number, l: number, y = 0) => lifted(track.sample(s, l), y)
  const ribbon = (m: Material, s0: number, s1: number, l: number, r: number, dy = 0, bands = 1) =>
    batch.surface(m, s0, s1, (s, t) => at(s, l + t * (r - l), dy), r - l, bands)
  const casing = 2 * w / 12
  const beltHalf = w - casing
  const mintBelt = workshopBelt(2 * beltHalf, '#d5c7a6', '#a65753', '#ffe7a7')
  const parcelBelt = workshopBelt(2 * beltHalf, '#d2af83', '#387268', '#ffdf91')
  for (const [i, section] of track.sections.entries()) {
    const { start, end } = section
    const belt = i === 1 ? mintBelt : i === 3 ? parcelBelt : undefined
    if (!belt) {
      ribbon(boards[i], start, end, -w, w, 0.002, i === 0 ? 48 : 12)
      continue
    }
    // The original foil borders stay bolted to the frame on either side of the moving slats.
    for (const side of [-1, 1]) {
      batch.surface(boards[i], start, end, (s, t) => at(s, side * (w - t * casing), .002), casing)
    }
    ribbon(belt, start, end, -beltHalf, beltHalf, .002, 10)
    ribbon(p.brass, start, start + .09, -beltHalf, beltHalf, .008, 10)
    ribbon(p.brass, end - .09, end, -beltHalf, beltHalf, .008, 10)
  }

  const glass = material('#9acac8', 0.27, 0.16)
  glass.transparent = true
  glass.opacity = 0.19
  glass.depthWrite = false
  glass.forceSinglePass = true
  for (const side of [-1, 1]) {
    const edge = (s: number, x: number, h: number) => {
      const q = track.sample(s, side * w)
      return pt(q.x + q.rx * side * x, q.y + h, q.z + q.rz * side * x)
    }
    batch.strip(p.berry, 0, track.length, (s, k) => edge(s, 0.019, k ? 0.14 : -0.44), 0.58)
    batch.strip(p.brass, 0, track.length, (s, k) => edge(s, 0.024, k ? -0.23 : -0.29), 0.06)
    batch.strip(glass, 0, track.length, (s, k) => edge(s, 0.023, k ? track.wallHeight(s) : 0.13), 1.1)
    batch.strip(p.brass, 0, track.length, (s, k) => edge(s, k ? -0.065 : 0.067, track.wallHeight(s)), 0.132)
    // A scalloped evergreen garland follows the outside fascia. The little warm bulbs sit below marble eye level.
    const count = Math.ceil(track.length / 2.7)
    for (let i = 0; i < count; i++) {
      const from = (track.length * i) / count,
        to = (track.length * (i + 1)) / count,
        mid = (from + to) / 2
      const a = edge(from, 0.09, 0.13),
        b = edge(mid, 0.15, -0.1),
        c = edge(to, 0.09, 0.13)
      batch.rod(p.needles, a, b, 0.085, 6)
      batch.rod(p.spruce, b, c, 0.086, 6)
      const bulb = new THREE.SphereGeometry(0.086, 7, 5)
      bulb.scale(1, 1.25, 1)
      b.y -= 0.087
      bulb.translate(b.x, b.y, b.z)
      batch.add(i % 4 === 1 ? p.scarletLight : i % 4 === 3 ? p.mintLight : p.lantern, bulb)
      if (i % 2 === 0) {
        batch.rod(p.brass, edge(from, 0.03, -0.33), edge(from, 0.03, track.wallHeight(from) + 0.03), 0.05, 8)
        const r = 0.097,
          cap = new THREE.SphereGeometry(r, 8, 5),
          q = edge(from, 0.03, track.wallHeight(from) + 0.08)
        cap.translate(q.x, q.y, q.z)
        batch.add(p.gold, cap)
      }
    }
  }
  ribbon(p.pine, 0, track.length, -w, w, -0.43, 8)
  const footingShadow = material('#586779', 1, 0)
  footingShadow.transparent = true
  footingShadow.depthWrite = false
  footingShadow.map = canvasTexture(64, 64, (c) => {
    const shade = c.createRadialGradient(32, 32, 4, 32, 32, 31)
    shade.addColorStop(0, 'rgba(255,255,255,.53)')
    shade.addColorStop(0.47, 'rgba(255,255,255,.34)')
    shade.addColorStop(1, 'rgba(255,255,255,0)')
    c.fillStyle = shade
    c.fillRect(0, 0, 64, 64)
  })
  for (let s = 1; s < track.length; s += 6.0) {
    const ends = [-1, 1].map((side) => at(s, side * (w - 0.35), -0.46))
    const rootY = Math.min(...[-w, -w * 0.5, 0, w * 0.5, w].map((l) => track.sample(s, l).y)) - 0.54
    const heads = ends.map((q) => pt(q.x, rootY, q.z))
    batch.rod(p.pine, heads[0], heads[1], 0.17, 8)
    for (const [i, q] of heads.entries()) {
      const foot = pt(q.x, winter.ground(q.x, q.z) - 0.39, q.z)
      // A small contact shadow follows the snow slope under each trestle foot.
      const contact = new THREE.PlaneGeometry(1.49, 1.49, 3, 3)
      const points = contact.getAttribute('position')
      for (let j = 0; j < points.count; j++) {
        const x = q.x + points.getX(j),
          z = q.z - points.getY(j)
        points.setXYZ(j, x, winter.ground(x, z) + 0.025, z)
      }
      contact.computeVertexNormals()
      batch.add(footingShadow, contact)
      candyPost(batch, stripe, foot, q, 0.18)
      batch.rod(p.berry, lift(foot, 0.12), lift(foot, 0.46), 0.36, 10)
      batch.rod(p.brass, lift(foot, 0.39), lift(foot, 0.56), 0.29, 10)
      batch.rod(p.brass, lift(q, -0.24), ends[i], 0.22, 10)
    }
    const a = heads[0],
      b = heads[1]
    batch.rod(p.pine, lift(a, -0.8), a.clone().lerp(b, 0.23), 0.09, 8)
    batch.rod(p.pine, lift(b, -0.8), b.clone().lerp(a, 0.23), 0.09, 8)
  }
  marquee(track, batch, p, stripe, 0.09, false)
  marquee(track, batch, p, stripe, track.finishS, true)
  for (let col = 0; col < 16; col++)
    for (let row = 0; row < 2; row++) {
      const s = track.finishS + row * 0.26
      ribbon((col + row) % 2 ? p.dark : p.cream, s, s + 0.26, -w + (col * w) / 8, -w + ((col + 1) * w) / 8, 0.018)
    }
  const end = track.sample(track.length)
  batch.box(p.berry, lifted(end, 0.51), [0.24, 1.16, 2 * w + 0.2], -Math.atan2(end.tz, end.tx))
  const train = decorateSantaVillage(track, batch, p, winter.ground, group)
  decorateSantaPromenade(batch, p, track, winter.ground, group)
  batch.finish(group)
  // Translucent guards and small glowing bulbs contribute no visible opaque shadow.
  const lit = [glass, footingShadow, p.lantern, p.gold, p.pinkLight, p.mintLight, p.scarletLight]
  for (const mesh of group.children) if (mesh instanceof THREE.Mesh && lit.includes(mesh.material)) mesh.castShadow = false
  const animateObstacles = addSantaObstacles(track, group)
  return Object.assign(group, {
    frameCamera: winter.frameCamera,
    setRaceTime(seconds: number) {
      const beltOffset = -(seconds * santaBeltSpeed / beltRepeat % 1)
      mintBelt.map.offset.x = beltOffset
      parcelBelt.map.offset.x = beltOffset
      train.rotation.y = (-seconds * tau) / 26
      winter.setRaceTime(seconds)
      animateObstacles(seconds)
    },
  })
}
