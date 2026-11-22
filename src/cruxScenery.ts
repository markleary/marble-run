import * as THREE from 'three'
import type { CourseTrack } from './track'
import { cruxVolumeLift, cruxVolumes } from './courses/crux'
import layout from './courses/crux-layout.json'
import { cruxCheckpoints } from './courses/cruxCheckpoints'
import { createCruxHall } from './cruxHall'
import { SceneryBatch, axisY, canvasTexture, lifted, material, woodTexture, type Material } from './sceneryKit'

const palette = ['#f1b72e', '#119d9b', '#e35432', '#4d75b1']
const ivory = '#f5ead7'

function trackGrain() {
  const map = canvasTexture(256, 128, ctx => {
    ctx.fillStyle = '#eeeae4'; ctx.fillRect(0, 0, 256, 128)
    let seed = 1759
    const random = () => ((seed = (Math.imul(1664525, seed) + 1013904223) >>> 0) / 0x100000000)
    for (let i = 0; i < 3000; i++) {
      ctx.fillStyle = random() < .6 ? 'rgba(104,116,114,.26)' : 'rgba(255,255,252,.39)'
      ctx.fillRect(random() * 256, random() * 128, random() * 1.6 + .6, .6)
    }
  })
  map.wrapS = map.wrapT = THREE.RepeatWrapping
  return map
}

/** Two faces of the timing gantry use the same print, each read in its own direction. */
function gateSign(label: string, color: string) {
  const finish = material('#ffffff', .55)
  finish.map = canvasTexture(768, 128, ctx => {
    ctx.fillStyle = '#182e34'; ctx.fillRect(0, 0, 768, 128)
    ctx.fillStyle = color; ctx.fillRect(0, 118, 768, 10)
    for (const start of [30, 670]) for (let i = 0; i < 3; i++) {
      const x = start + i * 20
      ctx.beginPath(); ctx.moveTo(x, 84); ctx.lineTo(x + 19, 36); ctx.lineTo(x + 31, 36); ctx.lineTo(x + 12, 84); ctx.fill()
    }
    ctx.fillStyle = ivory; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.font = '800 83px Barlow Condensed, Arial Narrow, sans-serif'
    ctx.fillText(label, 384, 65)
  })
  return finish
}

export function createCruxScenery(track: CourseTrack) {
  const group = new THREE.Group()
  group.name = 'Crux Mountain Masters'
  const batch = new SceneryBatch()
  const bounds = new THREE.Box3()
  for (let s = 0; s < track.length + 1; s += 1) for (const l of [-track.halfWidth, track.halfWidth]) {
    bounds.expandByPoint(lifted(track.sample(s, l), 0))
  }
  const floorY = Math.min(0, bounds.min.y - 1.2)
  const frameCamera = createCruxHall(group, bounds, floorY)
  const charcoal = material('#23343a', .61, .23), steel = material('#8f9da2', .37, .53)
  const metal = material('#4d6871', .45, .50), white = material(ivory, .56), black = material('#19272b', .8)
  const saffron = material('#eaa929', .43), teal = material('#1a8483', .47)
  const asphalt = material('#364149', .76), slate = material('#3d5360', .71)
  const mat = material('#ded3bb', .82)
  const wood = material('#e4ca94', .66)
  asphalt.map = slate.map = mat.map = trackGrain(); wood.map = woodTexture()
  const holds = palette.map(color => material(color, .65))
  const sTop = track.sections, w = track.halfWidth
  const at = (s: number, l: number, dy = 0) => lifted(track.sample(s, l), dy)
  const rim = (s: number, side: number, offset: number, dy = 0) => {
    const p = track.sample(s, side * w)
    return new THREE.Vector3(p.x + p.rx * side * offset, p.y + dy, p.z + p.rz * side * offset)
  }
  const ribbon = (m: Material, start: number, end: number, left: number, right: number, height = 0, bands = 1) =>
    batch.surface(m, start, end, (s, t) => at(s, left + (right - left) * t, height), Math.abs(right - left), bands)

  for (const [index, { start, end }] of sTop.entries()) {
    const wooden = index === 0 || index === 11
    const ridged = index < 2, boulders = index === 3
    if (boulders) {
      // The removable volumes sit on top of a flat mat. Drawing the mat flat
      // lets every colored face end exactly at the edge of its physical mold.
      batch.surface(mat, start, end, (s, t) => {
        const l = (2 * t - 1) * w
        let lift = 0
        for (const volume of cruxVolumes) lift += cruxVolumeLift(volume, s, l)
        return at(s, l, -lift)
      }, 2 * w, 16)
    } else if (index === 7) {
      const length = (end - start) / layout.slabCants.length
      for (const [panel, gradient] of layout.slabCants.entries()) {
        const entry = start + length * panel
        ribbon(panel % 2 ? slate : mat, entry, entry + length, -w, w, 0, 18)
        // Paired course-setter arrows point to the actual low side of each cant.
        for (const d of [3, 8]) batch.surface(panel % 2 ? saffron : teal, entry + d, entry + d + 1.7, (s, t) => {
          const edge = .35 + 1.1 * (1 - Math.abs((s - entry - d) / .85 - 1))
          return at(s, -Math.sign(gradient) * (edge + t * .26), .022)
        }, .26)
      }
    } else ribbon(wooden ? wood : (index === 5 || index === 9 ? slate : asphalt), start, end, -w, w, 0, ridged ? 60 : 12)
    if (!boulders) {
      for (let s = start + 3.1; s < end - .10; s += wooden ? 2.85 : 5.2) {
        ribbon(wooden ? charcoal : metal, s, s + .024, -w, w, .009, ridged ? 60 : 14)
      }
    }
    if (ridged || [2, 4, 6, 8, 10].includes(index)) {
      // Fine yellow course-setter's lines follow both the high launch ridges and open banks.
      for (let lane = 1; lane < track.laneCount; lane++) {
        const l = -w + lane * track.laneWidth
        ribbon(index === 0 ? charcoal : saffron, start, end, l - .031, l + .031, .015)
      }
    }
    for (const side of [-1, 1]) {
      const l = side * w
      ribbon(white, start, end, side * (w - .32), side * (w - .25), .018)
      ribbon(boulders || index === 7 ? teal : saffron, start, end, side * (w - .20), side * (w - .09), .018)
      batch.strip(charcoal, start, end, (s, k) => rim(s, side, .035, k ? .12 : -.39), .51)
      batch.strip(metal, start, end, (s, k) => rim(s, side, .043, k ? -.09 : -.15), .06)
      // Open rails expose the racing line from low broadcast cameras.
      batch.strip(metal, start, end, (s, k) => at(s, l, k ? .23 : .03), .20)
      batch.strip(charcoal, start, end, (s, k) => rim(s, side, .014, track.wallHeight(s) - (k ? .17 : .025)), .15)
      batch.strip(steel, start, end, (s, k) => rim(s, side, k ? .085 : -.035, track.wallHeight(s) - .023), .12)
      for (let s = start + .18; s < end; s += 2.3) {
        batch.rod(metal, rim(s, side, .026, -.22), rim(s, side, .026, track.wallHeight(s) - .10), .052, 5)
        batch.rod(steel, rim(s, side, .04, .09), rim(s, side, .095, .09), .076, 6)
      }
    }
    // A slim return skin closes the steel chassis when seen from below.
    ribbon(charcoal, start, end, -w, w, -.39, 1)
  }

  // Roofed, freestanding bouldering towers occupy the islands inside three turns.
  // Their tops sit below the banking so the camera can always see the racing line.
  for (const [tower, index] of [2, 6, 10].entries()) {
    const section = sTop[index], s = (section.start + section.end) / 2
    const p = track.sample(s), radius = (section.end - section.start) / Math.PI
    const x = p.x + p.rx * radius, z = p.z + p.rz * radius
    const height = Math.max(2, Math.min(20, p.y - floorY - 1.7))
    const yaw = [.27, -.42, .17][tower], footprint = 4.8
    const place = (xLocal: number, y: number, zLocal: number) => new THREE.Vector3(
      x + xLocal * Math.cos(yaw) + zLocal * Math.sin(yaw), floorY + y, z - xLocal * Math.sin(yaw) + zLocal * Math.cos(yaw))
    batch.box(charcoal, place(0, .11, 0), [footprint + .65, .40, footprint + .65], yaw)
    batch.box(holds[tower], place(0, .36, 0), [footprint + .43, .16, footprint + .43], yaw)
    const levels = [0, .39, .77, 1], breadths = [1.48, 1.86, 2.15, 1.42]
    const point = (side: number, u: number, row: number) => {
      const a = side * Math.PI / 2, k = breadths[row]
      return place(.25 * Math.sin(row) + k * (Math.cos(a) + u * Math.sin(a)), .5 + levels[row] * height,
        .27 * Math.cos(row + 1) + k * (Math.sin(a) - u * Math.cos(a)))
    }
    for (let side = 0; side < 4; side++) for (let row = 0; row < 3; row++) {
      const corners = [point(side,-1,row), point(side,1,row), point(side,1,row+1), point(side,-1,row+1)]
      const geometry = new THREE.BufferGeometry()
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(corners.flatMap(q => [q.x,q.y,q.z]), 3))
      geometry.setAttribute('uv', new THREE.Float32BufferAttribute([0,0,1,0,1,1,0,1], 2))
      geometry.setIndex([0,1,2,0,2,3])
      batch.add(row === 1 ? holds[tower] : row === 2 ? slate : mat, geometry)
      batch.rod(charcoal, corners[2], corners[3], .043, 5)
      const count = Math.max(1, Math.ceil(height * (levels[row + 1] - levels[row]) / .95))
      for (let j = 0; j < count; j++) {
        const u = .48 + .33 * Math.sin(side + 1.53 * j + 3 * row)
        const grip = corners[0].clone().lerp(corners[1], u).lerp(corners[3].clone().lerp(corners[2], u), (j + .5) / count)
        const scale = new THREE.Vector3(.28, .13, .24)
        batch.add(row === 1 ? white : holds[tower], new THREE.IcosahedronGeometry(1, 0), new THREE.Matrix4().makeScale(scale.x,scale.y,scale.z).setPosition(grip))
      }
    }
    const cap = point(0, 0, 3).lerp(point(2, 0, 3), .5)
    batch.box(charcoal, cap, [2.93, .12, 2.93], yaw)
  }

  // Resin panels are molded in four facets. A printed change of value along their
  // creases keeps the contours readable even when a shallow face catches flat light.
  const volumeFaces = palette.map(color => [1, .58, .82, .39].map(value =>
    material(new THREE.Color(color).multiplyScalar(value), .71)))
  for (const [index, volume] of cruxVolumes.entries()) {
    const faces = volumeFaces[[2, 1, 0, 3, 1, 2][index % 6]]
    for (const along of [-1, 1]) for (const across of [-1, 1]) {
      const tip = volume.s + along * volume.length / 2
      const facet = (along < 0 ? 2 : 0) + (across < 0 ? 1 : 0)
      batch.surface(faces[facet], Math.min(tip, volume.s), Math.max(tip, volume.s), (s, t) => {
        const delta = s - volume.s, extent = (1 - Math.abs(2 * delta / volume.length)) * volume.width / 2
        return at(s, volume.lateral + volume.skew * delta + across * t * extent, .014)
      }, volume.width / 2, 2)
    }
    // Chalk-white apex ticks and screw heads show the two long edges meeting at the top.
    for (const sign of [-1, 1]) {
      const s0 = volume.s + sign * volume.length * .13
      batch.surface(white, s0 - .24, s0 + .24, (s, t) =>
        at(s, volume.lateral + volume.skew * (s - volume.s) + (t - .5) * .075, .023), .075)
    }
    // Anchor screws sit on the near foot of each bolted competition volume.
    for (const sign of [-1, 1]) {
      const s = volume.s + sign * .35 * volume.length, l = volume.lateral + volume.skew * (s - volume.s)
      batch.rod(charcoal, at(s, l, .012), at(s, l, .030), .055, 6)
    }
  }

  // Mount the deck on paired stadium shoring frames. Galvanized crossbraces and
  // adjuster collars make the high lanes visibly supported without filling the room.
  for (let s = 1.8, stand = 0; s < track.length; s += 6.7, stand++) {
    const p = track.sample(s), yaw = -Math.atan2(p.tz, p.tx)
    const beamY = Math.min(...Array.from({ length: 15 }, (_, j) => at(s, (j / 7 - 1) * w).y)) - .52
    const point = (l: number, y: number) => new THREE.Vector3(p.x + l * p.rx, y, p.z + l * p.rz)
    const span = w - .40
    batch.box(charcoal, point(0, beamY), [.36, .31, span * 2 + .5], yaw)
    for (const side of [-1, 1]) {
      const l = side * span, foot = point(l, floorY + .02)
      batch.box(charcoal, foot, [.75, .19, .64], yaw)
      batch.rod(steel, foot, point(l, beamY), .135, 8)
      batch.rod(metal, point(l, beamY - .55), point(l, at(s, l, -.30).y), .176, 8)
      batch.box(saffron, point(l, floorY + .58), [.31, .63, .31], yaw)
    }
    for (let h = floorY + .5; h + 2 < beamY; h += 5.3) {
      const chord = Math.min(beamY, h + 5.2)
      const side = (Math.round((h - floorY) / 5.3) + stand) % 2 ? 1 : -1
      batch.rod(metal, point(side * span, h), point(-side * span, chord), .068, 6)
      batch.rod(metal, point(-span, h), point(span, h), .068, 6)
    }
  }

  const checkpoints = cruxCheckpoints(track.sections)
  const stations = [{ s: .20, name: 'START' }, ...checkpoints, { s: track.finishS, name: 'FINISH' }]
  for (const [index, { s, name }] of stations.entries()) {
    const start = index === 0, finish = index === stations.length - 1
    const paint = start || finish ? saffron : holds[(index - 1) % holds.length]
    const p = track.sample(s), normal = new THREE.Vector3(p.tx, 0, p.tz), yaw = Math.atan2(normal.x, normal.z)
    const top = Math.max(at(s, -w).y, at(s, w).y, p.y) + (start ? 2.8 : 3.3)
    const badge = gateSign(name, start || finish ? palette[0] : palette[index - 1])
    for (const side of [-1, 1]) {
      const base = rim(s, side, .23, -.34), crown = base.clone(); crown.y = top + .55
      batch.box(charcoal, base.clone().lerp(crown, .5), [.36, crown.y - base.y, .30], yaw)
      batch.box(paint, crown.clone().addScaledVector(axisY, -.95), [.39, 1.30, .32], yaw)
      batch.rod(steel, rim(s - .85, side, .23, -.15), crown.clone().addScaledVector(axisY, -1.4), .064)
      // Optical timing eyes flank the actual leading-edge crossing plane.
      const eye = rim(s, side, .015, .36)
      batch.box(black, eye, [.25, .31, .28], yaw)
      batch.rod(paint, eye, eye.clone().add(new THREE.Vector3(-side * p.rx * .16, 0, -side * p.rz * .16)), .072, 8)
    }
    const center = new THREE.Vector3(p.x, top, p.z), signWidth = 2 * w + .71
    batch.box(charcoal, center, [signWidth + .07, 1.15, .31], yaw)
    for (const side of [-1, 1]) {
      const transform = new THREE.Matrix4().makeRotationY(yaw + (side < 0 ? Math.PI : 0))
      transform.setPosition(center.clone().addScaledVector(normal, side * .159))
      batch.add(badge, new THREE.PlaneGeometry(signWidth, 1.08), transform)
    }
    if (start) continue
    if (finish) {
      for (let col = 0; col < 18; col++) for (let row = 0; row < 2; row++)
        ribbon((col + row) % 2 ? white : black, s + row * .23, s + (row + 1) * .23, -w + col * w / 9, -w + (col + 1) * w / 9, .019)
    } else {
      ribbon(white, s, s + .14, -w, w, .032, 36)
      for (let i = 0; i < 16; i += 2)
        ribbon(paint, s + .14, s + .31, -w + i * w / 8, -w + (i + 1) * w / 8, .029, 4)
    }
  }
  // Stenciled distance boards on the sprint give the long open timber runout scale.
  const distances = [30, 20, 10, 5]
  const sprintMark = material('#ffffff', .69)
  sprintMark.map = canvasTexture(512, 512, ctx => {
    for (const [i, distance] of distances.entries()) {
      ctx.save(); ctx.translate(i % 2 * 256, Math.floor(i / 2) * 256)
      ctx.fillStyle = '#29434a'; ctx.fillRect(0, 0, 256, 256)
      ctx.fillStyle = ivory; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
      ctx.font = '800 148px Barlow Condensed, Arial Narrow, sans-serif'
      ctx.fillText(String(distance), 128, 153, 205)
      ctx.fillStyle = palette[0]
      ctx.beginPath(); ctx.moveTo(55, 56); ctx.lineTo(128, 18); ctx.lineTo(201, 56)
      ctx.lineTo(201, 74); ctx.lineTo(128, 41); ctx.lineTo(55, 74); ctx.fill()
      ctx.restore()
    }
  })
  for (const [i, distance] of distances.entries()) for (const side of [-1, 1]) {
    const s = track.finishS - distance, l = side * (w - .97)
    const corners = [at(s - .75, l - .59, .018), at(s - .75, l + .59, .018),
      at(s + .75, l + .59, .018), at(s + .75, l - .59, .018)]
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(corners.flatMap(p => [p.x, p.y, p.z]), 3))
    const u = (i % 2) * .5, vv = .5 - Math.floor(i / 2) * .5
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute([u,vv, u+.5,vv, u+.5,vv+.5, u,vv+.5], 2))
    geometry.setIndex([0,1,2,0,2,3]); batch.add(sprintMark, geometry)
    ribbon(saffron, s - .76, s - .67, l - .60, l + .60, .023)
  }
  ribbon(black, track.finishS + .59, track.length, -w + .11, w - .11, .022, 20)
  const end = track.sample(track.length)
  batch.box(charcoal, lifted(end, .56), [.20, 1.18, w * 2 + .14], -Math.atan2(end.tz, end.tx))
  batch.finish(group)
  return Object.assign(group, { frameCamera })
}
