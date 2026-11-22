import * as THREE from 'three';
import { jump } from './courses/kepler-layout.json';
import type { CourseTrack } from './courseGeometry';
import type { MarbleState } from './simulation';

// A brief ion wake traces each marble's displayed path between the two decks.
const lifetime = 0.52;
const samples = 32;

export function createKeplerTrails(group: THREE.Group, track: CourseTrack) {
  const paths = Array.from({ length: track.laneCount }, () => {
    const history: { position: THREE.Vector3; time: number }[] = [];
    const geometry = new THREE.BufferGeometry();
    const positions = new THREE.BufferAttribute(new Float32Array(samples * 9), 3).setUsage(THREE.DynamicDrawUsage);
    const colors = new THREE.BufferAttribute(new Float32Array(samples * 12), 4).setUsage(THREE.DynamicDrawUsage);
    geometry.setAttribute('position', positions);
    geometry.setAttribute('color', colors);
    const indices: number[] = [];
    for (let i = 0; i < samples - 1; i++) {
      const a = i * 3;
      indices.push(a, a + 1, a + 3, a + 1, a + 4, a + 3, a + 1, a + 2, a + 4, a + 2, a + 5, a + 4);
    }
    geometry.setIndex(indices);
    const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({
      vertexColors: true, transparent: true, depthWrite: false, side: THREE.DoubleSide,
      forceSinglePass: true, blending: THREE.AdditiveBlending, toneMapped: false,
    }));
    mesh.frustumCulled = false;
    mesh.visible = false;
    group.add(mesh);
    return { mesh, positions, colors, history };
  });
  return {
    reset(liveries: string[]) {
      paths.forEach(({ mesh, history }, i) => {
        mesh.visible = false;
        history.length = 0;
        if (liveries[i]) mesh.material.color.set(liveries[i]).lerp(new THREE.Color(0xffffff), .25);
      });
    },
    update(marbles: MarbleState[], balls: THREE.Object3D[], time: number) {
      for (const marble of marbles) {
        const { mesh, positions, colors, history } = paths[marble.id];
        while (history.length && time - history[0].time >= lifetime) history.shift();
        const s = marble.distance;
        if (s >= jump.takeoff && s <= jump.landing + 16) {
          const position = balls[marble.id].position;
          const center = track.sample(s);
          const lateral = (position.x - center.x) * center.rx + (position.z - center.z) * center.rz;
          if (s < jump.landing || position.y > track.sample(s, lateral).y + track.radius + .09) {
            const last = history.at(-1);
            if (!last || time - last.time >= 1 / 60) {
              history.push({ position: position.clone(), time });
            }
          }
        }
        mesh.visible = history.length > 1;
        if (!mesh.visible) continue;
        history.forEach(({ position, time: emitted }, i) => {
          const strength = 1 - (time - emitted) / lifetime;
          for (let j = 0; j < 3; j++) {
            const index = 3 * i + j;
            positions.setXYZ(index, position.x, position.y + (j - 1) * .21 * strength, position.z);
            colors.setXYZW(index, 1, 1, 1, j === 1 ? strength * .92 : 0);
          }
        });
        positions.needsUpdate = colors.needsUpdate = true;
        mesh.geometry.setDrawRange(0, (history.length - 1) * 12);
      }
    },
  };
}
