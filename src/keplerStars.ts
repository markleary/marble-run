import * as THREE from 'three';

/** Stars keep their angular positions and their fine edges as the camera tracks the pack. */
export function keplerStars(pixelRatio: number) {
  let seed = 48285;
  const random = () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296;
  const directions = [], sizes = [], colors = [];
  for (let i = 0; i < 7500; i++) {
    const y = 2 * random() - 1, azimuth = random() * 2 * Math.PI;
    const r = Math.sqrt(1 - y * y);
    directions.push(r * Math.cos(azimuth), y, r * Math.sin(azimuth));
    const magnitude = random() ** 4;
    sizes.push((1.15 + 2.15 * magnitude) * pixelRatio);
    const light = .19 + .78 * magnitude;
    const warmth = random();
    colors.push(light * (.72 + .28 * warmth), light * .88, light * (1 - .28 * warmth));
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(directions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setAttribute('size', new THREE.Float32BufferAttribute(sizes, 1));
  const stars = new THREE.Points(geometry, new THREE.ShaderMaterial({
    vertexColors: true, transparent: true, depthWrite: false,
    vertexShader: `
      attribute float size;
      varying vec3 tint;
      void main() {
        tint = color;
        gl_Position = projectionMatrix * vec4(mat3(viewMatrix) * position, 1.);
        gl_Position.z = gl_Position.w;
        gl_PointSize = size;
      }`,
    fragmentShader: `
      varying vec3 tint;
      void main() {
        float radius = 2. * length(gl_PointCoord - 0.5);
        gl_FragColor = vec4(tint, 1. - smoothstep(0., 1., radius));
        #include <colorspace_fragment>
      }`,
  }));
  stars.renderOrder = -1;
  stars.frustumCulled = false;
  return stars;
}
