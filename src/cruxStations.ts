import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { cruxCheckpoints, cruxFunnelRails, cruxFunnelTubes, cruxRack, cruxRackSlot } from './courses/cruxCheckpoints'
import { createCruxRejectChute } from './cruxRejectChute'
import type { MarbleState } from './simulation'
import type { RaceCheckpoint } from './cruxCompetition'
import type { CourseTrack } from './track'
import { SceneryBatch, canvasTexture, lifted, material } from './sceneryKit'

const cream = '#fff8e4'
const stationColors = ['#f0ae32', '#159c98', '#df5733', '#527ab1']
const worldUp = new THREE.Vector3(0, 1, 0)

function stationFace(ctx: CanvasRenderingContext2D, name: string, accent: string, survivors: number, seated: number, released: boolean) {
  const open = survivors === 0
  ctx.fillStyle = '#15272d'; ctx.fillRect(0, 0, 768, 208)
  ctx.fillStyle = '#284349'; ctx.fillRect(0, 0, 768, 8)
  ctx.fillStyle = accent; ctx.fillRect(0, 0, 20, 208)
  ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillStyle = cream
  ctx.font = '800 83px Barlow Condensed, Arial Narrow, sans-serif'
  ctx.fillText(name, 44, 66, 675)
  ctx.fillStyle = open || released ? '#7be4b4' : '#ffca61'
  ctx.font = '700 41px Barlow Condensed, Arial Narrow, sans-serif'
  ctx.fillText(open ? 'OPEN SPLIT' : released ? 'RELEASED' : survivors + ' BALLS SURVIVE', 49, 151)
  if (open) return
  for (let i = 0; i < survivors; i++) {
    ctx.beginPath(); ctx.arc(744 - (survivors - i) * 37, 153, 12, 0, Math.PI * 2)
    ctx.fillStyle = i < seated || released ? '#73e8b3' : '#596363'; ctx.fill()
  }
}

/** The runner supplies the actual marble poses. Only the machine and its sign
 * animate here, using the same timing line, seats and bar as the simulation. */
export function createCruxStations(track: CourseTrack, group: THREE.Group) {
  const graphite = material('#20292d', .48, .31), rubber = material('#293034', .87)
  const steel = material('#aeb9b7', .32, .54), chrome = material('#d5deda', .18, .78)
  const white = material(cream, .54), red = material('#e65336', .48)
  const idle = material('#519c97', .45), frame = new SceneryBatch()
  const width = track.halfWidth
  const entryLabel = material(cream, .58)
  entryLabel.map = canvasTexture(256, 80, ctx => {
    ctx.fillStyle = '#155653'; ctx.fillRect(0, 0, 256, 80)
    ctx.fillStyle = cream; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.font = '800 60px Barlow Condensed, Arial Narrow, sans-serif'
    ctx.fillText('ENTRY', 128, 43)
  })
  const outLabel = material('#ffffff', .63)
  outLabel.map = canvasTexture(256, 80, ctx => {
    ctx.fillStyle = '#64322c'; ctx.fillRect(0, 0, 256, 80)
    ctx.fillStyle = cream; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.font = '800 66px Barlow Condensed, Arial Narrow, sans-serif'
    ctx.fillText('OUT', 128, 42)
  })

  const stations = cruxCheckpoints(track.sections).map(({s, entryS, number}) => {
    const accent = stationColors[number - 1], paint = material(accent, .49, .16)
    const at = (ds: number, lateral: number, up = 0) => lifted(track.sample(s + ds, lateral), up)
    const metalwork = new SceneryBatch(), pass = new SceneryBatch()
    const machine = new THREE.Group(), bypass = new THREE.Group()
    const plate = (batch: SceneryBatch, finish: typeof rubber, a: number, b: number, l: number, r: number, y: number) =>
      batch.surface(finish, a, b, (d, t) => at(d, l + (r - l) * t, y), Math.abs(r - l), 12)
    const p = track.sample(s)
    const normal = new THREE.Vector3(p.tx, 0, p.tz), across = new THREE.Vector3(p.rx, 0, p.rz)
    const yaw = Math.atan2(p.tx, p.tz)
    // An overhead blade names the checkpoint from either direction. The two skinny
    // legs stand outside the playfield, leaving a clear view of the row and throat.
    const signAt = at(.85, 0, 2.18), boardWidth = 5.45, boardHeight = 1.48
    const center = at(.85, 0)
    signAt.y = Math.max(center.y, at(.85, width).y, at(.85, -width).y) + 2.26
    frame.add(graphite, new RoundedBoxGeometry(boardWidth + .20, boardHeight + .18, .23, 2, .11),
      new THREE.Matrix4().makeRotationY(yaw).setPosition(signAt))
    for (const side of [-1, 1]) {
      const foot = at(.85, side * (width + .14), -.21), top = foot.clone(); top.y = signAt.y
      frame.rod(graphite, foot, top, .095)
      frame.rod(chrome, top, signAt.clone().addScaledVector(across, side * boardWidth / 2), .083)
      frame.rod(paint, top.clone().addScaledVector(worldUp, -.62), top.clone().addScaledVector(worldUp, -.21), .118)
    }
    const map = canvasTexture(768, 208, () => {})
    const face = material('#ffffff', .56); face.map = map
    for (const side of [-1, 1]) {
      const transform = new THREE.Matrix4().makeRotationY(yaw + (side < 0 ? Math.PI : 0))
      transform.setPosition(signAt.clone().addScaledVector(normal, side * .124))
      frame.add(face, new THREE.PlaneGeometry(boardWidth, boardHeight), transform)
    }
    const end = cruxRack.launchEnd
    const rails = cruxFunnelRails(width)
    const innerEdge = (offset: number) => {
      const rail = rails.find(({start, end}) => start.lateral > 0 && start.s <= offset && end.s >= offset)
      if (!rail) return cruxRack.throatHalfWidth
      const u = (offset - rail.start.s) / (rail.end.s - rail.start.s)
      return THREE.MathUtils.lerp(rail.start.lateral, rail.end.lateral, u) - cruxRack.railHeight / 2
    }
    plate(frame, rubber, -cruxRack.funnelLength, end, -width + .12, width - .12, .027)
    const entry = entryS - s
    // The leading edge of the white band is the scored line, before any brake ribs.
    plate(frame, white, entry, entry + .23, -width + .1, width - .1, .044)
    for (const side of [-1, 1]) {
      const lens = at(entry, side * (width + .06), .47)
      frame.box(graphite, lens, [.29, .78, .35], yaw)
      frame.rod(paint, lens, lens.clone().addScaledVector(across, -side * .18), .12)
      const tag = lens.clone().addScaledVector(across, side * .45).addScaledVector(worldUp, .53)
      frame.box(graphite, tag, [1.4, .46, .15], yaw)
      for (const face of [-1, 1]) {
        const transform = new THREE.Matrix4().makeRotationY(yaw + (face < 0 ? Math.PI : 0))
          .setPosition(tag.clone().addScaledVector(normal, face * .079))
        frame.add(entryLabel, new THREE.PlaneGeometry(1.33, .41), transform)
      }
    }
    plate(metalwork, graphite, cruxRack.seatOffset - .76, cruxRack.barOffset + .39, -width + .15, width - .15, .046)
    for (let block = 0; block < 22; block++) {
      const l = -width + .17 + (2 * width - .34) * block / 22
      plate(metalwork, block % 2 ? white : red, cruxRack.barOffset + .29, cruxRack.barOffset + .58,
        l, l + (2 * width - .34) / 22, .049)
    }
    // Low-profile brake ribs follow the converging width and end at the fork.
    for (let d = -cruxRack.funnelLength + .70; d < -.45; d += .88) {
      const half = innerEdge(d) - .14
      plate(metalwork, graphite, d, d + .105, -half, half, .048)
      plate(metalwork, steel, d, d + .025, -half, half, .050)
    }
    for (const tube of cruxFunnelTubes(track, s, number)) {
      const a = new THREE.Vector3().copy(tube.start), b = new THREE.Vector3().copy(tube.end)
      const direction = b.clone().sub(a)
      const shape = new THREE.CapsuleGeometry(tube.radius, direction.length(), 3, 12)
      const transform = new THREE.Matrix4().makeRotationFromQuaternion(
        new THREE.Quaternion().setFromUnitVectors(worldUp, direction.normalize())).setPosition(a.clone().lerp(b, .5))
      metalwork.add(tube.upper ? steel : paint, shape, transform)
      if (tube.upper) {
        metalwork.rod(graphite, b.clone().addScaledVector(worldUp, -.71), b, .075, 8)
      } else {
        metalwork.rod(steel, a.clone().addScaledVector(worldUp, cruxRack.railHeight * .43),
          b.clone().addScaledVector(worldUp, cruxRack.railHeight * .43), .045, 6)
      }
    }
    // Fixed straight-through seams remain visible when the capture guides are parked.
    for (const side of [-1, 1]) {
      const l = side * (width - .48)
      plate(pass, idle, -cruxRack.funnelLength + .3, end, l - .05, l + .05, .045)
      for (let j = 0; j < 3; j++) {
        const d = -cruxRack.funnelLength + 1 + j * 1.15
        metalwork.surface(white, d, d + .65, (ds, t) => {
          const u = (ds - d) / .65
          const edge = innerEdge(ds)
          return at(ds, side * (edge + .20 + .42 * u + t * .16), .048)
        }, .16)
      }
      const axle = at(cruxRack.barOffset, l, .25)
      frame.box(graphite, axle, [.53, .51, .49], yaw)
      frame.box(paint, axle.clone().addScaledVector(worldUp, .19), [.48, .21, .46], yaw)
    }

    const powered = material('#76918d', .45, .37)
    for (let d = cruxRack.barOffset + .83; d < end - .26; d += .46) {
      // Only the roller crowns protrude above the black belt.
      metalwork.rod(steel, at(d, -width + .65, -.047), at(d, width - .65, -.047), .108, 10)
    }
    for (let d = cruxRack.barOffset + 1.0; d < end - .74; d += 1.6) for (const side of [-1, 1]) {
      metalwork.surface(powered, d, d + .58, (ds, t) =>
        at(ds, side * (.08 + (1 - (ds - d) / .58) * .86 + t * .19), .070), .19)
    }
    const slots = new THREE.Group(), bar = new THREE.Group()
    // A slat carries each qualifying marble to a distinct socket. Slot centers
    // are recomputed for every field size so a two-survivor rack is centered too.
    let capacity = -1
    const rebuildSeats = (count: number) => {
      if (count === capacity) return
      capacity = count
      for (const child of [...slots.children, ...bar.children]) {
        if (child instanceof THREE.Mesh) child.geometry.dispose()
      }
      slots.clear(); bar.clear()
      if (!count) return
      const seatBatch = new SceneryBatch(), barBatch = new SceneryBatch()
      for (let i = 0; i < count; i++) {
        const l = cruxRackSlot(count, i)
        // Fanned belt guide marks converge at the throat and align with the rack.
        for (const sign of [-1, 1]) {
          seatBatch.surface(steel, .24, cruxRack.seatOffset + .14, (d, t) => {
            const u = THREE.MathUtils.smoothstep(d, .24, cruxRack.seatOffset - .44)
            const target = l + sign * .32
            return at(d, target * (.12 + .88 * u) + .035 * t, .054)
          }, .035)
        }
        for (let rib = 0; rib < 4; rib++) {
          const d = cruxRack.seatOffset - .75 + rib * .23
          plate(seatBatch, steel, d, d + .052, l - .28, l + .28, .058)
        }
      }
      const half = Math.abs(cruxRackSlot(count, 0)) + .66
      const left = at(cruxRack.barOffset, -half, .58), right = at(cruxRack.barOffset, half, .58)
      barBatch.rod(chrome, left, right, .117, 16)
      for (const side of [-1, 1]) {
        const cap = at(cruxRack.barOffset, side * half, .58)
        barBatch.rod(chrome, cap.clone().addScaledVector(across, -.08), cap.clone().addScaledVector(across, .08), .166, 12)
        const end = at(cruxRack.barOffset, side * (width - .46), .55)
        barBatch.rod(steel, cap, end, .064, 8)
        barBatch.rod(steel, end.clone().addScaledVector(worldUp, -.32), end, .082, 8)
      }
      seatBatch.finish(slots); barBatch.finish(bar)
    }
    const reject = createCruxRejectChute(track, s, machine, { rubber, stripe: red, chrome, label: outLabel })
    metalwork.finish(machine); pass.finish(bypass)
    machine.add(slots, bar); group.add(machine, bypass)
    const ctx = (map.image as HTMLCanvasElement).getContext('2d')!
    let labelState = ''
    const update = (gate: RaceCheckpoint | undefined, seconds: number) => {
      const count = gate?.cut ? gate.field - 1 : 0
      const releasedAt = gate?.releasedAt ?? null
      const released = releasedAt !== null
      const seated = gate?.seated.length ?? 0
      machine.visible = count > 0; bypass.visible = count === 0
      rebuildSeats(count)
      reject.jetLights.visible = gate?.divertedAt != null && seconds >= gate.divertedAt && !released
      // Retract the gate into the bed, leaving the line visible as the pack launches.
      const progress = releasedAt === null ? 0 : THREE.MathUtils.smoothstep(seconds - releasedAt, 0, .24)
      bar.position.y = -.93 * progress
      const label = count + '/' + seated + '/' + released
      if (labelState === label) return
      powered.color.set(released ? '#5de4a6' : '#76918d')
      powered.emissive.set(released ? '#195838' : '#000000')
      stationFace(ctx, 'Checkpoint ' + number, accent, count, seated, released)
      map.needsUpdate = true; labelState = label
    }
    return { number, update, roll: reject.roll }
  })
  frame.finish(group)
  return {
    updateStations(gates: readonly RaceCheckpoint[] | undefined, seconds: number) {
      for (const station of stations) station.update(gates?.find(g => g.number === station.number), seconds)
    },
    showCutMarble(mesh: THREE.Object3D, marble: MarbleState, gate: RaceCheckpoint, seconds: number,
      field: readonly MarbleState[], alpha: number) {
      const last = gate.arrivals[gate.field - 1]
      if (last?.id !== marble.id || gate.divertedAt === null) return false
      stations[gate.number - 1].roll(mesh, marble, seconds, gate.divertedAt, gate.pocketAt, field, alpha)
      return true
    },
  }
}
