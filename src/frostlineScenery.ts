import * as THREE from 'three'
import type { CourseTrack } from './track'
import { SceneryBatch, axisY, canvasTexture, lifted, material, signBoard, woodTexture, type Material } from './sceneryKit'
import { buildWinterVillage, createSnowTerrain } from './winterVillage'

const GATE_COLORS = ['#1c6984', '#5dabc2', '#d6ebed', '#e87653', '#bb3743', '#39495d']

/** Marks frozen into the ice repeat with the track UVs. All racing surfaces are opaque. */
function iceTexture() {
  const ice = canvasTexture(512, 256, ctx => {
    ctx.fillStyle = '#c6edf4'
    ctx.fillRect(0, 0, 512, 256)
    let state = 1907
    const random = () => {
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0
      return state / 0x100000000
    }
    for (let i = 0; i < 190; i++) {
      const x = random() * 512, y = random() * 256
      const length = 8 + random() ** 2 * 165, bend = (random() - .5) * 32
      ctx.strokeStyle = i % 4 === 0 ? 'rgba(72,149,180,.15)' : 'rgba(255,255,255,.28)'
      ctx.lineWidth = .4 + random() * 1.3
      for (const offset of [-512, 0]) {
        ctx.beginPath()
        ctx.moveTo(x + offset, y)
        ctx.quadraticCurveTo(x + offset + length * .55, y + bend * .9, x + offset + length, y + bend)
        ctx.stroke()
      }
    }
  })
  ice.wrapS = ice.wrapT = THREE.RepeatWrapping
  ice.repeat.set(.58, .63)
  return ice
}

export function createFrostlineScenery(track: CourseTrack) {
  const group = new THREE.Group()
  group.name = 'Frostline Rally'
  const batch = new SceneryBatch()
  const navy = material('#243d4a', .53, .20)
  const steel = material('#7598a7', .4, .48)
  const red = material('#bd3a3f', .42, .13)
  const cream = material('#f5eed9', .6)
  const wood = material('#c2916d', .67)
  wood.map = woodTexture()
  const woodEnd = material('#8b5f4a', .78)
  const ice = material('#63b8d4', .21, .12)
  ice.map = iceTexture()
  const frostedIce = material('#b5e8f0', .43, .1)
  const pinBlue = material('#247f96', .30, .2)
  const rubber = material('#2d3843', .78)
  const snow = material('#f3f7f9', .92)
  const w = track.halfWidth
  const ground = createSnowTerrain(track, group)
  const at = (s: number, l: number, dy = 0) => lifted(track.sample(s, l), dy)
  const ribbon = (mat: Material, s0: number, s1: number, a: number, b: number, h = .014, bands = 1) =>
    batch.surface(mat, s0, s1, (s, t) => at(s, a + (b - a) * t, h), b - a, bands)

  for (const [index, section] of track.sections.entries()) {
    const { start, end } = section
    if (track.surfaceAt((start + end) * .5) === 'ice') {
      ribbon(ice, start, end, -w, w, 0, 24)
      for (const side of [-1, 1]) {
        ribbon(frostedIce, start, end, side * (w - .15), side * (w - .035))
      }
    } else {
      ribbon(wood, start, end, -w, w, 0, 36)
      // Timber planks run across the rollers and bridge. The launch boards follow the lanes.
      if (index === 0) {
        for (let lane = 1; lane < track.laneCount; lane++) {
          const l = -w + track.laneWidth * lane
          ribbon(woodEnd, start, end, l - .018, l + .018)
        }
      } else {
        for (let s = start + .85; s < end - .04; s += .86) {
          ribbon(woodEnd, s, s + .024, -w, w, .009, 18)
        }
      }
    }
    for (const side of [-1, 1]) {
      const l = side * w
      const bank = index === 5 ? red : navy
      batch.strip(bank, start, end, (s, k) => at(s, l, k ? 0 : -.42), .42)
      batch.strip(steel, start, end, (s, k) => at(s, l, k ? track.wallHeight(s) : .0), .75)
      batch.strip(navy, start, end, (s, k) => at(s, side * (w + (k ? .12 : -.04)), track.wallHeight(s) + .006), .16)
      batch.strip(bank, start, end, (s, k) => at(s, side * (w + .12), k ? track.wallHeight(s) : -.35), 1)
      if (index !== 5) {
        batch.strip(snow, start, end, (s, k) => at(s, side * (w + (k ? .12 : .075)), track.wallHeight(s) + .017), .045)
      }
    }
    ribbon(woodEnd, start, end, -w, w, -.42, 18)
  }

  // Gate grooves taper into the open S-bend exactly as their Rapier dividers do.
  const dividerEnd = track.sections[1].end
  for (let lane = 1; lane < track.laneCount; lane++) {
    const l = -w + lane * track.laneWidth
    for (const side of [-1, 1]) {
      batch.strip(cream, 0, dividerEnd, (s, k) => {
        const f = track.divider(s)
        return at(s, l + side * (k ? .018 : .048) * f, k ? .205 * f + .008 : .004)
      }, .22)
    }
  }

  // Snow poles and painted edge blocks mark the banks without placing props in a racing lane.
  for (let s = 2.5; s < track.finishS - 4; s += 3.2) {
    for (const side of [-1, 1]) {
      const p = at(s, side * (w + .09), track.wallHeight(s))
      const h = .4
      batch.rod(cream, p.clone().addScaledVector(axisY, -.25), p.clone().addScaledVector(axisY, h), .062)
      batch.rod(red, p.clone().addScaledVector(axisY, .11), p.clone().addScaledVector(axisY, .26), .064)
    }
  }

  // Twin supports and transverse beams sit below the lowest part of each bank.
  for (let s = .7; s < track.length; s += 4.0) {
    const span = w - .28
    const row = [-span, span].map(l => at(s, l, -.42))
    const beamY = Math.min(...Array.from({ length: 19 }, (_, i) => at(s, -w + 2 * w * i / 18).y)) - .56
    const ends = row.map(top => new THREE.Vector3(top.x, beamY, top.z))
    batch.rod(woodEnd, ends[0], ends[1], .14, 8)
    for (const [i, top] of row.entries()) {
      const foot = top.clone()
      foot.y = ground(foot.x, foot.z) - .06
      if (top.y <= foot.y) continue
      batch.rod(woodEnd, foot, top, .16, 8)
      batch.box(navy, foot, [.57, .24, .56])
      if (top.y - foot.y > 3) {
        const braceEnd = ends[i].clone().lerp(ends[1 - i], .35)
        batch.rod(wood, foot.clone().lerp(top, .35), braceEnd, .095, 7)
      }
    }
  }

  // The bright caps sit on the same rounded, vertical pucks used by physics.
  for (const [i, pin] of track.deflectors.entries()) {
    const origin = at(pin.s, pin.lateral)
    const r = pin.radius, h = pin.height
    const rim = Math.min(.09, r * .24, h * .18)
    const profile = [
      new THREE.Vector2(r - rim, 0), new THREE.Vector2(r - rim * .27, rim * .26),
      new THREE.Vector2(r, rim), new THREE.Vector2(r, h - rim),
      new THREE.Vector2(r - rim * .27, h - rim * .26), new THREE.Vector2(r - rim, h),
      new THREE.Vector2(0, h),
    ]
    const pinMat = i % 2 === 0 ? red : pinBlue
    batch.add(pinMat, new THREE.LatheGeometry(profile, 20), new THREE.Matrix4().makeTranslation(origin.x, origin.y, origin.z))
    const up = (value: number) => origin.clone().addScaledVector(axisY, value)
    batch.rod(cream, up(h * .42), up(h * .54), r + .003, 20)
    batch.rod(cream, up(h + .002), up(h + .009), (r - rim) * .71, 20)
    batch.rod(pinMat, up(h + .010), up(h + .016), (r - rim) * .42, 16)
  }

  // Red timber trusses under the finish deck span a frozen brook.
  const bridge = track.sections[5]
  const bridgeEnd = track.length - .10
  const panels = Math.max(2, Math.round((bridgeEnd - bridge.start) / 3))
  for (const side of [-1, 1]) {
    const l = side * (w + .18)
    for (let i = 0; i < panels; i++) {
      const a = bridge.start + (bridgeEnd - bridge.start) * i / panels
      const b = bridge.start + (bridgeEnd - bridge.start) * (i + 1) / panels
      const upperA = at(a, l, -.23), upperB = at(b, l, -.23)
      const lowerA = at(a, l, -1.04), lowerB = at(b, l, -1.04)
      batch.rod(red, lowerA, lowerB, .12, 8)
      batch.rod(red, upperA, lowerA, .085, 8)
      batch.rod(red, i % 2 ? upperA : lowerA, i % 2 ? lowerB : upperB, .093, 8)
      ribbon(i % 2 ? red : cream, a, b, side * (w - .26), side * (w - .04), .018)
    }
  }

  for (const [s, finish] of [[Math.max(.08, track.startS - .9), false], [track.finishS, true]] as const) {
    const p = track.sample(s)
    const top = Math.max(at(s, w).y, at(s, -w).y, p.y) + 1.97
    for (const side of [-1, 1]) {
      const foot = at(s, side * (w + .23), -.3)
      const up = new THREE.Vector3(foot.x, top + .46, foot.z)
      batch.rod(red, foot, up, .13, 8)
      for (let level = foot.y + .5; level < top - .1; level += .55) {
        batch.rod(cream, new THREE.Vector3(foot.x, level, foot.z), new THREE.Vector3(foot.x, level + .16, foot.z), .135, 8)
      }
    }
    signBoard(group, batch, navy, GATE_COLORS, finish ? 'FINISH' : 'START', finish ? 'finish' : 'start',
      new THREE.Vector3(p.x, top, p.z), 2 * w + .67, .78, new THREE.Vector3(p.tx, 0, p.tz))
    if (finish) for (let col = 0; col < 20; col++) for (let row = 0; row < 2; row++) {
      ribbon((col + row) % 2 ? cream : navy, s + row * .25, s + (row + 1) * .25, -w + 2 * w * col / 20, -w + 2 * w * (col + 1) / 20, .017)
    }
  }
  const end = track.sample(track.length)
  batch.box(rubber, lifted(end, .56), [.20, 1.12, 2 * w + .27], -Math.atan2(end.tz, end.tx))
  buildWinterVillage(track, ground, batch)
  batch.finish(group)
  return group
}
