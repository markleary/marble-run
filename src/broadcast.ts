import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import type { Racer } from './ui';
import type { MarbleState } from './simulation';
import { FIXED_DT } from './simulation';
import type { CourseTrack } from './track';
import type { CourseId } from './courses/catalog';
import { createCourseScenery, type CourseScenery } from './scenery';
import keplerNebula from './assets/kepler-nebula.jpg';
import { createKeplerTrails } from './keplerTrails';
import { keplerStars } from './keplerStars';

type Offset = [number, number, number];
interface Shot { offset: Offset; portraitOffset?: Offset; anchor?: number; fixed?: boolean; trackRelative?: boolean; holdPastEnd?: number }
const shots: Record<CourseId, Shot[]> = {
  prism: [
    { offset: [4.5, 4.2, -7.8] }, { offset: [4.5, 4.2, -7.8] },
    { offset: [7.7, 8.2, -4.4], anchor: 0.22 }, { offset: [-3.8, 5, 8.6] },
    { offset: [-8.5, 8, 4.8], anchor: 0.2 }, { offset: [4.8, 4.5, 8.3] },
  ],
  timber: [
    { offset: [4.2, 5.4, -8.8] },
    { offset: [2, 11.5, -10.2], trackRelative: true },
    { offset: [1.6, 6.8, -10.8], trackRelative: true },
    { offset: [9.6, 6.3, 5.2], anchor: 0.12 },
    { offset: [-5.8, 5.1, 8.4] }, { offset: [4.5, 5.1, 8.8] },
  ],
  wireworks: [
    { offset: [4, 5.5, -8.5] }, { offset: [6, 4.5, -9] },
    { offset: [7.5, 6.5, -4] },
    { offset: [13, 21, 2], portraitOffset: [0.5, 22, -9], fixed: true },
    { offset: [9, 7.5, 6], anchor: 0.12 }, { offset: [3, 5.5, 9.5] },
  ],
  frostline: [
    { offset: [3.2, 5.8, -9.4] }, { offset: [2, 10, -10.5], anchor: 0.12 },
    { offset: [8, 5.3, -6.4] }, { offset: [13, 20, 2], portraitOffset: [0.4, 20, -8], fixed: true },
    { offset: [7.6, 7.3, 9.3], anchor: 0.12 }, { offset: [-3.4, 5.8, 9.6] },
  ],
  orrery: [
    { offset: [4, 6, -9], trackRelative: true },
    { offset: [-3, 7, 9], trackRelative: true },
    { offset: [2, 10, -11], trackRelative: true },
    { offset: [3, 20, 14], portraitOffset: [13, 18, 1], fixed: true },
    { offset: [3, 9, -11], trackRelative: true },
    { offset: [9, 2.8, -3], portraitOffset: [7, 1.15, -1], trackRelative: true },
    { offset: [1.6, 3.8, 9], trackRelative: true },
    { offset: [4, 6, 9], trackRelative: true },
  ],
  crux: [
    { offset: [4, 5.4, 8.6] }, { offset: [-4, 4.4, 8.4] },
    { offset: [-2.5, 5.8, 7.3], trackRelative: true },
    { offset: [5.8, 5.7, -8.8], portraitOffset: [6.8, 6.5, -5.4], trackRelative: true },
    { offset: [4, 8.1, -7.4], trackRelative: true },
    { offset: [-7.1, 4.2, 7.5] }, { offset: [-3, 6.7, 7.8], trackRelative: true },
    { offset: [-3.8, 6.1, 9.3] }, { offset: [-1.5, 8.7, -7.2], trackRelative: true },
    { offset: [-5, 5.4, 8.4] }, { offset: [3.2, 4.7, 8.1], trackRelative: true },
    { offset: [-4.5, 5.1, 8.2] },
  ],
  tideglass: [
    { offset: [4, 6, 9] }, { offset: [2, 8, 10] },
    { offset: [6, 11, -9], trackRelative: true }, { offset: [4.5, 11, 8] },
    { offset: [2, 8, 10], trackRelative: true }, { offset: [4, 10, 10] },
    { offset: [-4, 8, 9] }, { offset: [4, 6, 10] },
  ],
  kepler: [
    { offset: [4, 5.5, 10], trackRelative: true },
    { offset: [-4, 7.5, 10], trackRelative: true },
    { offset: [-2, 8.5, -11], trackRelative: true },
    { offset: [-5, 6.5, 10], trackRelative: true },
    { offset: [2, 7, 10], trackRelative: true },
    { offset: [-4, 5.8, 12], trackRelative: true },
    // Track the balls across the empty span and through first contact down the catch deck.
    { offset: [1.5, 6.6, 17.5], portraitOffset: [5.5, 5.4, 11], trackRelative: true, holdPastEnd: 12 },
    { offset: [-6.2, 7.5, 6.8], trackRelative: true },
    // Look down the open trough so its high outside shoulder never fills the foreground.
    { offset: [-7.8, 8.5, 4.8], portraitOffset: [-8.4, 7.1, 3.2], trackRelative: true },
    { offset: [-5.4, 7.0, 6.8], trackRelative: true },
  ],
};

const settings: Record<CourseId, { sky: string; fog: string; haze: number; preview: Offset; finishApproach?: number }> = {
  prism: { sky: '#dedfd6', fog: '#e5e5db', haze: 0.006, preview: [0.57, 0.83, -1.28] },
  frostline: { sky: '#b8d8e8', fog: '#cedfe7', haze: 0.004, preview: [-0.55, 1.05, 1.35] },
  timber: { sky: '#edd5b3', fog: '#e6d4bd', haze: 0.005, preview: [0.9, 0.95, 1.2] },
  wireworks: { sky: '#b4cbd0', fog: '#c4d0cc', haze: 0.004, preview: [0.9, 1.02, 1.22] },
  orrery: { sky: '#17283c', fog: '#293c55', haze: 0.003, preview: [0.52, 1.05, 1.27], finishApproach: 2.8 },
  crux: { sky: '#d0d9d6', fog: '#cad4d0', haze: 0.00165, preview: [0.49, 1.06, 1.44] },
  tideglass: { sky: '#cbe1d3', fog: '#d1e2d8', haze: 0.0042, preview: [0.48, 1.28, 1.45] },
  kepler: { sky: '#070b18', fog: '#18203c', haze: 0.0014, preview: [-0.53, 0.85, 1.38] },
};

function disposeScenery(root: THREE.Group) {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>();
  root.traverse(object => {
    if (!(object instanceof THREE.Mesh || object instanceof THREE.Points)) return;
    geometries.add(object.geometry);
    for (const mat of Array.isArray(object.material) ? object.material : [object.material]) materials.add(mat);
    if (object instanceof THREE.InstancedMesh) object.dispose();
  });
  for (const mat of materials) {
    for (const resource of Object.values(mat)) if (resource instanceof THREE.Texture) textures.add(resource);
    mat.dispose();
  }
  for (const geo of geometries) geo.dispose();
  for (const tex of textures) tex.dispose();
}

function marblePaint(racer: Racer) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = racer.color;
  ctx.fillRect(0, 0, 512, 256);
  ctx.fillStyle = '#fff5d9';
  ctx.fillRect(0, 95, 512, 5);
  ctx.fillRect(0, 108, 512, 38);
  ctx.fillRect(0, 154, 512, 5);
  for (const x of [80, 336]) {
    ctx.fillStyle = '#252923';
    ctx.beginPath();
    ctx.arc(x, 128, 30, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#fff5d9';
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.fillStyle = '#fff5d9';
    ctx.font = 'bold 40px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(racer.symbol + 1), x, 129);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

function pickMarker() {
  const canvas = document.createElement('canvas');
  canvas.width = 80;
  canvas.height = 48;
  const c = canvas.getContext('2d')!;
  c.beginPath();
  c.moveTo(16, 9); c.lineTo(64, 9); c.lineTo(40, 37); c.closePath();
  c.fillStyle = '#fff7da'; c.strokeStyle = '#202923'; c.lineWidth = 6;
  c.stroke(); c.fill();
  return new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(canvas), depthTest: false, toneMapped: false }));
}

export class RaceBroadcast {
  private renderer: THREE.WebGLRenderer;
  private sun = new THREE.DirectionalLight('#ffecd1', 2.3);
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(35, 1, 0.12, 450);
  private focus = new THREE.Vector3();
  private eyes = new THREE.Vector3();
  private positionGoal = new THREE.Vector3();
  private focusGoal = new THREE.Vector3();
  private q = new THREE.Quaternion();
  private ballShape: THREE.SphereGeometry;
  private balls: THREE.Mesh<THREE.SphereGeometry, THREE.MeshPhysicalMaterial>[] = [];
  private marker = pickMarker();
  private favorite = -1;
  private gate = new THREE.Group();
  private scenery?: CourseScenery;
  private trails?: ReturnType<typeof createKeplerTrails>;
  private previewCenter = new THREE.Vector3();
  private cameraRight = new THREE.Vector3();
  private cameraUp = new THREE.Vector3();
  private sightLine = new THREE.Vector3();
  private relative = new THREE.Vector3();
  private gateRaised = false;
  private mode: 'preview' | 'grid' | 'race' | 'podium' = 'preview';
  private shot = -1;
  private previousCut = -10;
  private sectionAnchors: THREE.Vector3[] = [];
  private fixedFrames: THREE.Vector3[][] = [];
  private viewSize = new THREE.Vector2();

  constructor(private canvas: HTMLCanvasElement, private track: CourseTrack) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.8));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.93;
    const environment = new RoomEnvironment();
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(environment, 0.04).texture;
    this.scene.environmentIntensity = 0.55;
    environment.dispose(); pmrem.dispose();

    this.scene.add(new THREE.HemisphereLight('#fff7e4', '#918878', 0.9));
    const sun = this.sun;
    sun.position.set(-18, 38, -22);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.normalBias = 0.026;
    sun.shadow.bias = -0.00032;
    this.scene.add(sun, sun.target);
    const fill = new THREE.DirectionalLight('#d2e9ff', 0.35);
    fill.position.set(14, 8, 16);
    this.scene.add(fill);

    this.ballShape = new THREE.SphereGeometry(1, 40, 28);
    this.marker.renderOrder = 5;
    this.marker.scale.set(0.52, 0.31, 1);
    this.scene.add(this.marker);
    this.setCourse(track);
    new ResizeObserver(() => this.resize()).observe(canvas);
    this.resize();
  }

  setCourse(track: CourseTrack) {
    if (this.scenery) {
      this.scene.remove(this.scenery);
      disposeScenery(this.scenery);
    }
    this.track = track;
    const theme = settings[track.id];
    // Reset the light when leaving the moving Kepler rig. The Crux terraces
    // require both a wider shadow frustum and more distance to the light.
    const extent = track.id === 'crux' ? 71 : 40;
    this.sun.target.position.set(0, 0, 0);
    this.sun.position.set(-18, 38, -22).multiplyScalar(track.id === 'crux' ? 2.15 : 1);
    Object.assign(this.sun.shadow.camera, { left: -extent, right: extent, top: extent, bottom: -extent, near: 1, far: extent * 2.5 });
    this.sun.shadow.camera.updateProjectionMatrix();
    if (this.scene.background instanceof THREE.Texture) this.scene.background.dispose();
    this.scene.background = new THREE.Color(theme.sky);
    this.scene.fog = new THREE.FogExp2(theme.fog, theme.haze);
    const redraw = () => {
      if (this.track === track && (this.mode === 'preview' || this.mode === 'podium')) this.renderer.render(this.scene, this.camera);
    };
    if (track.id === 'kepler') {
      const sky = new THREE.TextureLoader().load(keplerNebula, redraw);
      sky.mapping = THREE.EquirectangularReflectionMapping;
      sky.colorSpace = THREE.SRGBColorSpace;
      this.scene.background = sky;
    }
    this.scenery = createCourseScenery(track, redraw);
    if (track.id === 'kepler') this.scenery.add(keplerStars(this.renderer.getPixelRatio()));
    this.trails = track.id === 'kepler' ? createKeplerTrails(this.scenery, track) : undefined;
    this.scene.add(this.scenery);
    this.gate = new THREE.Group();
    const stopShape = new THREE.BoxGeometry(0.13, 0.42, track.laneWidth * 0.65);
    const stopFinish = new THREE.MeshStandardMaterial({ color: '#d79c32', roughness: 0.35, metalness: 0.42 });
    for (let lane = 0; lane < track.laneCount; lane++) {
      const at = track.sample(track.startS + track.radius + 0.08, (lane - (track.laneCount - 1) / 2) * track.laneWidth);
      const stop = new THREE.Mesh(stopShape, stopFinish);
      stop.position.set(at.x, at.y + 0.17, at.z);
      stop.rotation.y = -Math.atan2(at.tz, at.tx);
      stop.castShadow = true;
      this.gate.add(stop);
    }
    this.scenery.add(this.gate);
    this.sectionAnchors = track.sections.map(section => {
      const p = track.sample((section.start + section.end) * 0.5);
      return new THREE.Vector3(p.x, p.y, p.z);
    });
    this.fixedFrames = track.sections.map((section, index) => {
      const edges: THREE.Vector3[] = [];
      if (shots[track.id][index].fixed) {
        for (let s = section.start - 2; s <= section.end + 2; s += 1) {
          for (const lateral of [-track.halfWidth, track.halfWidth]) {
            const p = track.sample(s, lateral);
            edges.push(new THREE.Vector3(p.x, p.y + track.radius, p.z));
          }
        }
      }
      return edges;
    });
    const bounds = new THREE.Box3();
    for (let s = 0; s < track.length + 1; s += 1) {
      for (const edge of [-track.halfWidth, track.halfWidth]) {
        const p = track.sample(s, edge);
        bounds.expandByPoint(new THREE.Vector3(p.x, p.y, p.z));
      }
    }
    bounds.getCenter(this.previewCenter);
    this.previewCenter.y *= 0.78;
    this.preview();
  }

  private resize() {
    const w = Math.max(1, this.canvas.clientWidth), h = Math.max(1, this.canvas.clientHeight);
    this.renderer.getSize(this.viewSize);
    if (w !== this.viewSize.x || h !== this.viewSize.y) this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    if (this.mode === 'preview') this.preview();
  }

  private snap() {
    this.eyes.copy(this.positionGoal);
    this.focus.copy(this.focusGoal);
    this.camera.position.copy(this.eyes);
    this.camera.lookAt(this.focus);
  }

  preview() {
    this.mode = 'preview';
    this.gateRaised = false;
    this.marker.visible = false;
    this.focusGoal.copy(this.previewCenter);
    const direction = new THREE.Vector3(...settings[this.track.id].preview).normalize();
    // Fit the actual curved raceway, allowing the studio floor to extend beyond the frame.
    this.camera.position.copy(this.focusGoal).add(direction);
    this.camera.lookAt(this.focusGoal);
    this.camera.updateMatrixWorld();
    const right = new THREE.Vector3().setFromMatrixColumn(this.camera.matrixWorld, 0);
    const up = new THREE.Vector3().setFromMatrixColumn(this.camera.matrixWorld, 1);
    const tan = Math.tan(THREE.MathUtils.degToRad(this.camera.fov * 0.5));
    let distance = 1;
    for (let s = 0; s <= this.track.length + 1; s += 2) {
      for (const l of [-this.track.halfWidth - 0.45, this.track.halfWidth + 0.45]) {
        const p = this.track.sample(s, l);
        for (const y of [0, p.y + 1.3]) {
          const v = new THREE.Vector3(p.x, y, p.z).sub(this.focusGoal);
          const extent = Math.max(Math.abs(v.dot(right)) / this.camera.aspect, Math.abs(v.dot(up)));
          distance = Math.max(distance, v.dot(direction) + 1.07 * extent / tan);
        }
      }
    }
    if (this.track.id === 'kepler' && this.canvas.clientHeight < 360) {
      this.focusGoal.addScaledVector(up, -distance * tan * .14);
    }
    // Fitting a long course in a tall viewport can place the overview camera hundreds of units away.
    this.camera.far = Math.max(450, distance + 220);
    this.camera.updateProjectionMatrix();
    this.positionGoal.copy(this.focusGoal).addScaledVector(direction, distance);
    this.snap();
  }

  entrants(racers: Racer[]) {
    this.trails?.reset(racers.map(racer => racer.color));
    for (const mesh of this.balls) {
      this.scene.remove(mesh);
      mesh.material.map?.dispose(); mesh.material.dispose();
    }
    this.favorite = racers.findIndex(r => r.marked);
    this.balls = racers.map((racer, index) => {
      const group = new THREE.Mesh(this.ballShape,
        new THREE.MeshPhysicalMaterial({ map: marblePaint(racer), roughness: 0.205, metalness: 0.14, clearcoat: 1, clearcoatRoughness: 0.09 }));
      group.castShadow = true;
      group.scale.setScalar(this.track.radius);
      const slot = Math.floor((this.track.laneCount - racers.length) / 2) + index;
      const p = this.track.sample(this.track.startS, (slot - (this.track.laneCount - 1) / 2) * this.track.laneWidth);
      group.position.set(p.x, p.y + this.track.radius, p.z);
      group.rotation.set(0.35, index * 0.6, 0.16);
      this.scene.add(group);
      return group;
    });
  }

  grid() {
    this.mode = 'grid'; this.shot = -1; this.previousCut = -10;
    this.gateRaised = false;
    const p = this.track.sample(this.track.startS);
    this.focusGoal.set(p.x + 0.4 * p.tx, p.y + 0.45, p.z + 0.4 * p.tz);
    const k = Math.max(1, 1.4 / this.camera.aspect);
    this.positionGoal.copy(this.focusGoal).add(new THREE.Vector3(7.2 * p.tx - 8 * p.rx, 5.4, 7.2 * p.tz - 8 * p.rz).multiplyScalar(k));
    this.snap();
  }

  race() { this.mode = 'race'; this.gateRaised = true; }
  podium() { this.mode = 'podium'; }

  update(marbles: MarbleState[], alpha: number, dt: number, elapsed: number) {
    const displayTime = this.mode === 'race' ? Math.max(0, elapsed - (1 - alpha) * FIXED_DT) : elapsed;
    this.scenery?.setRaceTime?.(displayTime);
    for (const marble of marbles) {
      const mesh = this.balls[marble.id];
      mesh.visible = marble.cutAt === undefined;
      if (!mesh.visible) continue;
      mesh.position.set(marble.previousPosition.x, marble.previousPosition.y, marble.previousPosition.z)
        .lerp(marble.position, alpha);
      mesh.quaternion.copy(marble.previousRotation).slerp(this.q.copy(marble.rotation), alpha);
    }
    this.marker.visible = this.favorite >= 0 && this.balls[this.favorite].visible && (this.mode === 'race' || this.mode === 'grid');
    if (this.balls[this.favorite]) {
      this.marker.position.copy(this.balls[this.favorite].position);
      this.marker.position.y += this.track.radius * 2.5;
    }
    if (this.mode === 'race') {
      this.racingShot(marbles, elapsed);
      this.trails?.update(marbles, this.balls, displayTime);
    }
    if (this.mode === 'podium') {
      const end = this.track.sample(this.track.finishS + 1.9);
      this.focusGoal.set(end.x, end.y + 0.35, end.z);
      this.positionGoal.copy(this.focusGoal).add(new THREE.Vector3(5.8, 5.2, 8).multiplyScalar(Math.max(1, 1.05 / this.camera.aspect)));
    }
    this.gate.position.y = THREE.MathUtils.damp(this.gate.position.y, this.gateRaised ? -0.55 : 0, 12, dt);
    const smooth = 1 - Math.exp(-dt * 5);
    this.eyes.lerp(this.positionGoal, smooth); this.focus.lerp(this.focusGoal, smooth);
    this.camera.position.copy(this.eyes); this.camera.lookAt(this.focus);
    if (this.track.id === 'kepler') {
      // The relay spans more than the studio shadow camera. Keep contact shadows on the racing pack.
      this.sun.target.position.copy(this.focus);
      this.sun.position.set(this.focus.x - 18, this.focus.y + 38, this.focus.z - 22);
    }
    this.scenery?.frameCamera?.(this.camera);
    this.renderer.render(this.scene, this.camera);
  }

  private racingShot(marbles: MarbleState[], elapsed: number) {
    const running = marbles.filter(marble => marble.finishTime === null && marble.cutAt === undefined).sort((a, b) => b.distance - a.distance);
    if (!running.length) return;
    const lead = running[0].distance;
    const pack = running.filter(m => lead - m.distance < 9);
    const center = (lead + pack[pack.length - 1].distance) / 2;
    const spread = lead - pack[pack.length - 1].distance;
    const p = this.track.sample(center + 0.75);
    const coverage = shots[this.track.id];
    const id = this.track.sections.findIndex((section, i) => lead < section.end + (coverage[i].holdPastEnd ?? 0));
    const finish = lead >= this.track.finishS - (settings[this.track.id].finishApproach ?? 8);
    const finishShot = this.track.sections.length;
    const next = finish ? finishShot : Math.max(0, id);
    const old = this.shot;
    if (next !== old && (elapsed - this.previousCut > 2.4 || finish)) {
      this.shot = next; this.previousCut = elapsed;
    }
    this.focusGoal.set(p.x, p.y + 0.42, p.z);
    let offset: Offset;
    if (this.shot === finishShot) {
      const line = this.track.sample(this.track.finishS - 0.35);
      const lock = THREE.MathUtils.smoothstep(center, this.track.finishS - 7.5, this.track.finishS - 1.8);
      this.focusGoal.lerp(this.relative.set(line.x, line.y + 0.4, line.z), lock);
      offset = [1.8 * line.tx, 5.5, 10.4];
    } else {
      const shot = shots[this.track.id][Math.max(0, this.shot)];
      if (shot.fixed) this.focusGoal.copy(this.sectionAnchors[this.shot]);
      else if (shot.anchor) this.focusGoal.lerp(this.sectionAnchors[this.shot], shot.anchor);
      offset = this.camera.aspect < 0.8 && shot.portraitOffset ? shot.portraitOffset : shot.offset;
      if (shot.trackRelative) {
        // Frame the pack in the local coordinates of the bend.
        this.focusGoal.set(0, 0, 0);
        for (const marble of pack) this.focusGoal.add(marble.position);
        this.focusGoal.divideScalar(pack.length);
        const [forward, up, side] = offset;
        offset = [forward * p.tx + side * p.rx, up, forward * p.tz + side * p.rz];
      }
    }
    this.sightLine.set(...offset);
    const fixedFrame = this.fixedFrames[this.shot];
    const fixed = fixedFrame?.length > 0;
    const zoom = fixed ? 1 : Math.max(1, 1.18 / this.camera.aspect) * (1 + spread * 0.043);
    const baseDistance = this.sightLine.length() * zoom;
    this.sightLine.normalize();
    this.cameraRight.crossVectors(this.camera.up, this.sightLine).normalize();
    this.cameraUp.crossVectors(this.sightLine, this.cameraRight);
    const tan = Math.tan(THREE.MathUtils.degToRad(this.camera.fov * 0.5));
    let distance = baseDistance;
    // A fixed camera frames its entire section. Tracking cameras fit the lead pack.
    const subjects = fixed ? fixedFrame : pack.map(marble => marble.position);
    for (const subject of subjects) {
      this.relative.copy(subject).sub(this.focusGoal);
      const width = (Math.abs(this.relative.dot(this.cameraRight)) + this.track.radius * 1.6) / this.camera.aspect;
      const height = Math.abs(this.relative.dot(this.cameraUp)) + this.track.radius * 2.0;
      distance = Math.max(distance, this.relative.dot(this.sightLine) + Math.max(width, height) / (tan * 0.86));
    }
    this.positionGoal.copy(this.focusGoal).addScaledVector(this.sightLine, distance);
    if (old !== this.shot && old >= 0) this.snap();
  }
}
