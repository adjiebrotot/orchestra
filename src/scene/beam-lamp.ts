import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  CylinderGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Points,
  ShaderMaterial,
  Vector3,
} from 'three';
import type { Object3D } from 'three';

import { beamSourcePlace } from '../models/beam.ts';
import type { Vec3 } from '../models/tuples.ts';
import { setUniform } from './programs.ts';

/**
 * The lamp of a visible beam (design 4.5): a spotlight on a yoke below a batten over the back of
 * the stage, at `beamSourcePlace()`. Its lens glows, and the throat of the haze comes out of it,
 * so the beam has a visible source in a tall frame. The sizes are in meters.
 */
export const BEAM_LAMP = {
  /** The housing: a cylinder along the axis of the beam. */
  housing: { radius: 0.22, length: 0.75 },
  /** The ring at the front of the housing. */
  bezel: { radius: 0.25, length: 0.08 },
  /** The radius of the lens at the front of the housing. */
  lens: 0.19,
  /**
   * The light of the lens, in linear values, before the exposure (`STAGE_TONE`). It is above the
   * threshold of the bloom, so the lens shows as the brightest point of the beam.
   */
  lensLight: [7, 5.2, 3.6],
  /** The yoke: a U around the housing, its width, its height above the pivot, and its bar. */
  yoke: { width: 0.6, height: 0.42, bar: 0.03 },
  /** The height of the batten above the pivot of the lamp. */
  mount: 0.75,
  /** The batten across the stage: half its length, in stage sides, and its radius. */
  batten: { halfSpan: 0.5, radius: 0.045 },
  /** The cables of the batten: their place from the middle, in stage sides, and their length. */
  cables: { at: 0.4, length: 20, radius: 0.008 },
  /** The color of the housing, the yoke, and the batten, in sRGB: dark stage metal. */
  color: '#1f1b18',
  /**
   * The glow of the lens: a disc that faces the camera, its diameter, and its light in the middle,
   * in linear values. The bloom alone gave a lens of 0.4 m only a few pixels of halo in the wide
   * views, as the lamps of the hall (`HALL.glow`).
   */
  glow: { size: 1.6, light: [1.1, 0.75, 0.42] },
} as const;

const GLOW_VERTEX = /* glsl */ `
uniform float uSize;
uniform float uPixels;
uniform vec3 uAxis;
varying float vFacing;
void main() {
  vec4 world = modelMatrix * vec4(position, 1.0);
  vec4 view = viewMatrix * world;
  gl_Position = projectionMatrix * view;
  gl_PointSize = clamp(uSize * projectionMatrix[1][1] * uPixels * 0.5 / -view.z, 1.0, 512.0);
  // The lens faces along the beam: a camera behind the lamp sees no glow.
  vFacing = smoothstep(-0.2, 0.5, dot(normalize(cameraPosition - world.xyz), uAxis));
}
`;

const GLOW_FRAGMENT = /* glsl */ `
uniform vec3 uColor;
varying float vFacing;
void main() {
  float d = length(gl_PointCoord - 0.5) * 2.0;
  float light = exp(-7.0 * d * d) * (1.0 - smoothstep(0.75, 1.0, d));
  gl_FragColor = vec4(uColor * light * vFacing, 1.0);
  #include <colorspace_fragment>
}
`;

/** The name of the head of a lamp: the housing, the bezel, the lens, and the glow. */
const HEAD = 'lamp-head';
/** The name of the yoke of a lamp, which turns about the vertical toward the foot of the beam. */
const YOKE = 'lamp-yoke';

/**
 * Creates the lamp of one beam (design 4.5): the head, which aims along the beam, the yoke, and
 * the stem up to the batten. {@link aimLamp} aims it at the foot of the beam in each frame.
 *
 * @param stageSide The stage side `S`, in meters.
 * @param x The x of the rim light of the beam, in meters.
 * @returns The group, at the pivot of the lamp.
 */
export function createLamp(stageSide: number, x: number): Group {
  const { housing, bezel, yoke, mount } = BEAM_LAMP;
  const metal = darkMetal();
  const head = new Group();
  head.name = HEAD;
  const body = new Mesh(
    new CylinderGeometry(housing.radius, housing.radius * 0.9, housing.length, 24),
    metal,
  );
  const ring = new Mesh(
    new CylinderGeometry(bezel.radius, bezel.radius, bezel.length, 24, 1, true),
    metal,
  );
  ring.position.y = -housing.length / 2;
  const lens = new Mesh(
    new CylinderGeometry(BEAM_LAMP.lens, BEAM_LAMP.lens, 0.01, 24),
    new MeshBasicMaterial({ color: new Color(...BEAM_LAMP.lensLight) }),
  );
  lens.position.y = -housing.length / 2 - 0.01;
  head.add(body, ring, lens, createGlow(-housing.length / 2 - 0.1));

  const arms = new Group();
  arms.name = YOKE;
  const half = yoke.width / 2;
  arms.add(
    bar(metal, [-half, 0, 0], [-half, yoke.height, 0], yoke.bar),
    bar(metal, [half, 0, 0], [half, yoke.height, 0], yoke.bar),
    bar(metal, [-half, yoke.height, 0], [half, yoke.height, 0], yoke.bar),
    bar(metal, [0, yoke.height, 0], [0, mount, 0], yoke.bar),
  );

  const lamp = new Group().add(head, arms);
  lamp.name = 'lamp';
  lamp.position.set(...beamSourcePlace(stageSide, x));
  for (const part of [body, ring, lens]) {
    part.castShadow = false;
    part.receiveShadow = false;
  }
  return lamp;
}

/**
 * Creates the batten that holds the lamps of the beams (design 4.5): a pipe across the stage at the
 * height of the yokes, with two cables up into the dark above the frame.
 *
 * @param stageSide The stage side `S`, in meters.
 * @returns The group.
 */
export function createLampBatten(stageSide: number): Group {
  const { batten, cables, mount } = BEAM_LAMP;
  const [, y, z] = beamSourcePlace(stageSide);
  const top = y + mount;
  const metal = darkMetal();
  const half = batten.halfSpan * stageSide;
  const group = new Group().add(bar(metal, [-half, top, z], [half, top, z], batten.radius));
  for (const side of [-1, 1]) {
    const cx = side * cables.at * stageSide;
    group.add(bar(metal, [cx, top, z], [cx, top + cables.length, z], cables.radius));
  }
  group.name = 'lamp-batten';
  return group;
}

/** A scratch vector of {@link aimLamp}. */
const axis = new Vector3();
/** The axis of the head of a lamp before its turn: the lens faces down. */
const DOWN = new Vector3(0, -1, 0);

/**
 * Aims the head of a lamp at the foot of its beam, turns its yoke about the vertical, and sets the
 * glow of the lens for the camera (design 4.5).
 *
 * @param lamp The group of {@link createLamp}.
 * @param foot The center of the foot of the beam on the stage top, in meters.
 * @param pixels The height of the drawing buffer, in pixels, for the size of the glow.
 */
export function aimLamp(lamp: Object3D, foot: Vec3, pixels: number): void {
  axis
    .set(...foot)
    .sub(lamp.position)
    .normalize();
  const head = lamp.getObjectByName(HEAD);
  const yoke = lamp.getObjectByName(YOKE);
  if (head) {
    head.quaternion.setFromUnitVectors(DOWN, axis);
  }
  if (yoke) {
    yoke.rotation.y = Math.atan2(axis.x, axis.z);
  }
  head?.traverse((child) => {
    if (child instanceof Points && child.material instanceof ShaderMaterial) {
      const u = child.material.uniforms;
      setUniform(u, 'uPixels', pixels);
      const value = u['uAxis']?.value;
      if (value instanceof Vector3) {
        value.copy(axis);
      }
    }
  });
}

/**
 * Gives the material of the housing, the yoke, and the batten.
 *
 * @returns A dark metal.
 */
function darkMetal(): MeshStandardMaterial {
  return new MeshStandardMaterial({
    color: BEAM_LAMP.color,
    roughness: 0.45,
    metalness: 0.6,
  });
}

/**
 * Creates a round bar between two points.
 *
 * @param material The material.
 * @param from One end, in the axes of the parent.
 * @param to The other end.
 * @param radius The radius.
 * @returns The mesh.
 */
function bar(material: MeshStandardMaterial, from: Vec3, to: Vec3, radius: number): Mesh {
  const a = new Vector3(...from);
  const b = new Vector3(...to);
  const length = a.distanceTo(b);
  const mesh = new Mesh(new CylinderGeometry(radius, radius, length, 8), material);
  mesh.position.copy(a).add(b).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(new Vector3(0, 1, 0), b.sub(a).normalize());
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  return mesh;
}

/**
 * Creates the glow of a lens: one point that faces the camera, with additive light. It writes no
 * depth, so the depth passes of the beam and of the depth of field hide it as a light effect.
 *
 * @param y The place of the glow on the axis of the head, in meters.
 * @returns The point.
 */
function createGlow(y: number): Points {
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(new Float32Array([0, y, 0]), 3));
  const material = new ShaderMaterial({
    vertexShader: GLOW_VERTEX,
    fragmentShader: GLOW_FRAGMENT,
    uniforms: {
      uColor: { value: new Color(...BEAM_LAMP.glow.light) },
      uSize: { value: BEAM_LAMP.glow.size },
      uPixels: { value: 900 },
      uAxis: { value: new Vector3(0, -1, 0) },
    },
    transparent: true,
    blending: AdditiveBlending,
    depthWrite: false,
  });
  const glow = new Points(geometry, material);
  glow.frustumCulled = false;
  glow.name = 'lamp-glow';
  glow.renderOrder = 2;
  return glow;
}
