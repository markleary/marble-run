import * as THREE from 'three'
import type { CourseTrack } from './track'
import { cruxDeckSpans, cruxJumps, cruxJumpShield } from './courses/crux'
import { createCruxStations } from './cruxStations'
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
  let batch = new SceneryBatch()
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

  // Build each continuous piece independently. No rail, floor, or shadow
  // crosses the open air between the takeoff lip and its receiving deck.
  for (const [index, section] of sTop.entries()) {
    const bowl = [2, 4, 6, 8, 10].includes(index)
    for (const span of cruxDeckSpans) {
      const start = Math.max(span.start, section.start), end = Math.min(span.end, section.end)
      if (start >= end) continue
      batch = new SceneryBatch()
      const wooden = span.surface === 'wood', grooved = index === 0
      const receiver = cruxJumps.some(jump => start === jump.landing)
      const floor = wooden ? wood : receiver ? slate : asphalt
      const bands = grooved ? 60 : bowl ? 30 : 8
      ribbon(floor, start, end, -w, w, 0, bands)
      // Segment joints and edge rulings make speed readable on the long chutes.
      for (let s = start + 2.65; s < end - .08; s += wooden ? 3.7 : 7.5)
        ribbon(wooden ? charcoal : metal, s, s + .026, -w, w, .012, bands)
      if (grooved || bowl) {
        for (let lane = 1; lane < track.laneCount; lane++) {
          const l = -w + lane * track.laneWidth
          ribbon(grooved ? charcoal : saffron, start, end, l - .037, l + .037, .017)
        }
      }
      for (const side of [-1, 1]) {
        const l = side * w
        ribbon(white, start, end, side * (w - .32), side * (w - .25), .020)
        ribbon(receiver ? teal : saffron, start, end, side * (w - .19), side * (w - .08), .020)
        batch.strip(charcoal, start, end, (s, k) => rim(s, side, .035, k ? .12 : -.39), .51)
        batch.strip(metal, start, end, (s, k) => rim(s, side, .043, k ? -.09 : -.15), .06)
        batch.strip(metal, start, end, (s, k) => at(s, l, k ? .20 : .03), .17)
        batch.strip(charcoal, start, end, (s, k) => rim(s, side, .014, track.wallHeight(s) - (k ? .16 : .025)), .14)
        batch.strip(steel, start, end, (s, k) => rim(s, side, k ? .085 : -.035, track.wallHeight(s) - .023), .12)
        for (let s = start + .18; s < end; s += 3.1) {
          batch.rod(metal, rim(s, side, .026, -.22), rim(s, side, .026, track.wallHeight(s) - .10), .055, 5)
          batch.rod(steel, rim(s, side, .04, .09), rim(s, side, .095, .09), .078, 6)
        }
        if (bowl) {
          for (let s = start + .65, j = 0; s + 1.4 < end; s += 1.4, j++) {
            const curb = side * (w - .51)
            ribbon(j % 2 ? white : holds[(index / 2) % holds.length], s, s + 1.4, curb, side * (w - .76), .025)
          }
        } else {
          for (let s = start + 4; s < end - 4; s += 10) {
            for (let d = 0; d < 2; d++) {
              const back = s + .66 * d
              batch.surface(receiver ? teal : saffron, back, back + .65, (ds, t) => {
                const u = (ds - back) / .65
                return at(ds, side * (w - .43 - .43 * u - .16 * t), .022)
              }, .16)
            }
          }
        }
      }
      // Follow the deeply cupped cross section underneath as well; a flat chord
      // spanning the raised shoulders would come through the center of the turn.
      ribbon(charcoal, start, end, -w, w, -.39, bowl ? 24 : 8)
      batch.finish(group)
    }
  }
  batch = new SceneryBatch()
  const shields = new SceneryBatch()
  const plexiglass = material('#d5edeb', .22)
  plexiglass.transparent = true; plexiglass.opacity = .055; plexiglass.depthWrite = false
  plexiglass.forceSinglePass = true
  for (const jump of cruxJumps) {
    for (const side of [-1, 1]) {
      const [lipBase, lipTop, catchBase, catchTop] = cruxJumpShield(track, jump, side).map(p => lifted(p, 0))
      shields.strip(plexiglass, 0, 1, (u, high) => high ? lipTop.clone().lerp(catchTop, u) : lipBase.clone().lerp(catchBase, u), 1)
      for (const [a, b] of [[lipBase, lipTop], [catchBase, catchTop]]) {
        batch.rod(metal, a, b, .054, 6)
        batch.rod(holds[2], b.clone().addScaledVector(axisY, -.45), b, .075, 6)
      }
      batch.rod(steel, lipTop, catchTop, .032, 5)
      const flag = at(jump.takeoff, side * (w + .29), -.2)
      batch.rod(charcoal, flag, flag.clone().addScaledVector(axisY, 1.58), .085)
      batch.rod(saffron, flag.clone().addScaledVector(axisY, 1.02), flag.clone().addScaledVector(axisY, 1.58), .11)
      for (let i = 1; i <= 3; i++) {
        const d = jump.takeoff - 1.1 * i
        ribbon(saffron, d - .25, d, side * (w - .49), side * (w - 1.00 - i * .14), .028)
      }
    }
    for (const [s, receiver] of [[jump.takeoff, false], [jump.landing, true]] as const) {
      const accent = receiver ? teal : saffron
      batch.strip(accent, -w, w, (l, top) => at(s, l, top ? .017 : -.40), .42)
      ribbon(accent, receiver ? s : s - .28, receiver ? s + .28 : s, -w, w, .019, 16)
    }
    // Large chevrons emphasize the takeoff angle and carry the eye over the void.
    for (let i = 0; i < 3; i++) {
      const start = jump.rampStart + .12 + .95 * i
      for (const side of [-1, 1]) batch.surface(white, start, start + .85, (d, t) =>
        at(d, side * (.08 + (1 - (d - start) / .85) * 1.25 + t * .31), .023), .31)
    }
  }
  const safetyGlass = new THREE.Group()
  shields.finish(safetyGlass)
  for (const pane of safetyGlass.children) { pane.castShadow = false; pane.receiveShadow = false }
  group.add(safetyGlass)

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

  // Mount the deck on paired stadium shoring frames. Galvanized crossbraces and
  // adjuster collars make the high lanes visibly supported without filling the room.
  for (let s = 1.8, stand = 0; s < track.length; s += 11.9, stand++) {
    if (cruxJumps.some(jump => s > jump.takeoff - .4 && s < jump.landing + .4)) continue
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
    for (let h = floorY + .5; h + 2 < beamY; h += 10.6) {
      const chord = Math.min(beamY, h + 10.5)
      const side = (Math.round((h - floorY) / 10.6) + stand) % 2 ? 1 : -1
      batch.rod(metal, point(side * span, h), point(-side * span, chord), .068, 6)
      batch.rod(metal, point(-span, h), point(span, h), .068, 6)
    }
  }

  const stationsView = createCruxStations(track, group)
  const stations = [{ s: .20, name: 'START' }, { s: track.finishS, name: 'FINISH' }]
  for (const [index, { s, name }] of stations.entries()) {
    const start = index === 0
    const p = track.sample(s), normal = new THREE.Vector3(p.tx, 0, p.tz), yaw = Math.atan2(normal.x, normal.z)
    const top = Math.max(at(s, -w).y, at(s, w).y, p.y) + (start ? 2.8 : 3.3)
    const badge = gateSign(name, palette[0])
    for (const side of [-1, 1]) {
      const base = rim(s, side, .23, -.34), crown = base.clone(); crown.y = top + .55
      batch.box(charcoal, base.clone().lerp(crown, .5), [.36, crown.y - base.y, .30], yaw)
      batch.box(saffron, crown.clone().addScaledVector(axisY, -.95), [.39, 1.30, .32], yaw)
      batch.rod(steel, rim(s - .85, side, .23, -.15), crown.clone().addScaledVector(axisY, -1.4), .064)
      // Optical timing eyes flank the actual leading-edge crossing plane.
      const eye = rim(s, side, .015, .36)
      batch.box(black, eye, [.25, .31, .28], yaw)
      batch.rod(saffron, eye, eye.clone().add(new THREE.Vector3(-side * p.rx * .16, 0, -side * p.rz * .16)), .072, 8)
    }
    const center = new THREE.Vector3(p.x, top, p.z), signWidth = 2 * w + .71
    batch.box(charcoal, center, [signWidth + .07, 1.15, .31], yaw)
    for (const side of [-1, 1]) {
      const transform = new THREE.Matrix4().makeRotationY(yaw + (side < 0 ? Math.PI : 0))
      transform.setPosition(center.clone().addScaledVector(normal, side * .159))
      batch.add(badge, new THREE.PlaneGeometry(signWidth, 1.08), transform)
    }
    if (start) continue
    for (let col = 0; col < 18; col++) for (let row = 0; row < 2; row++)
      ribbon((col + row) % 2 ? white : black, s + row * .23, s + (row + 1) * .23, -w + col * w / 9, -w + (col + 1) * w / 9, .019)
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
  ribbon(black, track.finishS + 1.1, track.length, -w + .11, w - .11, .022, 20)
  const end = track.sample(track.length)
  batch.box(black, lifted(end, .55), [.30, 1.18, w * 2 + .14], -Math.atan2(end.tz, end.tx))
  batch.finish(group)
  return Object.assign(group, { frameCamera }, stationsView)
}
