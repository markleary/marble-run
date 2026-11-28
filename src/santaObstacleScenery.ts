import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import type { CourseTrack } from './courseGeometry'
import { parcel, parcelHeight, pinwheel, pinwheelAngle, pinwheelLift, santaMachines } from './courses/santaObstacles'
import { SceneryBatch, canvasTexture, material, type Material } from './sceneryKit'

const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z)
const tau = 2 * Math.PI

function stripedSugar() {
  const map = canvasTexture(192, 384, ctx => {
    ctx.fillStyle = '#fff2da'
    ctx.fillRect(0, 0, 192, 384)
    for (let n = -1; n < 5; n++) {
      for (const [offset, width, color] of [[0, 39, '#b81c33'], [46, 8, '#ed3742']] as const) {
        const y = n * 96 + offset
        ctx.fillStyle = color
        ctx.beginPath()
        ctx.moveTo(0, y)
        ctx.lineTo(192, y + 96)
        ctx.lineTo(192, y + 96 + width)
        ctx.lineTo(0, y + width)
        ctx.fill()
      }
    }
  })
  const sugar = material('#ffffff', .25, .05)
  sugar.map = map
  return sugar
}

function peppermintFace() {
  const map = canvasTexture(256, 256, ctx => {
    ctx.translate(128, 128)
    ctx.fillStyle = '#fff3da'
    ctx.fillRect(-128, -128, 256, 256)
    const wedge = (start: number, width: number, ink: string) => {
      ctx.fillStyle = ink
      ctx.beginPath()
      ctx.moveTo(0, 0)
      for (let i = 1; i <= 24; i++) {
        const r = i / 24, a = start - .89 * r
        ctx.lineTo(169 * r * Math.cos(a), 169 * r * Math.sin(a))
      }
      for (let i = 24; i >= 0; i--) {
        const r = i / 24, a = start + width - .89 * r
        ctx.lineTo(169 * r * Math.cos(a), 169 * r * Math.sin(a))
      }
      ctx.fill()
    }
    for (let i = 0; i < 7; i++) {
      wedge(tau * i / 7, .35, '#c21d31')
      wedge(tau * i / 7 + .47, .065, '#e54446')
    }
  })
  const face = material('#ffffff', .29, .08)
  face.map = map
  return face
}

function wrappingPaper(base: string, pattern: string) {
  const map = canvasTexture(128, 128, ctx => {
    ctx.fillStyle = base
    ctx.fillRect(0, 0, 128, 128)
    ctx.fillStyle = pattern
    for (let row = -1; row <= 4; row++) for (let col = -1; col <= 4; col++) {
      const x = 32 * col + (row % 2 ? 16 : 0), y = 32 * row
      ctx.beginPath()
      ctx.moveTo(x, y - 5)
      ctx.quadraticCurveTo(x + .8, y - .8, x + 4.2, y)
      ctx.quadraticCurveTo(x + .8, y + .8, x, y + 5)
      ctx.quadraticCurveTo(x - .8, y + .8, x - 4.2, y)
      ctx.quadraticCurveTo(x - .8, y - .8, x, y - 5)
      ctx.fill()
      ctx.beginPath()
      ctx.arc(x + 8, y + 12, 1, 0, tau)
      ctx.fill()
    }
  })
  const paper = material('#ffffff', .43, .13)
  paper.map = map
  return paper
}

function liftHatch() {
  const map = canvasTexture(256, 256, c => {
    c.fillStyle = '#382b29'
    c.fillRect(0, 0, 256, 256)
    c.fillStyle = '#b48248'
    c.fillRect(2, 2, 252, 252)
    c.fillStyle = '#684636'
    c.fillRect(6, 6, 244, 244)
    c.fillStyle = '#292b32'
    c.fillRect(11, 11, 234, 234)
    c.strokeStyle = '#565653'
    c.lineWidth = 2
    for (let x = 34; x < 245; x += 11) {
      c.beginPath()
      c.moveTo(x, 18)
      c.lineTo(x, 238)
      c.stroke()
    }
    for (const x of [0, 256]) for (const y of [0, 256]) {
      c.save()
      c.translate(x, y)
      c.scale(x ? -1 : 1, y ? -1 : 1)
      c.fillStyle = '#e5b573'
      c.beginPath()
      c.moveTo(4, 4)
      c.lineTo(46, 4)
      c.lineTo(4, 46)
      c.fill()
      c.fillStyle = '#4c473e'
      c.beginPath()
      c.arc(12, 12, 4.2, 0, tau)
      c.fill()
      c.strokeStyle = '#b9ab86'
      c.beginPath()
      c.moveTo(9.8, 13.8)
      c.lineTo(14.2, 10.2)
      c.stroke()
      c.restore()
    }
  })
  const steel = material('#ffffff', .55, .19)
  steel.map = map
  return steel
}

function bowLoop(batch: SceneryBatch, silk: Material, side: number) {
  const geo = new THREE.PlaneGeometry(1, 1, 1, 20)
  const pos = geo.getAttribute('position')
  for (let row = 0; row <= 20; row++) {
    const t = row / 20, curl = Math.sin(Math.PI * t), fold = Math.sin(tau * t)
    for (let col = 0; col < 2; col++) {
      pos.setXYZ(2 * row + col, side * .36 * curl,
        parcel.height / 2 + .037 + .19 * curl + .072 * fold, .045 * fold + (col - .5) * .12)
    }
  }
  geo.computeVertexNormals()
  batch.add(silk, geo)
}

export function addSantaObstacles(track: CourseTrack, group: THREE.Group) {
  const { wheels, boxes } = santaMachines(track)
  const cream = material('#fff1d5', .31), red = material('#bd1534', .26, .16)
  const brass = material('#d6a355', .30, .56), iron = material('#35464b', .56, .33)
  const mint = stripedSugar(), swirl = peppermintFace()
  const staticParts = new SceneryBatch()

  const mold = material('#ffffff', .46, .23)
  mold.map = canvasTexture(256, 256, c => {
    c.translate(128, 128)
    c.fillStyle = '#38393b'
    c.fillRect(-128, -128, 256, 256)
    const ring = (r: number, width: number, color: string) => {
      c.lineWidth = width
      c.strokeStyle = color
      c.beginPath()
      c.arc(0, 0, r, 0, tau)
      c.stroke()
    }
    ring(121, 11, '#ad8053')
    ring(116, 3, '#ebc88d')
    ring(110, 4, '#584943')
    ring(99, 2, '#716659')
    for (let i = 0; i < 24; i++) {
      c.save()
      c.rotate(i * tau / 24)
      c.fillStyle = '#24292d'
      c.fillRect(22, -1.2, 81, 2.4)
      if (i % 2 === 0) {
        c.fillStyle = '#eac589'
        c.beginPath()
        c.arc(121, 0, 2.2, 0, tau)
        c.fill()
      }
      c.restore()
    }
    ring(91, 3, '#272b30')
    ring(57, 3, '#272b30')
    ring(22, 4, '#a78058')
  })
  const rotors = wheels.map(w => {
    const machine = new THREE.Group(), pieces = new SceneryBatch()
    machine.position.set(w.at.x, w.at.y, w.at.z)
    const hub = pinwheel.axleRadius, head = pinwheel.axleHeight
    pieces.rod(brass, v(0, -.10, 0), v(0, .11, 0), hub, 24)
    pieces.rod(red, v(0, .11, 0), v(0, head - .025, 0), hub, 32)
    pieces.rod(cream, v(0, head - .071, 0), v(0, head - .031, 0), hub + .004, 32)
    const face = new THREE.CircleGeometry(hub, 36)
    face.rotateX(-Math.PI / 2).translate(0, head - .021, 0)
    pieces.add(swirl, face)
    pieces.rod(brass, v(0, head - .021, 0), v(0, head, 0), .082, 8)
    for (let i = 0; i < pinwheel.arms; i++) {
      const a = i * tau / pinwheel.arms, end = v(Math.cos(a) * pinwheel.reach, pinwheel.armY, Math.sin(a) * pinwheel.reach)
      const start = v(0, pinwheel.armY, 0)
      pieces.rod(mint, start, end, pinwheel.stickRadius, 16)
      pieces.rod(brass, start.clone().lerp(end, .31), start.clone().lerp(end, .37), pinwheel.stickRadius + .023, 16)
      pieces.rod(brass, start.clone().lerp(end, .78), start.clone().lerp(end, .85), pinwheel.stickRadius + .014, 16)
      pieces.add(red, new THREE.SphereGeometry(pinwheel.tipRadius, 18, 12).translate(end.x, end.y, end.z))
      const crown = new THREE.CircleGeometry(pinwheel.tipRadius * .56, 20)
      crown.rotateX(-Math.PI / 2).translate(end.x, end.y + pinwheel.tipRadius * .83, end.z)
      pieces.add(swirl, crown)
    }
    // A stamped steel candy mold sits flush with the downhill surface. The entire
    // rotating head withdraws into the drum, opening the lane without a ceiling pinch.
    const radius = pinwheel.reach + pinwheel.tipRadius + .15
    const plate = new THREE.CircleGeometry(radius, 44)
    const position = plate.getAttribute('position')
    for (let j = 0; j < position.count; j++) {
      const p = track.sample(track.sections[1].start + w.offset + position.getX(j), w.lateral - position.getY(j))
      position.setXYZ(j, p.x, p.y + .017, p.z)
    }
    plate.computeVertexNormals()
    staticParts.add(mold, plate)
    staticParts.rod(iron, v(w.at.x, w.at.y - 1.36, w.at.z), v(w.at.x, w.at.y - .34, w.at.z), radius, 32)
    staticParts.rod(brass, v(w.at.x, w.at.y - 1.29, w.at.z), v(w.at.x, w.at.y - 1.23, w.at.z), radius + .012, 32)
    pieces.finish(machine)
    group.add(machine)
    return machine
  })

  const papers = [wrappingPaper('#b92340', '#e26c6f'), wrappingPaper('#10755d', '#53aa80'), wrappingPaper('#245e79', '#69a2a8')]
  const silks = [brass, material('#edcc8a', .34, .36), material('#e84c55', .32, .25)]
  const hatch = liftHatch()
  const lifts = boxes.map((box, i) => {
    const { width, height, depth, bevel } = parcel
    const machine = new THREE.Group(), pieces = new SceneryBatch(), silk = silks[i % silks.length]
    machine.position.set(box.at.x, box.at.y, box.at.z)
    machine.rotation.y = box.yaw
    pieces.add(papers[i % papers.length], new RoundedBoxGeometry(width, height, depth, 2, bevel))
    // Two continuous bands wrap the sides, top and underside of each parcel.
    pieces.add(silk, new RoundedBoxGeometry(.19, height + .014, depth + .014, 2, .065))
    pieces.add(silk, new RoundedBoxGeometry(width + .014, height + .026, .19, 2, .065))
    for (const side of [-1, 1]) bowLoop(pieces, silk, side)
    const knot = new THREE.SphereGeometry(parcel.knotRadius, 12, 8)
    knot.scale(.75, .63, .84).translate(0, height / 2 + .096, 0)
    pieces.add(silk, knot)
    pieces.finish(machine)
    group.add(machine)

    // Follow the actual pitch and crossfall at the four corners of the lift well.
    const plate = new THREE.PlaneGeometry(width + .62, depth + .62, 2, 2)
    const positions = plate.getAttribute('position')
    const angle = box.yaw + Math.atan2(box.at.tz, box.at.tx)
    for (let j = 0; j < positions.count; j++) {
      const x = positions.getX(j), z = -positions.getY(j)
      const p = track.sample(box.s + x * Math.cos(angle) + z * Math.sin(angle),
        box.lateral - x * Math.sin(angle) + z * Math.cos(angle))
      positions.setXYZ(j, p.x, p.y + .018, p.z)
    }
    plate.computeVertexNormals()
    staticParts.add(hatch, plate)
    staticParts.box(iron, v(box.at.x, box.at.y - .98, box.at.z), [width + .33, 1.62, depth + .33], box.yaw)
    return machine
  })
  staticParts.finish(group)
  const setRaceTime = (seconds: number) => {
    rotors.forEach((mesh, i) => {
      const wheel = wheels[i]
      mesh.rotation.y = pinwheelAngle(wheel, seconds)
      mesh.position.y = wheel.at.y + pinwheelLift(wheel, seconds)
    })
    lifts.forEach((mesh, i) => { mesh.position.y = boxes[i].at.y + parcelHeight(boxes[i], seconds) })
  }
  setRaceTime(0)
  return setRaceTime
}
