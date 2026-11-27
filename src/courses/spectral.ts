import { buildCourse, clamp, ease, type CollisionMesh, type CourseTrack, type Profile, type TrackSample } from '../courseGeometry'
import layout from './spectral-layout.json'
import type { RaceCheckpoint } from '../checkpointRace'
import { checkpointRack } from './checkpointRack'
import { spectralFan, spectralFanLateralShift, spectralFanWidthScale } from './spectralFan'

export const spectralLaunch = layout.launch
export const spectralFields = layout.fields
type Field = typeof spectralFields[number]
const { drop, end: catchEnd, radius: scoopRadius, exitGrade } = spectralLaunch
const exitAngle = Math.atan2(1, exitGrade)
const { halfWidth, sections } = layout
const galleryRuns = layout.runs.slice(1)
const galleryLength = galleryRuns.reduce((sum, run) => sum + run.length, 0)

/** Distance under a grade that ramps smoothly from zero to one over 3 units. */
function rampDrop(distance: number) {
  if (distance <= 0) return 0
  if (distance >= 3) return distance - 1.5
  const t = distance / 3
  return 3 * t ** 3 * (1 - .5 * t)
}

/** North and south poles exchange strength with the race clock. Both the rail
 * lights and the lateral impulse use this exact travelling wave. */
export function spectralPolarity(field: Field, s: number, seconds: number, gates?: readonly RaceCheckpoint[]) {
  // Coils alongside a deployed station switch off while the brake and launch belts steer the field.
  if (gates?.some(gate => gate.cut && s >= gate.entryS && s <= gate.s + checkpointRack.launchEnd)) return 0
  return Math.cos((s - field.start) * Math.PI * 2 / field.pitch - seconds * 1.65 + field.phase)
    * ease(field.start, field.start + 3, s) * (1 - ease(field.end - 3, field.end, s))
}

/** Normal to the chute, blending into the vertical guard extrusion at the joint. */
export function spectralOffset(s: number) {
  const angle = clamp((s - drop) / scoopRadius, 0, exitAngle)
    + (Math.PI / 2 - exitAngle) * ease(drop, catchEnd, s)
  return { x: Math.cos(angle), y: Math.sin(angle) }
}

function galleryProfile(): Profile {
  const grade = .039, bank = .57, transitionDrop = 1.35
  const fanGrade = spectralFan.grade - grade
  // Carry the table's descent into the exit bank so a racer deflected by the
  // rotor can regain speed before the long magnetic straight.
  const fanDrop = (s: number) => fanGrade
    * (rampDrop(s - spectralFan.startS + 3) - rampDrop(s - spectralFan.endS - 30))
  const inverter = spectralFields[1]
  const apronDrop = (exitGrade - grade) * 16
  const top = 3 + galleryLength * grade + apronDrop + layout.bends.length * 2 * transitionDrop
    + fanGrade * (spectralFan.endS - spectralFan.startS + 3)
  const blendLength = 9
  return {
    openStart: true,
    layered: true,
    roundedLaneDepth: .14,
    collisionResolution: { rowSpacing: .66, bandsPerLane: 4 },
    widthScale: d => spectralFanWidthScale(d + catchEnd),
    lateralShift: d => spectralFanLateralShift(d + catchEnd),
    divider: d => 1 - ease(4, 19, d),
    // A marble can climb the full outside shoulder after a fast change of
    // direction. Open guards rise through each bend and taper into its runout.
    wallHeight(d) {
      const s = d + catchEnd
      let guard = 0
      for (const bend of layout.bends) {
        if (s < bend.start - 12) break
        guard = Math.max(guard, ease(bend.start - 12, bend.start, s) - ease(bend.end, bend.end + 12, s))
      }
      // The traveling field can drive a packed group sideways into the wall.
      // Catch a marble riding up over its neighbors while the coils still pull.
      for (const field of spectralFields) {
        const active = ease(field.start - 6, field.start, s) - ease(field.end, field.end + 6, s)
        guard = Math.max(guard, .65 * active)
      }
      return 1.5 + 3.5 * guard
    },
    spans: [
      { start: 0, end: sections[3].end - catchEnd, surface: 'alloy' },
      { start: sections[4].start - catchEnd, end: sections[5].end - catchEnd, surface: 'glass' },
      { start: sections[6].start - catchEnd, end: sections[7].end - catchEnd, surface: 'alloy' },
      { start: sections[8].start - catchEnd, end: galleryLength, surface: 'glass' },
    ],
    deflectors: [],
    height(d, lateral) {
      const s = d + catchEnd
      let cant = 0, shoulder = 0, descent = 0
      for (const bend of layout.bends) {
        if (s < bend.start - blendLength) break
        const entry = ease(bend.start - blendLength, bend.start + blendLength, s)
        const exit = ease(bend.end - blendLength, bend.end + blendLength, s)
        cant -= (entry - exit) * bend.side
        shoulder += entry - exit
        descent += entry + exit
      }
      const across = lateral / halfWidth
      // Preserve forward roll through the stronger reversals on the inverter,
      // including a slow pack restarting from Flywheel Bend.
      const inverterDrop = .032 * (rampDrop(s - inverter.start + 3) - rampDrop(s - inverter.end))
      return top - grade * d - apronDrop * (1 - Math.exp(-d / 16)) - fanDrop(s) - inverterDrop
        - transitionDrop * descent + cant * bank * lateral
        + shoulder * (.68 * across ** 2 + .92 * across ** 6)
    },
  }
}

/** The chute and every side guard sweep around the same cylinder as the
 * racing line. Extruding in world Y would flatten the guards in the shaft. */
function launchMesh(sample: CourseTrack['sample'], wallHeight: number): CollisionMesh {
  const vertices: number[] = [], indices: number[] = []
  const bands = layout.laneCount * 4
  const columns = bands + 3
  const rows = Math.ceil(catchEnd / .24)
  for (let row = 0; row <= rows; row++) {
    const s = row * catchEnd / rows, normal = spectralOffset(s)
    for (let column = 0; column < columns; column++) {
      const lateral = -halfWidth + 2 * halfWidth * clamp(column - 1, 0, bands) / bands
      const p = sample(s, lateral)
      const h = column === 0 || column === columns - 1 ? wallHeight : 0
      vertices.push(p.x + h * normal.x, p.y + h * normal.y, p.z)
      if (!row || !column) continue
      const a = (row - 1) * columns + column - 1
      indices.push(a, a + 1, a + columns, a + 1, a + columns + 1, a + columns)
    }
  }
  return { vertices: new Float32Array(vertices), indices: new Uint32Array(indices), surface: 'alloy' }
}

export function buildSpectralTrack(): CourseTrack {
  // The horizontal layout starts at the tangent point underneath the scoop.
  // The shaft has a constant horizontal projection; it needs its own inverse.
  const lower = buildCourse('spectral', {
    ...layout, runs: galleryRuns, startS: 0, finishS: layout.finishS - catchEnd,
    origin: { ...layout.origin, x: layout.origin.x + catchEnd },
  }, galleryProfile)
  const foot = lower.sample(0, -halfWidth + lower.laneWidth / 2)
  const cx = foot.x + scoopRadius * Math.cos(exitAngle), cy = foot.y + scoopRadius * Math.sin(exitAngle)
  function sample(s: number, lateral = 0): TrackSample {
    if (s >= catchEnd) return lower.sample(s - catchEnd, lateral)
    const normal = spectralOffset(s)
    const lip = lower.sample(0, lateral)
    const angle = clamp((s - drop) / scoopRadius, 0, exitAngle)
    const relief = lip.y - foot.y
    return { x: cx - scoopRadius * Math.cos(angle) + relief * normal.x,
      y: cy + Math.max(0, drop - Math.max(0, s)) - scoopRadius * Math.sin(angle) + relief * normal.y,
      z: lip.z, tx: 1, tz: 0, rx: 0, rz: 1 }
  }
  function locate(x: number, z: number, hint?: number, y?: number) {
    const lateral = z - layout.origin.z
    if (y !== undefined && (hint === undefined || hint <= catchEnd + 1) && x <= foot.x) {
      const s = y >= cy ? clamp(drop - (y - cy), 0, drop)
        : Math.min(catchEnd, drop + scoopRadius * Math.atan2(cy - y, cx - x))
      if (hint !== undefined) return { s, lateral }
      // An unhinted lookup must also consider the lower decks near the shaft.
      const p = sample(s, lateral)
      if (Math.abs(lateral) < halfWidth + lower.radius && Math.hypot(x - p.x, y - p.y) < 1.2) return { s, lateral }
    }
    const at = lower.locate(x, z, hint === undefined ? undefined : Math.max(0, hint - catchEnd), hint === undefined ? y : undefined)
    return { s: at.s + catchEnd, lateral: at.lateral }
  }
  return {
    ...lower, length: lower.length + catchEnd, startS: layout.startS, finishS: layout.finishS, sections,
    sample, locate, divider: s => lower.divider(Math.max(0, s - catchEnd)),
    wallHeight: s => lower.wallHeight(Math.max(0, s - catchEnd)),
    surfaceAt: s => lower.surfaceAt(Math.max(0, s - catchEnd)),
    collisions: [launchMesh(sample, lower.wallHeight(0)), ...lower.collisions],
  }
}
