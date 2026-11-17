import {
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  Color,
  DataTexture,
  DoubleSide,
  Group,
  LinearFilter,
  LinearMipmapLinearFilter,
  Matrix4,
  Mesh,
  RGBAFormat,
  SRGBColorSpace,
  ShaderMaterial,
  Vector2,
  Vector3,
} from 'three';
import type { Texture } from 'three';

import { STAGE_THICKNESS } from '../models/stage.ts';
import { rimLightPlace } from '../models/beam.ts';
import { DEFAULT_BACKDROP, screenFrame } from './backdrop-settings.ts';
import type {
  Arrangement,
  BackdropSettings,
  BannerCut,
  BannerSettings,
  FlagSettings,
  ScreenCue,
  ScreenMaterial,
} from './backdrop-settings.ts';
import { FLAG_ASPECT, drawFlag } from './country-flags.ts';
import { HALL, HALL_LIGHT, hallUnit } from './hall.ts';
import { STAGE_STYLES } from './stage-style.ts';
import type { DressingStyle } from './stage-style.ts';

/**
 * The places and the sizes of the stage dressing (design 4.5, backdrop), in meters, or in stage
 * sides `S` where a name says so. The stage axes have +z to the audience, so the back of the
 * stage is at -S/2. The objects stand on the hall floor, in the dark behind the stage, so the
 * lit players stay the subject of each shot.
 */
export const BACKDROP = {
  /** The standing banners: a row on poles just behind the stage. */
  standing: {
    /** The distance behind the back edge of the stage. */
    behind: 0.7,
    /** Half the width of the row, in stage sides. */
    halfSpan: 0.47,
    /** The width of a banner. */
    width: 0.75,
    /** The aspect of a built-in flag on a banner that follows the image. */
    flagAspect: 3,
    /** The height of the lowest point of a banner above the hall floor. */
    clearance: 0.7,
    /** The gap between the screen and the nearest banner. */
    screenGap: 0.45,
    /** The height of the pole above the top of the banner. */
    poleTop: 0.18,
    poleRadius: 0.022,
    baseRadius: 0.24,
  },
  /** The hanging banners: a row on a batten high behind the screen. */
  hanging: {
    behind: 2.3,
    /** Half the width of the row, in stage sides. */
    halfSpan: 0.66,
    width: 1.05,
    flagAspect: 2.6,
    /**
     * The height of the batten above the hall floor. The wide shots look down on the stage, so a
     * higher batten took the banners out of the frame.
     */
    batten: 4.9,
    /** The drop of the banner rod below the batten. */
    drop: 0.35,
    /**
     * The gap between the screen and the nearest banner. It is wider than the gap of the standing
     * banners, so the two rows do not stand in one line.
     */
    screenGap: 1.2,
  },
  /** The flagpole groups beside the back corners of the stage. */
  flags: {
    /** The distance of the first group from the side of the stage. */
    side: 1.1,
    /** The distance between two groups on one side. */
    spacing: 4.6,
    /** The distance in front of the back edge of the stage. A group farther out stands farther back. */
    forward: 1.1,
    /** The step back of each next group. */
    stepBack: 0.9,
    /**
     * The distance behind the back edge of the middle group of an odd count. With the screen, the
     * middle group stands on top of the screen frame, so its flags fly above the screen.
     */
    middleBehind: 1.2,
    /** The height of the pole of a middle group on top of the screen. */
    middlePole: 1.7,
    poleHeight: 3.4,
    poleRadius: 0.045,
    /** The angle of a staff from the vertical, in radians. */
    staffTilt: (40 * Math.PI) / 180,
    /** The width of a flag, from the hoist to the fly. */
    flagWidth: 1.25,
    /** The height step between two pairs of staffs on a pole. */
    pairStep: 1.1,
    /**
     * The hang of a flag at the limpness 0 and at the limpness 1 (`FlagSettings.limpness`), as the
     * flags of an indoor hall (the reference images of the indoor flags, design 4.5). The hall
     * has no wind, so a limp flag hangs from its hoist: its top edge falls steeply from the
     * finial, the fly hangs low, and deep vertical pleats gather its width. `start` and `end` are
     * the angles of the top edge below the horizontal at the hoist and at the fly, in radians.
     * `gather` is the share of the horizontal run of the top edge that the pleats leave open.
     * `wrap` is the share of the full curl of the cloth around the staff (the indoor flags of the
     * reference images wrap the cloth in front of the pole). `folds` is the count of the pleats across the flag, and `depth` their depth in widths.
     * `crease` is the shade in the hollow of a pleat, a part of the light. `wave` is the sway at
     * the fly, in meters: the slow drift of the air.
     */
    hang: {
      stiff: {
        start: 0,
        end: 0.3,
        gather: 1,
        wrap: 0,
        folds: 1.3,
        depth: 0.04,
        crease: 0.15,
        wave: 0.07,
      },
      limp: {
        start: 1.1,
        end: 1.42,
        gather: 0.85,
        wrap: 1,
        folds: 2.5,
        depth: 0.08,
        crease: 0.6,
        wave: 0.02,
      },
    },
    /**
     * The lean of each lower pair of staffs toward the audience, in radians. The flags of two
     * pairs hang one above the other, so the lean keeps the lower pair in front of the upper one.
     */
    pairLean: (14 * Math.PI) / 180,
    /**
     * The floor stands: the distance between two poles, the pole height, its radius, and the
     * radius of a round metal base.
     */
    floor: { spacing: 0.62, height: 2.8, poleRadius: 0.024, baseRadius: 0.22 },
    /**
     * The fan stand: the length of a pole, the angle between two poles, the largest angle from
     * upright, the lean back of each pole out from the middle, the radius of a pole, and the
     * radius of the base, in meters and radians.
     */
    fan: {
      length: 2.9,
      step: (20 * Math.PI) / 180,
      maxAngle: (40 * Math.PI) / 180,
      backLean: 0.12,
      poleRadius: 0.024,
      baseRadius: 0.26,
    },
  },
  /** The screen behind the orchestra, above the heads of the back row. */
  screen: {
    behind: 1.3,
    /** The width, in stage sides, with a cap in meters. */
    width: 0.37,
    maxWidth: 5.5,
    /**
     * The height of the bottom edge above the stage top: above the heads of the back row, as the
     * organ above the orchestra of the fourth reference image.
     */
    bottom: 1.55,
    /** The frame of an LED wall around the image. */
    bezel: 0.12,
    /**
     * The light of a full white pixel, as a part of 1. A low value keeps the screen below the
     * players and the lit stage, as an LED wall that a lighting designer dims for a concert. The
     * stage style scales it (`DressingStyle.screenLevel`).
     */
    level: { led: 0.22, cloth: 0.17 },
    /** The LED dots across the width, which show only in a close shot. */
    ledColumns: 192,
  },
  colors: {
    /** The color under a transparent part of an image. */
    cloth: '#e9e4da',
  },
} as const;

/** The images of the stage dressing: a texture for an image id, and the aspect of the image. */
export interface BackdropImageSource {
  /**
   * Gives the canvas of an image of the user.
   *
   * @param id The image id.
   * @returns The canvas, or `null` for an image that is not there.
   */
  canvasOf(id: string): HTMLCanvasElement | null;
}

/** A list of triangles: positions, and texture coordinates and wave weights for a cloth. */
class Triangles {
  readonly positions: number[] = [];
  readonly uvs: number[] = [];
  readonly waves: number[] = [];
  /** The shade of the crease of a pleat at each vertex that has one, by the vertex index. */
  readonly #creases = new Map<number, number>();

  /**
   * Sets the shade of the crease at the last vertex: the part of the light that the folds around
   * it block.
   *
   * @param shade The shade, from 0 for no shade to 1.
   */
  crease(shade: number): void {
    this.#creases.set(this.waves.length - 1, shade);
  }

  /**
   * Adds the triangles of a geometry, moved by a matrix.
   *
   * @param geometry The geometry.
   * @param matrix The matrix.
   */
  addGeometry(geometry: BufferGeometry, matrix: Matrix4): void {
    const flat = geometry.index ? geometry.toNonIndexed() : geometry;
    flat.applyMatrix4(matrix);
    const position = flat.getAttribute('position');
    for (let i = 0; i < position.count; i++) {
      this.positions.push(position.getX(i), position.getY(i), position.getZ(i));
      this.uvs.push(0, 0);
      this.waves.push(0);
    }
    flat.dispose();
    geometry.dispose();
  }

  /** True with no triangle. */
  get empty(): boolean {
    return this.positions.length === 0;
  }

  /**
   * Makes the geometry.
   *
   * @returns The geometry.
   */
  build(): BufferGeometry {
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new BufferAttribute(new Float32Array(this.positions), 3));
    geometry.setAttribute('uv', new BufferAttribute(new Float32Array(this.uvs), 2));
    geometry.setAttribute('wave', new BufferAttribute(new Float32Array(this.waves), 1));
    const creases = new Float32Array(this.waves.length);
    for (const [i, shade] of this.#creases) {
      creases[i] = shade;
    }
    geometry.setAttribute('crease', new BufferAttribute(creases, 1));
    geometry.computeBoundingSphere();
    return geometry;
  }
}

/**
 * Gives the rise of the bottom edge of a banner above its lowest point.
 *
 * @param cut The cut of the bottom edge.
 * @param u The place across the banner, from 0 at the left to 1 at the right.
 * @param width The width of the banner.
 * @returns The rise, in meters.
 */
export function bannerRise(cut: BannerCut, u: number, width: number): number {
  const x = Math.min(1, Math.abs(2 * u - 1));
  switch (cut) {
    case 'point':
      return 0.34 * width * x;
    case 'swallowtail':
      return 0.3 * width * (1 - x);
    case 'curved':
      return 0.45 * width * (1 - (1 - x) ** 1.6);
    case 'round':
      return 0.5 * width * (1 - Math.sqrt(1 - x * x));
    case 'straight':
      return 0;
  }
}

/** The folds of a cloth: their count across the width, their depth, and the share at the top. */
interface Folds {
  readonly count: number;
  readonly depth: number;
  /** The share of the depth at the top edge. The bottom edge has the full depth. */
  readonly top: number;
}

/**
 * Adds a banner cloth: a grid that hangs down from its top edge, with folds and a cut bottom
 * edge. The texture covers the box of the banner, so a cut removes a part of the image.
 *
 * @param list The triangles.
 * @param matrix The place of the top middle of the banner.
 * @param width The width.
 * @param height The height, from the top edge to the lowest point.
 * @param cut The cut of the bottom edge.
 * @param folds The folds.
 * @param mirror True to show the image mirrored, as the back of a cloth.
 */
function addCloth(
  list: Triangles,
  matrix: Matrix4,
  width: number,
  height: number,
  cut: BannerCut,
  folds: Folds,
  mirror = false,
): void {
  const cols = 14;
  const rows = 20;
  const point = new Vector3();
  const vertex = (i: number, j: number): void => {
    const u = i / cols;
    const bottom = -height + bannerRise(cut, u, width);
    const y = (bottom * j) / rows;
    const share = folds.top + ((1 - folds.top) * j) / rows;
    const z = folds.depth * share * Math.sin(u * Math.PI * 2 * folds.count + 0.7);
    point.set((u - 0.5) * width, y, z).applyMatrix4(matrix);
    list.positions.push(point.x, point.y, point.z);
    list.uvs.push(mirror ? 1 - u : u, 1 + y / height);
    list.waves.push(0);
  };
  for (let i = 0; i < cols; i++) {
    for (let j = 0; j < rows; j++) {
      vertex(i, j);
      vertex(i, j + 1);
      vertex(i + 1, j + 1);
      vertex(i, j);
      vertex(i + 1, j + 1);
      vertex(i + 1, j);
    }
  }
}

/** The distance of the hoist of a flag from the axis of its staff, in meters: the sleeve. */
const FLAG_CORE = 0.035;

/** The hang of a flag at one limpness: a mix of the two ends of {@link BACKDROP}.flags.hang. */
export interface FlagHang {
  /** The share of the stiff angle of the staff in the angle of the top edge, from 0 to 1. */
  readonly stiffness: number;
  /** The angle of the top edge below the horizontal at the hoist, for a limp flag, in radians. */
  readonly start: number;
  /** The angle of the top edge below the horizontal at the fly, for a limp flag, in radians. */
  readonly end: number;
  /** The share of the horizontal run of the top edge that the pleats leave open. */
  readonly gather: number;
  /** The share of the full curl of the cloth around the staff. */
  readonly wrap: number;
  /** The count of the pleats from the hoist to the fly. */
  readonly folds: number;
  /** The depth of the pleats, in widths. */
  readonly depth: number;
  /** The shade in the hollow of a pleat, a part of the light. */
  readonly crease: number;
  /** The sway at the fly, in meters. */
  readonly wave: number;
}

/**
 * Gives the hang of a flag at a limpness (design 4.5, backdrop).
 *
 * @param limpness The limpness, from 0 to 1.
 * @returns The mix of the stiff hang and the limp hang.
 */
export function flagHang(limpness: number): FlagHang {
  const { stiff, limp } = BACKDROP.flags.hang;
  const t = Math.min(1, Math.max(0, limpness));
  const mix = (a: number, b: number): number => a + (b - a) * t;
  return {
    stiffness: 1 - t,
    start: mix(stiff.start, limp.start),
    end: mix(stiff.end, limp.end),
    gather: mix(stiff.gather, limp.gather),
    wrap: mix(stiff.wrap, limp.wrap),
    folds: mix(stiff.folds, limp.folds),
    depth: mix(stiff.depth, limp.depth),
    crease: mix(stiff.crease, limp.crease),
    wave: mix(stiff.wave, limp.wave),
  };
}

/**
 * Adds a flag on a staff in the still air of the hall, as the indoor flags of the reference
 * images. The hoist runs down the staff from its tip. The top edge leaves the hoist and falls
 * toward the floor, more steeply toward the fly ({@link FlagHang}), so the fly hangs lower than
 * the hoist. A stiff flag starts the top edge along its first direction
 * ({@link FlagHang}.stiffness). Each row of the cloth follows the top edge, so the hem runs
 * parallel to the staff, as a flag on a tilted pole. The vertical pleats take a part of the
 * horizontal run of the top edge ({@link FlagHang}.gather), and the top edge keeps its length.
 * The pleats start at the hoist, run down the cloth, and open a little toward the hem. The wave
 * weight grows from the hoist to the fly.
 *
 * @param list The triangles.
 * @param tip The tip of the staff.
 * @param along The unit direction down the staff, from the tip.
 * @param out The unit direction from the hoist to the fly of a stiff flag, in the plane x-y.
 * @param width The width, from the hoist to the fly.
 * @param height The height, along the staff.
 * @param mirror True to show the image mirrored, as the back of the flag.
 * @param hang The hang of the flag.
 */
function addFlag(
  list: Triangles,
  tip: Vector3,
  along: Vector3,
  out: Vector3,
  width: number,
  height: number,
  mirror: boolean,
  hang: FlagHang,
): void {
  const cols = 40;
  const rows = 28;
  // The top edge, in the vertical plane of the flag: `side` is the horizontal direction to the
  // fly, and each angle is below the horizontal.
  const side = Math.sign(out.x) || 1;
  const outAngle = Math.atan2(-out.y, Math.abs(out.x));
  const first = outAngle * hang.stiffness + hang.start * (1 - hang.stiffness);
  const last = Math.max(first, (outAngle + 0.3) * hang.stiffness + hang.end * (1 - hang.stiffness));
  const step = width / cols;
  // The top edge: the horizontal run of each point from the finial, and its drop.
  const top: [number, number][] = [[0, 0]];
  let run = 0;
  let drop = 0;
  for (let i = 1; i <= cols; i++) {
    const f = (i - 0.5) / cols;
    const angle = first + (last - first) * f ** 0.8;
    run += Math.cos(angle) * step;
    drop -= Math.sin(angle) * step;
    top.push([run, drop]);
  }
  // A limp flag wraps around its staff: the cross-section of the cloth at each height leaves the
  // staff to the side away from the fly, curls in front of the staff, and opens out to the fly.
  // Thus the staff stands inside the cloth, as the indoor flags of the reference images. The
  // curl grows a little toward the hem. A stiff flag runs straight out to the fly.
  const limp = 1 - hang.stiffness;
  const power = 1 + 0.2 * limp;
  const span = hang.gather * run;
  const point = new Vector3();
  const vertex = (i: number, j: number): void => {
    const f = i / cols;
    const s = j / rows;
    const [tx, ty] = top[i] ?? [0, 0];
    const across = run > 0 ? tx / run : f;
    // The pleats start at the hoist, and they open a little toward the hem.
    const open = Math.min(1, across * 4) * (0.75 + 0.25 * s);
    const wave = Math.sin(Math.PI * 2 * hang.folds * across + 0.3 * s);
    const curl = limp * hang.wrap * (0.8 + 0.4 * s);
    const bow = Math.sin(Math.PI * across);
    const outward = span * (across ** power - 0.6 * curl * bow);
    const front = span * 0.35 * curl * bow + hang.depth * width * open * wave;
    point.copy(tip).addScaledVector(along, s * height);
    point.x += side * (outward + FLAG_CORE * (1 - curl));
    point.y += ty;
    point.z += front + FLAG_CORE * curl;
    list.positions.push(point.x, point.y, point.z);
    list.uvs.push(mirror ? 1 - f : f, 1 - s);
    list.waves.push(f);
    // The hollow of a pleat, seen from the hall, gets less light, as the dark creases of a
    // hanging flag.
    list.crease(hang.crease * open * (1 - wave) * 0.5);
  };
  for (let i = 0; i < cols; i++) {
    for (let j = 0; j < rows; j++) {
      vertex(i, j);
      vertex(i + 1, j + 1);
      vertex(i, j + 1);
      vertex(i, j);
      vertex(i + 1, j);
      vertex(i + 1, j + 1);
    }
  }
}

/**
 * Adds a box.
 *
 * @param list The triangles.
 * @param center The center.
 * @param size The size on x, y, and z.
 */
function addBox(list: Triangles, center: Vector3, size: Vector3): void {
  const [sx, sy, sz] = [size.x / 2, size.y / 2, size.z / 2];
  const c = (x: number, y: number, z: number): Vector3 =>
    new Vector3(center.x + x * sx, center.y + y * sy, center.z + z * sz);
  const quad = (a: Vector3, b: Vector3, d: Vector3, e: Vector3): void => {
    for (const p of [a, b, d, a, d, e]) {
      list.positions.push(p.x, p.y, p.z);
      list.uvs.push(0, 0);
      list.waves.push(0);
    }
  };
  quad(c(-1, -1, 1), c(1, -1, 1), c(1, 1, 1), c(-1, 1, 1));
  quad(c(1, -1, -1), c(-1, -1, -1), c(-1, 1, -1), c(1, 1, -1));
  quad(c(-1, 1, 1), c(1, 1, 1), c(1, 1, -1), c(-1, 1, -1));
  quad(c(-1, -1, -1), c(1, -1, -1), c(1, -1, 1), c(-1, -1, 1));
  quad(c(1, -1, 1), c(1, -1, -1), c(1, 1, -1), c(1, 1, 1));
  quad(c(-1, -1, -1), c(-1, -1, 1), c(-1, 1, 1), c(-1, 1, -1));
}

/**
 * Adds a rod between two points: a prism of six faces, as the low-poly props.
 *
 * @param list The triangles.
 * @param from One end.
 * @param to The other end.
 * @param radius The radius.
 */
function addRod(list: Triangles, from: Vector3, to: Vector3, radius: number): void {
  const axis = new Vector3().subVectors(to, from);
  const length = axis.length();
  if (length <= 0) {
    return;
  }
  axis.divideScalar(length);
  const side = Math.abs(axis.y) < 0.9 ? new Vector3(0, 1, 0) : new Vector3(1, 0, 0);
  const u = new Vector3().crossVectors(axis, side).normalize();
  const v = new Vector3().crossVectors(axis, u);
  const ring = (center: Vector3, k: number): Vector3 => {
    const a = (k / 6) * Math.PI * 2;
    return center
      .clone()
      .addScaledVector(u, radius * Math.cos(a))
      .addScaledVector(v, radius * Math.sin(a));
  };
  for (let k = 0; k < 6; k++) {
    const a = ring(from, k);
    const b = ring(from, k + 1);
    const c = ring(to, k + 1);
    const d = ring(to, k);
    for (const p of [a, b, c, a, c, d]) {
      list.positions.push(p.x, p.y, p.z);
      list.uvs.push(0, 0);
      list.waves.push(0);
    }
  }
}

/**
 * Adds a small ball: an octahedron, as the lamps of the hall.
 *
 * @param list The triangles.
 * @param center The center.
 * @param radius The radius.
 */
function addKnob(list: Triangles, center: Vector3, radius: number): void {
  const top = center.clone().setY(center.y + radius);
  const bottom = center.clone().setY(center.y - radius);
  const ring = [
    new Vector3(radius, 0, 0),
    new Vector3(0, 0, radius),
    new Vector3(-radius, 0, 0),
    new Vector3(0, 0, -radius),
  ].map((p) => p.add(center));
  for (let i = 0; i < 4; i++) {
    const a = ring[i] ?? top;
    const b = ring[(i + 1) % 4] ?? top;
    for (const p of [a, b, top, a, bottom, b]) {
      list.positions.push(p.x, p.y, p.z);
      list.uvs.push(0, 0);
      list.waves.push(0);
    }
  }
}

/**
 * Adds a round base on the floor: a flat cone of eight sides.
 *
 * @param list The triangles.
 * @param center The center on the floor.
 * @param radius The radius.
 */
function addBase(list: Triangles, center: Vector3, radius: number): void {
  const top = center.clone().setY(center.y + 0.06);
  for (let k = 0; k < 8; k++) {
    const a0 = (k / 8) * Math.PI * 2;
    const a1 = ((k + 1) / 8) * Math.PI * 2;
    const a = new Vector3(Math.cos(a0), 0, Math.sin(a0)).multiplyScalar(radius).add(center);
    const b = new Vector3(Math.cos(a1), 0, Math.sin(a1)).multiplyScalar(radius).add(center);
    for (const p of [a, top, b]) {
      list.positions.push(p.x, p.y, p.z);
      list.uvs.push(0, 0);
      list.waves.push(0);
    }
  }
}

/**
 * Gives the x of the slots of a symmetrical row.
 *
 * @param count The number of slots.
 * @param inner The x of the innermost slot of each side, or `null` to spread the row over the
 *   full width with no gap in the middle.
 * @param outer The x of the outermost slot.
 * @returns The x of each slot, from the left.
 */
export function rowSlots(count: number, inner: number | null, outer: number): number[] {
  if (count <= 0) {
    return [];
  }
  if (count === 1) {
    return [0];
  }
  if (inner === null || inner >= outer) {
    return Array.from({ length: count }, (_, i) => -outer + (2 * outer * i) / (count - 1));
  }
  const side = Math.floor(count / 2);
  const right = Array.from({ length: side }, (_, i) =>
    side === 1 ? (inner + outer) / 2 : inner + ((outer - inner) * i) / (side - 1),
  );
  const middle = count % 2 === 1 ? [0] : [];
  return [...right.map((x) => -x).toReversed(), ...middle, ...right];
}

/**
 * Adds the plinth of a floor stand: a low square block with a smaller block on top.
 *
 * @param list The triangles.
 * @param foot The middle of the bottom of the plinth.
 */
function addPlinth(list: Triangles, foot: Vector3): void {
  addBox(list, foot.clone().setY(foot.y + 0.04), new Vector3(0.36, 0.08, 0.36));
  addBox(list, foot.clone().setY(foot.y + 0.11), new Vector3(0.18, 0.06, 0.18));
}

/**
 * Adds the round base of a metal floor stand: a low disc with a dome and a collar.
 *
 * @param list The triangles.
 * @param foot The middle of the bottom of the base.
 */
function addRoundBase(list: Triangles, foot: Vector3): void {
  addBase(list, foot, BACKDROP.flags.floor.baseRadius);
  addKnob(list, foot.clone().setY(foot.y + 0.06), 0.08);
  addRod(list, foot.clone().setY(foot.y + 0.1), foot.clone().setY(foot.y + 0.22), 0.035);
}

/**
 * Adds the finial of a flag pole: a ball with a point above it.
 *
 * @param list The triangles.
 * @param top The top of the pole.
 */
function addFinial(list: Triangles, top: Vector3): void {
  addKnob(list, top.clone().setY(top.y + 0.04), 0.04);
  addRod(list, top.clone().setY(top.y + 0.07), top.clone().setY(top.y + 0.17), 0.012);
}

/**
 * Gives the image of a slot in a list of slots (design 4.5, backdrop).
 *
 * - `mirror`: when the pairs of the row can show each image, the outer pair shows the first
 *   image, the next pair the second, and so on, so the row stays symmetrical (ABCCBA). Else the
 *   slots show the images in their order from left to right, so each image shows.
 * - `repeat`: the images repeat from left to right (ABCABC).
 * - `group`: each image fills a block of next slots (AABBCC). With more images than slots, each
 *   slot shows the next image.
 *
 * @param count The number of slots.
 * @param images The images.
 * @param arrangement The order of the images.
 * @returns The image of each slot, from the left, or `null` with no image.
 */
export function slotImages(
  count: number,
  images: readonly string[],
  arrangement: Arrangement = 'mirror',
): (string | null)[] {
  const n = images.length;
  const pairs = Math.ceil(count / 2);
  const mirror = arrangement === 'mirror' && n <= pairs;
  return Array.from({ length: count }, (_, i) => {
    let rank = i;
    if (mirror) {
      rank = Math.min(i, count - 1 - i);
    } else if (arrangement === 'group' && n < count) {
      rank = Math.floor((i * n) / count);
    }
    return n === 0 ? null : (images[rank % n] ?? null);
  });
}

/**
 * Gives the flags of one flagpole group (design 4.5, backdrop). Each group has a staff for each
 * flag. A symmetrical or an alternating order gives each group all the flags. A grouped order
 * runs over the staffs of all the groups from the left, so each flag fills a block of next
 * staffs (AABBCC), and a group can show one flag on all its staffs.
 *
 * @param images The flags.
 * @param arrangement The order of the flags.
 * @param group The place of the group from the left.
 * @param groups The number of groups.
 * @returns The flag of each staff of the group.
 */
export function flagsOfGroup(
  images: readonly string[],
  arrangement: Arrangement,
  group: number,
  groups: number,
): (string | null)[] {
  if (arrangement !== 'group') {
    return [...images];
  }
  const n = images.length;
  const all = slotImages(n * groups, images, 'group');
  return all.slice(group * n, group * n + n);
}

const CLOTH_VERTEX = /* glsl */ `
attribute float wave;
attribute float crease;
uniform float uTime;
uniform float uWave;
uniform float uPlaneZ;
varying vec2 vUv;
varying vec3 vWorld;
varying float vCrease;
void main() {
  vCrease = crease;
  // A camera behind the dressing sees no part of it, as the cutaway of the hall.
  if (cameraPosition.z < uPlaneZ) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    return;
  }
  vec3 p = position;
  // A limp flag sways slowly as a whole, with a soft ripple that runs to the fly.
  float sway = sin(uTime * 0.7 + p.x * 0.4) * wave;
  float ripple = 0.3 * sin(wave * 5.0 - uTime * 1.1 + p.y * 0.9);
  p.z += uWave * wave * (sway + ripple);
  vUv = uv;
  vec4 world = modelMatrix * vec4(p, 1.0);
  vWorld = world.xyz;
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

// The light of the cloth is the baked light of the hall (\`hallLight()\`): the ambient light, and
// the glow of the lit stage from a point above the stage center. The normal of each facet comes
// from the screen derivatives, so the folds have the flat facets of the low-poly props.
const CLOTH_FRAGMENT = /* glsl */ `
uniform sampler2D uMap;
uniform vec4 uUvBox;
uniform vec3 uBase;
uniform vec3 uTint;
uniform float uUnit;
uniform float uLevel;
uniform float uSheen;
uniform vec3 uSheenLight;
uniform vec3 uSheenColor;
uniform float uAmbient;
uniform float uGlow;
uniform float uReach;
uniform float uTop;
uniform float uWallHeight;
uniform float uFloorY;
varying vec2 vUv;
varying vec3 vWorld;
varying float vCrease;
void main() {
  vec3 n = normalize(cross(dFdx(vWorld), dFdy(vWorld)));
  vec3 view = normalize(cameraPosition - vWorld);
  if (dot(n, view) < 0.0) {
    n = -n;
  }
  vec3 to = vec3(0.0, 0.25 * uUnit, 0.0) - vWorld;
  float distance = length(to);
  float facing = max(0.0, dot(n, to / distance));
  float glow = uGlow / (1.0 + pow(distance / uReach, 2.0));
  float height = clamp((vWorld.y - uFloorY) / uWallHeight, 0.0, 1.0);
  float light = (uAmbient + glow * (0.3 + 0.7 * facing)) * mix(1.0, uTop, height) * (1.0 - vCrease);
  vec4 image = texture2D(uMap, uUvBox.xy + vUv * uUvBox.zw);
  vec3 albedo = mix(uBase, image.rgb, image.a) * uTint;
  vec3 h = normalize(normalize(uSheenLight - vWorld) + view);
  float sheen = uSheen * pow(max(dot(n, h), 0.0), 28.0);
  gl_FragColor = vec4((albedo * light + sheen * uSheenColor) * uLevel, 1.0);
  #include <colorspace_fragment>
}
`;

const SCREEN_VERTEX = /* glsl */ `
uniform float uPlaneZ;
varying vec2 vUv;
varying vec3 vWorld;
void main() {
  if (cameraPosition.z < uPlaneZ) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    return;
  }
  vUv = uv;
  vec4 world = modelMatrix * vec4(position, 1.0);
  vWorld = world.xyz;
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

// The screen mixes two images. Each image fits inside the 16:9 screen with dark bars. An LED wall
// shows a grid of dots in a close shot, and it fades the grid out where the dots get smaller than
// a pixel, so a wide shot shows no moire. A cloth shows a soft projection: less contrast, a
// warm hot spot in the middle, and the stage glow on the white cloth.
const SCREEN_FRAGMENT = /* glsl */ `
uniform sampler2D uFrom;
uniform sampler2D uTo;
uniform vec2 uFromFit;
uniform vec2 uToFit;
uniform float uMix;
uniform float uLed;
uniform float uLevel;
uniform vec3 uTint;
uniform vec2 uGrid;
uniform float uUnit;
uniform float uGlow;
uniform float uReach;
varying vec2 vUv;
varying vec3 vWorld;
vec3 fitted(sampler2D map, vec2 fit) {
  vec2 q = (vUv - 0.5) / fit + 0.5;
  vec2 inside = step(vec2(0.0), q) * step(q, vec2(1.0));
  vec4 color = texture2D(map, clamp(q, 0.0, 1.0));
  return color.rgb * color.a * inside.x * inside.y;
}
void main() {
  vec3 image = mix(fitted(uFrom, uFromFit), fitted(uTo, uToFit), uMix) * uTint;
  vec3 color;
  if (uLed > 0.5) {
    vec2 cell = vUv * uGrid;
    float dot = smoothstep(0.48, 0.3, length(fract(cell) - 0.5));
    float fine = clamp(1.6 - 1.4 * max(fwidth(cell.x), fwidth(cell.y)), 0.0, 1.0);
    color = image * uLevel * mix(1.0, 0.45 + 0.9 * dot, fine) + vec3(0.006, 0.005, 0.005);
  } else {
    float distance = length(vec3(0.0, 0.25 * uUnit, 0.0) - vWorld);
    float glow = uGlow / (1.0 + pow(distance / uReach, 2.0));
    vec2 c = vUv - 0.5;
    float spot = 1.08 - 0.5 * dot(c, c);
    vec3 cloth = vec3(0.62, 0.6, 0.56) * (0.05 + 0.04 * glow);
    vec3 soft = mix(vec3(dot(image, vec3(0.3, 0.55, 0.15))), image, 0.85);
    color = cloth + soft * uLevel * spot * vec3(1.0, 0.97, 0.9);
  }
  gl_FragColor = vec4(color, 1.0);
  #include <colorspace_fragment>
}
`;

/** A white texture of one pixel, for the parts with no image. */
function whiteTexture(): DataTexture {
  const texture = new DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1, RGBAFormat);
  texture.needsUpdate = true;
  return texture;
}

/** A black texture of one pixel, for a dark screen. */
function blackTexture(): DataTexture {
  const texture = new DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1, RGBAFormat);
  texture.needsUpdate = true;
  return texture;
}

/** The part of a texture that a cloth shows: the offset and the scale of the coordinates. */
type UvBox = readonly [number, number, number, number];

/** The full texture. */
const FULL_BOX: UvBox = [0, 0, 1, 1];

/**
 * Gives the part of an image that covers a cloth of another aspect: the middle of the image, as
 * the fit "cover" of CSS.
 *
 * @param imageAspect The height over the width of the image.
 * @param clothAspect The height over the width of the cloth.
 * @returns The box of the coordinates.
 */
export function coverBox(imageAspect: number, clothAspect: number): UvBox {
  if (!(imageAspect > 0) || !(clothAspect > 0)) {
    return FULL_BOX;
  }
  if (imageAspect > clothAspect) {
    const share = clothAspect / imageAspect;
    return [0, (1 - share) / 2, 1, share];
  }
  const share = imageAspect / clothAspect;
  return [(1 - share) / 2, 0, share, 1];
}

/** One cloth of the dressing: its image, the aspect of its texture, and its part of it. */
interface ClothTexture {
  readonly texture: Texture;
  readonly box: UvBox;
}

/**
 * The stage dressing behind the stage (design 4.5, backdrop): the standing banners, the hanging
 * banners, the flagpole groups, and the screen. It takes no light and casts no shadow, as the
 * hall: each cloth takes the baked light of the hall at its place, so the dressing stays darker
 * than the lit stage. The group lives in the hall group of the shown layout, so the depth of
 * field reads its depth and the depth pass of the beam skips it.
 */
export class Backdrop {
  /** The group of the dressing. */
  readonly group = new Group();
  readonly #images: BackdropImageSource;
  readonly #white = whiteTexture();
  readonly #black = blackTexture();
  /** The textures of the built-in flags and of the images of the user, by a key. */
  readonly #textures = new Map<string, Texture>();
  /** The keys of the textures of the last build. */
  #used = new Set<string>();
  #settings: BackdropSettings = DEFAULT_BACKDROP;
  /** The look of the dressing in the stage style of the settings. */
  #style: DressingStyle = STAGE_STYLES[DEFAULT_BACKDROP.style].dressing;
  #stageSide = 0;
  #screenCues: readonly ScreenCue[] = [];
  #screen: ShaderMaterial | null = null;
  readonly #waving: ShaderMaterial[] = [];

  /**
   * Creates the dressing. It is empty until {@link Backdrop.build}.
   *
   * @param images The images of the user.
   */
  constructor(images: BackdropImageSource) {
    this.#images = images;
    this.group.name = 'backdrop';
  }

  /** The settings of the last build. */
  get settings(): BackdropSettings {
    return this.#settings;
  }

  /**
   * Builds the dressing again for a stage and the settings.
   *
   * @param stageSide The stage side `S`, in meters, or 0 before the first stage.
   * @param settings The settings.
   */
  build(stageSide: number, settings: BackdropSettings): void {
    this.#stageSide = stageSide;
    this.#settings = settings;
    this.#style = STAGE_STYLES[settings.style].dressing;
    this.#clear();
    if (stageSide <= 0) {
      return;
    }
    const used = new Set<string>();
    if (settings.screen.on) {
      this.#buildScreen(stageSide, settings.screen.material, used);
    }
    if (settings.standing.on) {
      this.#buildStanding(stageSide, settings.standing, settings.screen.on, used);
    }
    if (settings.hanging.on) {
      this.#buildHanging(stageSide, settings.hanging, settings.screen.on, used);
    }
    if (settings.flags.on) {
      this.#buildFlags(stageSide, settings.flags, settings.screen.on, used);
    }
    for (const [key, texture] of this.#textures) {
      if (!used.has(key)) {
        texture.dispose();
        this.#textures.delete(key);
      }
    }
    this.#used = used;
  }

  /**
   * Builds the dressing again with the last settings, for example after a new image.
   */
  rebuild(): void {
    this.build(this.#stageSide, this.#settings);
  }

  /**
   * Forgets the texture of an image of the user, after a change of the image.
   *
   * @param id The image id.
   */
  forget(id: string): void {
    for (const [key, texture] of this.#textures) {
      if (key === id) {
        texture.dispose();
        this.#textures.delete(key);
      }
    }
  }

  /**
   * Sets the screen cues of the piece.
   *
   * @param cues The cues, sorted by time.
   */
  setScreenCues(cues: readonly ScreenCue[]): void {
    this.#screenCues = cues;
  }

  /**
   * Moves the dressing to a frame: the image of the screen, and the wave of the flags.
   *
   * @param songSec The song time, for the screen cues.
   * @param timeSec The time of the moving effects, in seconds (`effectTime()`).
   */
  frame(songSec: number, timeSec: number): void {
    for (const material of this.#waving) {
      const time = material.uniforms['uTime'];
      if (time) {
        time.value = timeSec;
      }
    }
    const screen = this.#screen;
    if (!screen) {
      return;
    }
    const first = this.#settings.screen.images[0] ?? null;
    const shown = screenFrame(this.#screenCues, first, songSec);
    this.#setScreenImage(screen, 'uFrom', 'uFromFit', shown.from);
    this.#setScreenImage(screen, 'uTo', 'uToFit', shown.to);
    const mix = screen.uniforms['uMix'];
    if (mix) {
      mix.value = shown.mix;
    }
  }

  /** Frees the GPU resources. */
  dispose(): void {
    this.#clear();
    for (const texture of this.#textures.values()) {
      texture.dispose();
    }
    this.#textures.clear();
    this.#white.dispose();
    this.#black.dispose();
  }

  /** Removes and frees the meshes and the materials. The textures stay for the next build. */
  #clear(): void {
    for (const child of this.group.children) {
      if (child instanceof Mesh) {
        child.geometry.dispose();
        if (child.material instanceof ShaderMaterial) {
          child.material.dispose();
        }
      }
    }
    this.group.clear();
    this.#screen = null;
    this.#waving.length = 0;
  }

  /**
   * Gives the texture of an image.
   *
   * @param id The image id.
   * @param aspect The height over the width of the cloth, for a built-in flag.
   * @param upright True for a banner, which turns a built-in flag upright.
   * @param used The keys of the textures of the build.
   * @returns The texture and the part that covers the cloth, or `null` for an image that is not
   *   there.
   */
  #texture(id: string, aspect: number, upright: boolean, used: Set<string>): ClothTexture | null {
    const flag = /^flag:([a-z]{2})$/u.exec(id)?.[1];
    if (flag) {
      const height = upright ? 1024 : Math.round(768 * aspect);
      const width = upright ? Math.round(1024 / aspect) : 768;
      const key = `${id}@${width}x${height}`;
      used.add(key);
      let texture = this.#textures.get(key);
      if (!texture) {
        texture = canvasTexture(drawFlag(flag, width, height, upright));
        this.#textures.set(key, texture);
      }
      return { texture, box: FULL_BOX };
    }
    const canvas = this.#images.canvasOf(id);
    if (!canvas) {
      return null;
    }
    used.add(id);
    let texture = this.#textures.get(id);
    if (!texture) {
      texture = canvasTexture(canvas);
      this.#textures.set(id, texture);
    }
    return { texture, box: coverBox(canvas.height / canvas.width, aspect) };
  }

  /**
   * Gives the height over the width of a cloth.
   *
   * @param id The image id.
   * @param set The aspect of the setting, or 0 to follow the image.
   * @param flagAspect The aspect of a built-in flag that follows the image.
   * @returns The aspect.
   */
  #aspectOf(id: string | null, set: number, flagAspect: number): number {
    if (set > 0) {
      return set;
    }
    const canvas = id && !id.startsWith('flag:') ? this.#images.canvasOf(id) : null;
    return canvas ? Math.min(6, Math.max(0.5, canvas.height / canvas.width)) : flagAspect;
  }

  /**
   * Creates the material of a cloth or of a solid part.
   *
   * @param planeZ The cutaway plane: a camera with a smaller z sees nothing.
   * @param map The texture, or `null` for a solid part.
   * @param box The part of the texture.
   * @param tint The color of a solid part, in sRGB.
   * @param sheen The strength of the sheen.
   * @returns The material.
   */
  #material(
    planeZ: number,
    map: Texture | null,
    box: UvBox,
    tint: string,
    sheen: number,
  ): ShaderMaterial {
    const unit = hallUnit(this.#stageSide);
    const material = new ShaderMaterial({
      vertexShader: CLOTH_VERTEX,
      fragmentShader: CLOTH_FRAGMENT,
      side: DoubleSide,
      uniforms: {
        uMap: { value: map ?? this.#white },
        uUvBox: { value: [...box] },
        uBase: { value: new Color(BACKDROP.colors.cloth) },
        uTint: { value: new Color(tint) },
        uUnit: { value: unit },
        uLevel: { value: this.#style.level },
        uSheen: { value: sheen },
        uSheenLight: { value: new Vector3(...rimLightPlace(this.#stageSide)) },
        uSheenColor: { value: new Vector3(...this.#style.sheenColor) },
        uAmbient: { value: HALL_LIGHT.ambient },
        uGlow: { value: HALL_LIGHT.glow },
        uReach: { value: HALL_LIGHT.glowReach * unit },
        uTop: { value: HALL_LIGHT.top },
        uWallHeight: { value: HALL.wallHeight * unit },
        uFloorY: { value: -STAGE_THICKNESS },
        uTime: { value: 0 },
        uWave: { value: 0 },
        uPlaneZ: { value: planeZ },
      },
    });
    // The depth draw of the hall for the depth of field keeps this material, so that it also
    // drops the dressing for a camera behind it.
    material.allowOverride = false;
    return material;
  }

  /**
   * Adds a mesh of triangles.
   *
   * @param list The triangles.
   * @param material The material.
   * @param name The name of the mesh.
   */
  #add(list: Triangles, material: ShaderMaterial, name: string): void {
    if (list.empty) {
      material.dispose();
      return;
    }
    const mesh = new Mesh(list.build(), material);
    mesh.name = name;
    this.group.add(mesh);
  }

  /**
   * Adds the cloths of a row of banners, one mesh for each image.
   *
   * @param planeZ The cutaway plane.
   * @param cloths The cloths: the image, and a function that adds the cloth.
   * @param name The name of the meshes.
   */
  #addCloths(
    planeZ: number,
    cloths: readonly {
      readonly texture: ClothTexture;
      readonly add: (list: Triangles) => void;
    }[],
    name: string,
  ): ShaderMaterial[] {
    const groups = new Map<Texture, { box: UvBox; list: Triangles }>();
    for (const cloth of cloths) {
      let entry = groups.get(cloth.texture.texture);
      if (!entry) {
        entry = { box: cloth.texture.box, list: new Triangles() };
        groups.set(cloth.texture.texture, entry);
      }
      cloth.add(entry.list);
    }
    const materials: ShaderMaterial[] = [];
    for (const [texture, { box, list }] of groups) {
      const material = this.#material(planeZ, texture, box, '#ffffff', this.#style.sheen.cloth);
      materials.push(material);
      this.#add(list, material, name);
    }
    return materials;
  }

  /**
   * Builds the standing banners: a row of chrome poles on round bases, each with a cross bar and
   * a banner, as the first reference image of the dressing. With the screen, the row leaves a gap
   * for it.
   *
   * @param side The stage side.
   * @param set The settings.
   * @param screen True if the screen shows.
   * @param used The keys of the textures.
   */
  #buildStanding(side: number, set: BannerSettings, screen: boolean, used: Set<string>): void {
    const place = BACKDROP.standing;
    const floor = -STAGE_THICKNESS;
    const z = -side / 2 - place.behind;
    const outer = place.halfSpan * side;
    const inner = screen ? screenWidth(side) / 2 + place.screenGap + place.width / 2 : null;
    const metal = new Triangles();
    const cloths: { texture: ClothTexture; add: (list: Triangles) => void }[] = [];
    const images = slotImages(set.count, set.images, set.arrangement);
    const slots = rowSlots(set.count, inner, Math.max(outer, (inner ?? 0) + place.width));
    for (const [i, x] of slots.entries()) {
      const id = images[i] ?? null;
      const aspect = this.#aspectOf(id, set.aspect, place.flagAspect);
      const height = place.width * aspect;
      const top = floor + place.clearance + height;
      const poleTop = top + place.poleTop;
      addBase(metal, new Vector3(x, floor, z), place.baseRadius);
      addRod(metal, new Vector3(x, floor, z), new Vector3(x, poleTop, z), place.poleRadius);
      addKnob(metal, new Vector3(x, poleTop + 0.03, z), 0.045);
      const half = place.width / 2 + 0.05;
      const barY = top + 0.02;
      addRod(
        metal,
        new Vector3(x - half, barY, z + 0.04),
        new Vector3(x + half, barY, z + 0.04),
        0.014,
      );
      addKnob(metal, new Vector3(x - half - 0.02, barY, z + 0.04), 0.03);
      addKnob(metal, new Vector3(x + half + 0.02, barY, z + 0.04), 0.03);
      addRod(metal, new Vector3(x, poleTop, z), new Vector3(x - half, barY, z + 0.04), 0.004);
      addRod(metal, new Vector3(x, poleTop, z), new Vector3(x + half, barY, z + 0.04), 0.004);
      const texture = id ? this.#texture(id, aspect, true, used) : null;
      if (texture) {
        const matrix = new Matrix4().makeTranslation(x, top, z + 0.06);
        cloths.push({
          texture,
          add: (list) => {
            addCloth(list, matrix, place.width, height, set.cut, {
              count: 2.5,
              depth: 0.025,
              top: 0.4,
            });
          },
        });
      }
    }
    this.#add(
      metal,
      this.#material(z, null, FULL_BOX, this.#style.metal, this.#style.sheen.metal),
      'standing-poles',
    );
    this.#addCloths(z, cloths, 'standing-banners');
  }

  /**
   * Builds the hanging banners: a row of banners on wooden rods below a dark batten, as the
   * second reference image of the dressing. With the screen, the row leaves a gap for it.
   *
   * @param side The stage side.
   * @param set The settings.
   * @param screen True if the screen shows.
   * @param used The keys of the textures.
   */
  #buildHanging(side: number, set: BannerSettings, screen: boolean, used: Set<string>): void {
    const place = BACKDROP.hanging;
    const floor = -STAGE_THICKNESS;
    const z = -side / 2 - place.behind;
    const battenY = floor + place.batten;
    const outer = place.halfSpan * side;
    const inner = screen ? screenWidth(side) / 2 + place.screenGap + place.width / 2 : null;
    const slots = rowSlots(set.count, inner, Math.max(outer, (inner ?? 0) + place.width));
    const dark = new Triangles();
    const rods = new Triangles();
    const span = Math.max(...slots.map((x) => Math.abs(x)), 0) + place.width;
    addRod(dark, new Vector3(-span, battenY, z), new Vector3(span, battenY, z), 0.03);
    for (const x of [-span * 0.8, span * 0.8]) {
      addRod(dark, new Vector3(x, battenY, z), new Vector3(x, battenY + 12, z), 0.006);
    }
    const cloths: { texture: ClothTexture; add: (list: Triangles) => void }[] = [];
    const images = slotImages(set.count, set.images, set.arrangement);
    for (const [i, x] of slots.entries()) {
      const id = images[i] ?? null;
      const aspect = this.#aspectOf(id, set.aspect, place.flagAspect);
      const height = place.width * aspect;
      const top = battenY - place.drop;
      const half = place.width / 2 + 0.07;
      addRod(rods, new Vector3(x - half, top, z), new Vector3(x + half, top, z), 0.022);
      addKnob(rods, new Vector3(x - half - 0.03, top, z), 0.045);
      addKnob(rods, new Vector3(x + half + 0.03, top, z), 0.045);
      addRod(dark, new Vector3(x - half + 0.05, top, z), new Vector3(x, battenY, z), 0.005);
      addRod(dark, new Vector3(x + half - 0.05, top, z), new Vector3(x, battenY, z), 0.005);
      const texture = id ? this.#texture(id, aspect, true, used) : null;
      if (texture) {
        const matrix = new Matrix4().makeTranslation(x, top - 0.01, z + 0.03);
        cloths.push({
          texture,
          add: (list) => {
            addCloth(list, matrix, place.width, height, set.cut, {
              count: 3,
              depth: 0.06,
              top: 0.15,
            });
          },
        });
      }
    }
    this.#add(dark, this.#material(z, null, FULL_BOX, this.#style.dark, 0.1), 'batten');
    this.#add(rods, this.#material(z, null, FULL_BOX, this.#style.rod, 0.2), 'banner-rods');
    this.#addCloths(z, cloths, 'hanging-banners');
  }

  /**
   * Builds the flags in their groups (design 4.5, backdrop). The groups stand beside the back
   * corners of the stage. In a symmetrical order, the right side mirrors the left side. The stand
   * of the settings sets the form of each group:
   *
   * - `group`: a tall pole with staffs in pairs that lean out to each side, as the third reference
   *   image of the dressing.
   * - `floor`: a row of upright wooden poles, each on its own plinth on the floor, as the indoor
   *   flags of the reference images.
   * - `fan`: wooden poles that fan out from one base on the floor, as the indoor flag stand of the
   *   reference images.
   *
   * @param side The stage side.
   * @param set The settings of the flags.
   * @param screen True if the screen shows.
   * @param used The keys of the textures.
   */
  #buildFlags(side: number, set: FlagSettings, screen: boolean, used: Set<string>): void {
    const place = BACKDROP.flags;
    const hang = flagHang(set.limpness);
    const floor = -STAGE_THICKNESS;
    // Each group: x, z, the height of the foot of its pole, and the pole height.
    const places: [number, number, number, number][] = [];
    const perSide = Math.floor(set.groups / 2);
    for (let j = 0; j < perSide; j++) {
      const x = side / 2 + place.side + j * place.spacing;
      const z = -side / 2 + place.forward - j * place.stepBack;
      places.push([-x, z, floor, place.poleHeight], [x, z, floor, place.poleHeight]);
    }
    if (set.groups % 2 === 1) {
      if (screen && set.stand === 'group') {
        const top = BACKDROP.screen.bottom + (screenWidth(side) * 9) / 16 + BACKDROP.screen.bezel;
        places.push([0, -side / 2 - BACKDROP.screen.behind - 0.08, top, place.middlePole]);
      } else if (!screen) {
        // A floor stand in the middle would hide the screen, so it stands only with no screen.
        places.push([0, -side / 2 - place.middleBehind, floor, place.poleHeight]);
      }
    }
    if (places.length === 0) {
      return;
    }
    const planeZ = Math.min(...places.map(([, z]) => z)) - 0.3;
    const metal = new Triangles();
    const wood = new Triangles();
    const cloths: { texture: ClothTexture; add: (list: Triangles) => void }[] = [];
    const hangFlag = (id: string, tip: Vector3, along: Vector3, out: Vector3): void => {
      const aspect = this.#aspectOf(id, 0, FLAG_ASPECT);
      const width = place.flagWidth;
      const height = width * aspect;
      const texture = this.#texture(id, aspect, false, used);
      if (!texture) {
        return;
      }
      const start = tip.clone().addScaledVector(along, 0.06);
      start.z += 0.02;
      // A flag with its fly to the left shows its back, mirrored, as in the reference image.
      const mirror = out.x < 0;
      cloths.push({
        texture,
        add: (list) => {
          addFlag(list, start, along, out, width, height, mirror, hang);
        },
      });
    };
    const order = places.map(([gx]) => gx).toSorted((a, b) => a - b);
    for (const [gx, gz, foot, poleHeight] of places) {
      // In a symmetrical order, the right group mirrors the left group, so the flag order runs
      // from the outside in.
      const mirrorGroup = set.arrangement === 'mirror' && gx > 0;
      const groupFlags = flagsOfGroup(
        set.images,
        set.arrangement,
        order.indexOf(gx),
        places.length,
      );
      // A floor stand or a fan hangs its flags toward the middle of the stage.
      const inward = gx > 0 ? -1 : 1;
      if (set.stand === 'floor' || set.stand === 'round') {
        const parts = set.stand === 'round' ? metal : wood;
        this.#floorStands(parts, metal, groupFlags, mirrorGroup, [gx, gz], inward, hangFlag);
      } else if (set.stand === 'fan') {
        this.#fanStand(wood, metal, groupFlags, mirrorGroup, [gx, gz], inward, hangFlag);
      } else {
        this.#poleGroup(metal, groupFlags, mirrorGroup, [gx, gz, foot, poleHeight], hangFlag);
      }
    }
    this.#add(
      metal,
      this.#material(planeZ, null, FULL_BOX, this.#style.metal, this.#style.sheen.metal),
      'flag-poles',
    );
    this.#add(wood, this.#material(planeZ, null, FULL_BOX, this.#style.rod, 0.25), 'flag-stands');
    for (const material of this.#addCloths(planeZ, cloths, 'flags')) {
      const wave = material.uniforms['uWave'];
      if (wave) {
        wave.value = hang.wave;
      }
      this.#waving.push(material);
    }
  }

  /**
   * Adds a flagpole group: a pole with staffs in pairs that lean out to each side. An odd flag
   * flies from the top of the pole.
   *
   * @param metal The triangles of the metal parts.
   * @param flags The flags of the group.
   * @param mirrorGroup True to swap the sides, for the right group of a symmetrical order.
   * @param at The x, the z, the height of the foot, and the height of the pole.
   * @param hangFlag Adds a flag: its image, the tip of its staff, the direction down the staff,
   *   and the direction of a stiff flag.
   */
  #poleGroup(
    metal: Triangles,
    flags: readonly (string | null)[],
    mirrorGroup: boolean,
    at: readonly [x: number, z: number, foot: number, height: number],
    hangFlag: (id: string, tip: Vector3, along: Vector3, out: Vector3) => void,
  ): void {
    const place = BACKDROP.flags;
    const [gx, gz, foot, poleHeight] = at;
    const base = new Vector3(gx, foot, gz);
    const poleTop = foot + poleHeight;
    if (foot === -STAGE_THICKNESS) {
      addBase(metal, base, 0.3);
    }
    addRod(metal, base, new Vector3(gx, poleTop, gz), place.poleRadius);
    addKnob(metal, new Vector3(gx, poleTop + 0.06, gz), 0.07);
    const count = flags.length;
    const pairs = Math.floor(count / 2);
    for (const [k, id] of flags.entries()) {
      if (!id) {
        continue;
      }
      const top = count % 2 === 1 && k === count - 1;
      const pair = Math.floor(k / 2);
      const leftSide = k % 2 === 0 ? !mirrorGroup : mirrorGroup;
      const height = place.flagWidth * this.#aspectOf(id, 0, FLAG_ASPECT);
      const length = height + 0.45;
      const tilt = top ? 0 : place.staffTilt;
      const sign = top ? 1 : leftSide ? -1 : 1;
      const rootY = top
        ? poleTop
        : Math.max(foot + 0.3, poleTop - 0.35 - (pairs - 1 - pair) * place.pairStep);
      const root = new Vector3(gx, rootY, gz + 0.06);
      // A lower pair leans toward the audience, and the flag on top of the pole leans back, so
      // the flags that hang one above the other do not cross.
      const lean = place.pairLean * (top ? -1 : pairs - 1 - pair);
      const up = new Vector3(
        sign * Math.sin(tilt) * Math.cos(lean),
        Math.cos(tilt) * Math.cos(lean),
        Math.sin(lean),
      );
      const tip = root.clone().addScaledVector(up, length);
      addRod(metal, root, tip, 0.02);
      addKnob(metal, tip.clone().addScaledVector(up, 0.04), 0.035);
      const out = top
        ? new Vector3(1, 0, 0)
        : new Vector3(sign * Math.cos(tilt), -Math.sin(tilt), 0);
      hangFlag(id, tip, up.clone().negate(), out);
    }
  }

  /**
   * Adds a row of floor stands: an upright pole on a foot for each flag, with a finial, side by
   * side, as the indoor flags of the reference images. A wooden pole stands on a square plinth,
   * and a metal pole on a round base.
   *
   * @param wood The triangles of the poles and the feet: wooden or metal parts.
   * @param metal The triangles of the finials.
   * @param flags The flags of the row.
   * @param mirrorGroup True to run the flags from the right, for the right group of a
   *   symmetrical order.
   * @param at The x and the z of the middle of the row.
   * @param inward The side of the fly of each flag: 1 for +x, -1 for -x.
   * @param hangFlag Adds a flag: its image, the tip of its staff, the direction down the staff,
   *   and the direction of a stiff flag.
   */
  #floorStands(
    wood: Triangles,
    metal: Triangles,
    flags: readonly (string | null)[],
    mirrorGroup: boolean,
    at: readonly [x: number, z: number],
    inward: number,
    hangFlag: (id: string, tip: Vector3, along: Vector3, out: Vector3) => void,
  ): void {
    const stand = BACKDROP.flags.floor;
    const floor = -STAGE_THICKNESS;
    const [gx, gz] = at;
    const count = flags.length;
    for (const [k, id] of flags.entries()) {
      if (!id) {
        continue;
      }
      const slot = mirrorGroup ? count - 1 - k : k;
      const x = gx + (slot - (count - 1) / 2) * stand.spacing;
      if (wood === metal) {
        addRoundBase(metal, new Vector3(x, floor, gz));
      } else {
        addPlinth(wood, new Vector3(x, floor, gz));
      }
      const top = new Vector3(x, floor + stand.height, gz);
      addRod(wood, new Vector3(x, floor + 0.12, gz), top, stand.poleRadius);
      addFinial(metal, top);
      hangFlag(
        id,
        top.clone().setY(top.y - 0.04),
        new Vector3(0, -1, 0),
        new Vector3(inward, 0, 0),
      );
    }
  }

  /**
   * Adds a fan stand: wooden poles that fan out from one base on the floor, the middle pole
   * upright, as the indoor flag stand of the reference images. The outer poles stand a little
   * farther back, so the flags do not cross.
   *
   * @param wood The triangles of the wooden parts.
   * @param metal The triangles of the base and the finials.
   * @param flags The flags of the fan.
   * @param mirrorGroup True to run the flags from the right, for the right group of a
   *   symmetrical order.
   * @param at The x and the z of the base.
   * @param inward The side of the fly of the flag on an upright pole: 1 for +x, -1 for -x.
   * @param hangFlag Adds a flag: its image, the tip of its staff, the direction down the staff,
   *   and the direction of a stiff flag.
   */
  #fanStand(
    wood: Triangles,
    metal: Triangles,
    flags: readonly (string | null)[],
    mirrorGroup: boolean,
    at: readonly [x: number, z: number],
    inward: number,
    hangFlag: (id: string, tip: Vector3, along: Vector3, out: Vector3) => void,
  ): void {
    const fan = BACKDROP.flags.fan;
    const floor = -STAGE_THICKNESS;
    const [gx, gz] = at;
    const count = flags.length;
    addBase(metal, new Vector3(gx, floor, gz), fan.baseRadius);
    const pivot = new Vector3(gx, floor + 0.1, gz);
    const step = count > 1 ? Math.min(fan.step, (2 * fan.maxAngle) / (count - 1)) : 0;
    for (const [k, id] of flags.entries()) {
      if (!id) {
        continue;
      }
      const slot = mirrorGroup ? count - 1 - k : k;
      const rank = slot - (count - 1) / 2;
      const angle = rank * step;
      const up = new Vector3(Math.sin(angle), Math.cos(angle), -fan.backLean * Math.abs(rank));
      up.normalize();
      const tip = pivot.clone().addScaledVector(up, fan.length);
      addRod(wood, pivot, tip, fan.poleRadius);
      addFinial(metal, tip);
      const sign = Math.abs(angle) < 1e-6 ? inward : Math.sign(angle);
      const out = new Vector3(sign * Math.cos(angle), -sign * Math.sin(angle), 0);
      hangFlag(id, tip.clone().addScaledVector(up, -0.04), up.clone().negate(), out);
    }
  }

  /**
   * Builds the screen: an LED wall in a dark frame, or a projection cloth with a black border, a
   * roller on top, and a weight bar at the bottom. Two cables hold it from above.
   *
   * @param side The stage side.
   * @param material The material of the screen.
   * @param used The keys of the textures.
   */
  #buildScreen(side: number, material: ScreenMaterial, used: Set<string>): void {
    const place = BACKDROP.screen;
    const width = screenWidth(side);
    const height = (width * 9) / 16;
    const z = -side / 2 - place.behind;
    const bottom = place.bottom;
    const center = new Vector3(0, bottom + height / 2, z);
    const frame = new Triangles();
    const led = material === 'led';
    if (led) {
      addBox(
        frame,
        center.clone().setZ(z - 0.08),
        new Vector3(width + 2 * place.bezel, height + 2 * place.bezel, 0.14),
      );
    } else {
      const border = 0.16;
      addBox(
        frame,
        center.clone().setZ(z - 0.02),
        new Vector3(width + 2 * border, height + 2 * border, 0.02),
      );
      addRod(
        frame,
        new Vector3(-width / 2 - 0.35, bottom + height + border + 0.08, z),
        new Vector3(width / 2 + 0.35, bottom + height + border + 0.08, z),
        0.08,
      );
      addRod(
        frame,
        new Vector3(-width / 2 - border, bottom - border - 0.03, z),
        new Vector3(width / 2 + border, bottom - border - 0.03, z),
        0.03,
      );
    }
    for (const x of [-width * 0.35, width * 0.35]) {
      addRod(
        frame,
        new Vector3(x, bottom + height, z - 0.08),
        new Vector3(x, bottom + 30, z),
        0.006,
      );
    }
    this.#add(
      frame,
      this.#material(z - 0.3, null, FULL_BOX, this.#style.dark, 0.12),
      'screen-frame',
    );
    const surface = new Triangles();
    const quad = [
      [-width / 2, bottom, 0, 0],
      [width / 2, bottom, 1, 0],
      [width / 2, bottom + height, 1, 1],
      [-width / 2, bottom, 0, 0],
      [width / 2, bottom + height, 1, 1],
      [-width / 2, bottom + height, 0, 1],
    ] as const;
    for (const [x, y, u, v] of quad) {
      surface.positions.push(x, y, z + 0.005);
      surface.uvs.push(u, v);
      surface.waves.push(0);
    }
    const unit = hallUnit(side);
    const screen = new ShaderMaterial({
      vertexShader: SCREEN_VERTEX,
      fragmentShader: SCREEN_FRAGMENT,
      uniforms: {
        uFrom: { value: this.#black },
        uTo: { value: this.#black },
        uFromFit: { value: new Vector2(1, 1) },
        uToFit: { value: new Vector2(1, 1) },
        uMix: { value: 1 },
        uLed: { value: led ? 1 : 0 },
        uLevel: { value: (led ? place.level.led : place.level.cloth) * this.#style.screenLevel },
        uTint: { value: new Vector3(...this.#style.screenTint) },
        uGrid: { value: new Vector2(place.ledColumns, Math.round((place.ledColumns * 9) / 16)) },
        uUnit: { value: unit },
        uGlow: { value: HALL_LIGHT.glow },
        uReach: { value: HALL_LIGHT.glowReach * unit },
        uPlaneZ: { value: z - 0.3 },
      },
    });
    screen.allowOverride = false;
    this.#add(surface, screen, 'screen');
    this.#screen = screen;
    // The textures of all the images of the screen stay while it shows, so a cue does not wait
    // for an upload.
    for (const id of this.#settings.screen.images) {
      this.#texture(id, 9 / 16, false, used);
    }
    for (const cue of this.#screenCues) {
      this.#texture(cue.image, 9 / 16, false, used);
    }
  }

  /**
   * Sets one image of the screen.
   *
   * @param screen The material of the screen.
   * @param name The uniform of the texture.
   * @param fitName The uniform of the fit.
   * @param id The image id, or `null` for a dark screen.
   */
  #setScreenImage(screen: ShaderMaterial, name: string, fitName: string, id: string | null): void {
    const map = screen.uniforms[name];
    const fit = screen.uniforms[fitName]?.value;
    if (!map || !(fit instanceof Vector2)) {
      return;
    }
    const texture = id ? this.#texture(id, 9 / 16, false, this.#used) : null;
    if (!texture) {
      map.value = this.#black;
      fit.set(1, 1);
      return;
    }
    map.value = texture.texture;
    const image = textureAspect(texture.texture);
    // The image fits inside the screen of 16:9: a wider image fills the width.
    if (image < 9 / 16) {
      fit.set(1, image / (9 / 16));
    } else {
      fit.set(9 / 16 / image, 1);
    }
  }
}

/**
 * Gives the width of the screen of a stage.
 *
 * @param side The stage side.
 * @returns The width, in meters.
 */
export function screenWidth(side: number): number {
  return Math.min(BACKDROP.screen.maxWidth, BACKDROP.screen.width * side);
}

/**
 * Gives the height over the width of the image of a texture.
 *
 * @param texture The texture of a canvas.
 * @returns The aspect, or 9/16 for an image of unknown size.
 */
function textureAspect(texture: Texture): number {
  const image = texture.image;
  return image instanceof HTMLCanvasElement && image.width > 0
    ? image.height / image.width
    : 9 / 16;
}

/**
 * Makes the texture of a canvas, with mipmaps, so a far banner does not shimmer.
 *
 * @param canvas The canvas.
 * @returns The texture.
 */
function canvasTexture(canvas: HTMLCanvasElement): CanvasTexture {
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.minFilter = LinearMipmapLinearFilter;
  texture.magFilter = LinearFilter;
  texture.anisotropy = 4;
  return texture;
}
