import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import type { Racer } from './ui';
import type { MarbleState } from './simulation';
import type { PrismTrack } from './track';
import { createPrismScenery } from './scenery';

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
  private gateRaised = false;
  private mode: 'preview' | 'grid' | 'race' | 'podium' = 'preview';
  private shot = -1;
  private previousCut = -10;
  private sectionAnchors: THREE.Vector3[] = [];
  private viewSize = new THREE.Vector2();

  constructor(private canvas: HTMLCanvasElement, private track: PrismTrack) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.8));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.93;
    this.scene.background = new THREE.Color('#dedfd6');
    this.scene.fog = new THREE.FogExp2('#e5e5db', 0.006);
    const environment = new RoomEnvironment();
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(environment, 0.04).texture;
    this.scene.environmentIntensity = 0.55;
    environment.dispose(); pmrem.dispose();

    this.scene.add(new THREE.HemisphereLight('#fff7e4', '#918878', 0.9));
    const sun = new THREE.DirectionalLight('#ffecd1', 2.3);
    sun.position.set(-18, 38, -22);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -30, right: 30, top: 30, bottom: -30, near: 1, far: 100 });
    sun.shadow.camera.updateProjectionMatrix();
    sun.shadow.normalBias = 0.026;
    sun.shadow.bias = -0.00032;
    this.scene.add(sun, sun.target);
    const fill = new THREE.DirectionalLight('#d2e9ff', 0.35);
    fill.position.set(14, 8, 16);
    this.scene.add(fill);
    this.scene.add(createPrismScenery(track));

    this.ballShape = new THREE.SphereGeometry(track.radius, 40, 28);
    this.marker.renderOrder = 5;
    this.marker.scale.set(0.52, 0.31, 1);
    this.scene.add(this.marker);
    const stopShape = new THREE.BoxGeometry(0.13, 0.42, track.laneWidth * 0.65);
    const stopFinish = new THREE.MeshStandardMaterial({ color: '#d79c32', roughness: 0.35, metalness: 0.42 });
    for (let lane = 0; lane < 4; lane++) {
      const at = track.sample(track.startS + track.radius + 0.08, (lane - 1.5) * track.laneWidth);
      const stop = new THREE.Mesh(stopShape, stopFinish);
      stop.position.set(at.x, at.y + 0.17, at.z);
      stop.castShadow = true;
      this.gate.add(stop);
    }
    this.scene.add(this.gate);
    this.sectionAnchors = track.sections.map(section => {
      const p = track.sample((section.start + section.end) * 0.5);
      return new THREE.Vector3(p.x, p.y, p.z);
    });
    new ResizeObserver(() => this.resize()).observe(canvas);
    this.resize();
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
    this.focusGoal.set(0, 3.0, -0.2);
    const direction = new THREE.Vector3(0.57, 0.83, -1.28).normalize();
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
    this.positionGoal.copy(this.focusGoal).addScaledVector(direction, distance);
    this.snap();
  }

  entrants(racers: Racer[]) {
    for (const mesh of this.balls) {
      this.scene.remove(mesh);
      mesh.material.map?.dispose(); mesh.material.dispose();
    }
    this.favorite = racers.findIndex(r => r.marked);
    this.balls = racers.map((racer, index) => {
      const group = new THREE.Mesh(this.ballShape,
        new THREE.MeshPhysicalMaterial({ map: marblePaint(racer), roughness: 0.205, metalness: 0.14, clearcoat: 1, clearcoatRoughness: 0.09 }));
      group.castShadow = true;
      const slot = racers.length === 2 ? index + 1 : index;
      const p = this.track.sample(this.track.startS, (slot - 1.5) * this.track.laneWidth);
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
    this.focusGoal.set(p.x + 0.4, p.y + 0.32, p.z);
    const k = Math.max(1, 1.3 / this.camera.aspect);
    this.positionGoal.copy(this.focusGoal).add(new THREE.Vector3(6, 3.6, -6.0).multiplyScalar(k));
    this.snap();
  }

  race() { this.mode = 'race'; this.gateRaised = true; }
  podium() { this.mode = 'podium'; }

  update(marbles: MarbleState[], alpha: number, dt: number, elapsed: number) {
    for (const marble of marbles) {
      const mesh = this.balls[marble.id];
      mesh.position.set(marble.previousPosition.x, marble.previousPosition.y, marble.previousPosition.z)
        .lerp(marble.position, alpha);
      mesh.quaternion.copy(marble.previousRotation).slerp(this.q.copy(marble.rotation), alpha);
    }
    this.marker.visible = this.favorite >= 0 && (this.mode === 'race' || this.mode === 'grid');
    if (this.balls[this.favorite]) {
      this.marker.position.copy(this.balls[this.favorite].position);
      this.marker.position.y += this.track.radius * 2.5;
    }
    if (this.mode === 'race') this.racingShot(marbles, elapsed);
    if (this.mode === 'podium') {
      const end = this.track.sample(this.track.finishS + 1.9);
      this.focusGoal.set(end.x, end.y + 0.35, end.z);
      this.positionGoal.copy(this.focusGoal).add(new THREE.Vector3(5.8, 5.2, 8).multiplyScalar(Math.max(1, 1.05 / this.camera.aspect)));
    }
    this.gate.position.y = THREE.MathUtils.damp(this.gate.position.y, this.gateRaised ? -0.55 : 0, 12, dt);
    const smooth = 1 - Math.exp(-dt * 5);
    this.eyes.lerp(this.positionGoal, smooth); this.focus.lerp(this.focusGoal, smooth);
    this.camera.position.copy(this.eyes); this.camera.lookAt(this.focus);
    this.renderer.render(this.scene, this.camera);
  }

  private racingShot(marbles: MarbleState[], elapsed: number) {
    const running = marbles.filter(marble => marble.finishTime === null).sort((a, b) => b.distance - a.distance);
    if (!running.length) return;
    const lead = running[0].distance;
    const pack = running.filter(m => lead - m.distance < 9);
    const center = (lead + pack[pack.length - 1].distance) / 2;
    const spread = lead - pack[pack.length - 1].distance;
    const p = this.track.sample(center + 0.75);
    const id = this.track.sections.findIndex(section => lead < section.end);
    const finish = lead >= this.track.finishS - 8;
    const next = finish ? 6 : Math.max(0, id);
    const old = this.shot;
    if (next !== old && (elapsed - this.previousCut > 2.4 || finish)) {
      this.shot = next; this.previousCut = elapsed;
    }
    const zoom = Math.max(1, 1.18 / this.camera.aspect) * (1 + spread * 0.043);
    this.focusGoal.set(p.x, p.y + 0.42, p.z);
    let offset: [number, number, number];
    switch (this.shot) {
      case 2:
        this.focusGoal.lerp(this.sectionAnchors[2], 0.22);
        offset = [7.7, 8.2, -4.4]; break;
      case 3: offset = [-3.8, 5.0, 8.6]; break;
      case 4:
        this.focusGoal.lerp(this.sectionAnchors[4], 0.2);
        offset = [-8.5, 8.0, 4.8]; break;
      case 5: offset = [4.8, 4.5, 8.3]; break;
      case 6: {
        const line = this.track.sample(this.track.finishS - 0.35);
        // Pan with the approach, then hold the timing stripe once the pack is in frame.
        const lock = THREE.MathUtils.smoothstep(center, this.track.finishS - 7.5, this.track.finishS - 1.8);
        this.focusGoal.lerp(new THREE.Vector3(line.x, line.y + 0.4, line.z), lock);
        offset = [1.8, 3.9, 8.8]; break;
      }
      default: offset = [4.5, 4.2, -7.8];
    }
    this.positionGoal.copy(this.focusGoal).add(new THREE.Vector3(...offset).multiplyScalar(zoom));
    if (old !== this.shot && old >= 0) this.snap();
  }
}
