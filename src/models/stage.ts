import { MathUtils, Quaternion, Vector3 } from 'three';
import { SCENE_COLORS } from './colors.ts';
import { toQuat, toVec3 } from './tuples.ts';
import type { Vec3 } from './tuples.ts';
import { MeshBuilder, applyTransform, transform } from './mesh.ts';
import type { MeshData, Rgb, Transform } from './mesh.ts';
import { pianoSheetCorners } from './instruments/piano.ts';
import type { ModelCache } from './model-cache.ts';
import { box, cylinder, quad } from './primitives.ts';
import type { SceneLayout } from './layout.ts';
import {
  MUSIC_STAND,
  STAGE_COLORS,
  addDesk,
  deskSheetCorners,
  standSheetCorners,
} from './props.ts';

/** The thickness of the stage slab (design 4.5, props). The floor is at y = -STAGE_THICKNESS. */
export const STAGE_THICKNESS = 0.4;

/**
 * The width of one plank of the stage top. The planks run from the left to the right, as in
 * `mockup.png`, and each row has planks of several lengths with staggered joints. The boards of
 * `orchestra-latest.png` are about 0.1 m wide and 0.5 m long, against the podium top of 1.05 m,
 * so the planks are a step finer than the first planks of 0.22 m by 2.4 m to 4.8 m.
 */
export const PLANK_WIDTH = 0.14;

/** The width of the dark line between two planks. */
export const PLANK_LINE_WIDTH = 0.012;

/** The shortest plank and the length that a plank can add to it, in meters. */
export const PLANK_LENGTH = { min: 0.9, extra: 1.2 } as const;

/** The largest change of the tone of one plank from the mean plank color, as a factor. */
export const PLANK_TONE = 0.2;

/**
 * The cut of each of the four corners of the stage outline, as a part of the stage side (design
 * 4.5, props). The outline has eight sides, as the stage of `orchestra-latest.png`. Each cut takes
 * this part of the side from each of the two edges at its corner. The layout keeps each footprint
 * 0.3 m from the cut (`models/layout-scene.ts`). The footprints of the demos allow up to 0.115.
 */
export const STAGE_CORNER_CUT = 0.1;

/**
 * The raised lip around the top of the stage (design 4.5, props), as the edge of the stage of
 * `orchestra-latest.png`. Its profile goes from the top of the skirt up the outer face, over a
 * round top, and down an inner bevel to the planks. The distances are from the outline, in meters.
 */
export const STAGE_LIP = {
  /** The width of the lip, from the outline to the planks. */
  width: 0.1,
  /** The height of the top of the lip above the stage top. */
  height: 0.045,
  /** The depth below the stage top of the lower end of the outer face, at the top of the skirt. */
  drop: 0.06,
} as const;

/** The profile of the edge of the stage top (design 4.5, stage style). */
export type StageEdge = 'lip' | 'molded' | 'chamfer' | 'square';

/**
 * The profiles of the edge ({@link STAGE_LIP}): each point is the distance in from the outline and
 * the height above the stage top, from the top of the skirt to the planks. Each profile has the
 * width and the drop of `STAGE_LIP`, so the stage shader finds the edge of each style.
 */
const EDGE_PROFILES: Readonly<Record<StageEdge, readonly (readonly [number, number])[]>> = {
  /** The raised lip with a round top of `orchestra-latest.png`. */
  lip: [
    [0, -STAGE_LIP.drop],
    [0, STAGE_LIP.height - 0.02],
    [0.02, STAGE_LIP.height],
    [0.065, STAGE_LIP.height],
    [STAGE_LIP.width, 0],
  ],
  /** A taller molded lip with two steps, as the gilded edge of a gala stage. */
  molded: [
    [0, -STAGE_LIP.drop],
    [0, 0.035],
    [0.01, 0.058],
    [0.025, 0.068],
    [0.048, 0.068],
    [0.058, 0.05],
    [0.075, 0.05],
    [STAGE_LIP.width, 0],
  ],
  /** A low bevel 1 cm above the stage top. */
  chamfer: [
    [0, -STAGE_LIP.drop],
    [0, -0.012],
    [0.025, 0.01],
    [0.085, 0.01],
    [STAGE_LIP.width, 0],
  ],
  /** A square edge, flush with the stage top, with a trim strip of the nosing color. */
  square: [
    [0, -STAGE_LIP.drop],
    [0, 0],
    [STAGE_LIP.width, 0],
  ],
};

/** The pattern of the boards of the stage top (design 4.5, stage style). */
export type StageFloor = 'planks' | 'parquet' | 'deck';

/** The linear colors of the stage parts: the keys of `STAGE_COLORS` that the stage uses. */
export type StageColors = Readonly<
  Record<
    | 'plank'
    | 'seam'
    | 'nosing'
    | 'skirt'
    | 'groove'
    | 'podium'
    | 'podiumPanel'
    | 'podiumTop'
    | 'podiumTopPanel',
    Rgb
  >
>;

/**
 * The build of the stage in one stage style (design 4.5, stage style): the colors of the parts,
 * the pattern of the boards, the profile of the edge, and the panels of the skirt. The outline of
 * the stage and the height of the stage top stay the same in each style, so the layout and the
 * seats do not change.
 */
export interface StageBuild {
  /** The colors. The seam color must differ from each plank tone: the shader finds a seam by it. */
  readonly colors: StageColors;
  /**
   * The pattern of the boards. `planks` are rows of staggered planks along x. `parquet` is a
   * basket weave of square tiles, each of `boardCount` boards that turn 90 degrees from one tile to
   * the next. `deck` is a grid of square stage decks of the plank length.
   */
  readonly floor: StageFloor;
  /** The width of one board, in meters. */
  readonly plankWidth: number;
  /** The shortest board and the length that a board can add to it, in meters. */
  readonly plankLength: { readonly min: number; readonly extra: number };
  /** The largest change of the tone of one board from the mean color, as a factor. */
  readonly plankTone: number;
  /** The profile of the edge. */
  readonly edge: StageEdge;
  /** The panels of the skirt: a panel width and a groove between them, or `null` for none. */
  readonly skirt: { readonly panel: number; readonly groove: number } | null;
}

/** The stage of the reference images: walnut planks, a raised lip, and a paneled skirt. */
export const CLASSIC_STAGE: StageBuild = {
  colors: STAGE_COLORS,
  floor: 'planks',
  plankWidth: PLANK_WIDTH,
  plankLength: PLANK_LENGTH,
  plankTone: PLANK_TONE,
  edge: 'lip',
  skirt: { panel: 0.5, groove: 0.03 },
};

/** A point on the stage top: x and z. */
type FloorPoint = readonly [number, number];

/**
 * Gives the eight corners of a square with cut corners around the origin, in the order of the
 * sides: the front, the right, the back, and the left side, each followed by its corner cut. Seen
 * from above, the corners go around counterclockwise in the axes of the stage.
 *
 * @param half Half the side of the square, in meters.
 * @param cut The length that each cut takes from each of the two edges at its corner, in meters.
 * @returns The corners, as x and z.
 */
function octagon(half: number, cut: number): FloorPoint[] {
  const h = half;
  const c = cut;
  return [
    [-h + c, h],
    [h - c, h],
    [h, h - c],
    [h, -h + c],
    [h - c, -h],
    [-h + c, -h],
    [-h, -h + c],
    [-h, h - c],
  ];
}

/**
 * Gives the outline of the stage at a distance in from the outline of the slab: the octagon of
 * {@link STAGE_CORNER_CUT}, with each side moved in by the distance.
 *
 * @param side The stage side `S`, in meters.
 * @param inset The distance in from the outline, in meters.
 * @returns The eight corners, as in {@link octagon}.
 */
export function stageOutline(side: number, inset = 0): FloorPoint[] {
  return insetOctagon(side / 2, STAGE_CORNER_CUT * side, inset);
}

/**
 * Gives an octagon of {@link octagon} with each side moved in by a distance. A side of a corner
 * cut moves in by the same distance as the other sides.
 *
 * @param half Half the side of the square, in meters.
 * @param cut The corner cut of the octagon, in meters.
 * @param inset The distance in, in meters.
 * @returns The eight corners, as in {@link octagon}.
 */
function insetOctagon(half: number, cut: number, inset: number): FloorPoint[] {
  return octagon(half - inset, cut - (2 - Math.SQRT2) * inset);
}

/**
 * Moves the corners of an outline on the stage top.
 *
 * @param points The corners.
 * @param x The move along x.
 * @param z The move along z.
 * @returns The moved corners.
 */
function moved(points: readonly FloorPoint[], x: number, z: number): FloorPoint[] {
  return points.map(([px, pz]) => [px + x, pz + z]);
}

/**
 * Finds if a point of the stage top keeps a margin from the outline of the stage: from the four
 * edges and from the four corner cuts (design 4.5, stage origin).
 *
 * @param x The x of the point, from the stage center.
 * @param z The z of the point, from the stage center.
 * @param side The stage side `S`, in meters.
 * @param margin The margin, in meters.
 * @returns True if the point keeps the margin.
 */
export function keepsStageMargin(x: number, z: number, side: number, margin: number): boolean {
  const half = side / 2;
  return (
    Math.abs(x) <= half - margin + 1e-9 &&
    Math.abs(z) <= half - margin + 1e-9 &&
    Math.abs(x) + Math.abs(z) <= 2 * half - STAGE_CORNER_CUT * side - margin * Math.SQRT2 + 1e-9
  );
}

/**
 * The front distance `F` from the front edge of the stage to the podium center, with no piano
 * (design 4.5, stage origin).
 */
export const PODIUM_FROM_FRONT = 1.0;

/** The podium box: width, height, and depth (design 4.5, props). */
export const PODIUM_SIZE: Vec3 = [1.05, 0.35, 1.05];

/** The thickness of the lighter top plate of the podium. */
const PODIUM_PLATE = 0.04;

/**
 * The cut corners and the frames of the podium (design 4.5, props), as the podium of
 * `orchestra-latest.png` and `orchestra-side.png`: a box with cut corners, a top plate that stands
 * out a little, a framed panel on the top, and a framed panel on each of the four main sides.
 */
export const PODIUM_TRIM = {
  /** The length that each corner cut of the top plate takes from each of its two edges. */
  cut: 0.1,
  /** How far the top plate stands out over the body on each side. */
  overhang: 0.02,
  /** The width of the frame around the panel of the top. */
  topFrame: 0.07,
  /** The width of the dark groove between the frame of the top and its panel. */
  groove: 0.012,
  /** The width of the frame around the panel of each main side of the body. */
  sideFrame: 0.05,
  /** How far a panel of a side stands out of the body. It stays inside the top plate. */
  panelOut: 0.003,
} as const;

/** The conductor stand on the podium (design 4.5, props). */
export const CONDUCTOR_STAND = {
  deskWidth: 0.6,
  deskDepth: 0.45,
  /**
   * The height of the desk center above the top of the podium: just below the chest of the bear,
   * so that the top edge of the desk is at its shoulders. With 1.10 m, the desk is above the
   * shoulders of the bear, and the beat must stay at the height of its head.
   */
  deskHeight: 0.8,
  /** The tilt of the desk toward the conductor, as for a music stand. */
  tilt: 30 * MathUtils.DEG2RAD,
  /**
   * The distance of the post in front of the podium center, toward the orchestra (-z). The stand
   * stands on the stage, just in front of the podium: its base keeps 8 cm from the front of the
   * podium. At 0.35 m on the podium, the lower edge of the desk is 0.24 m in front of the bear,
   * and the belly of the bear (0.36 m) goes through the desk and the score. At 0.6 m in front of
   * the podium of 1.05 m, the base stands 4.5 cm inside the podium.
   */
  forward: 0.73,
  /** The radius of the round base of the post. */
  baseRadius: 0.12,
} as const;

/**
 * Gives a number from 0 to 1 for two whole numbers, with no state, so that the planks of a stage
 * are the same on each build.
 *
 * @param a The first number.
 * @param b The second number.
 * @returns The number.
 */
export function plankHash(a: number, b: number): number {
  let h = Math.imul(a + 0x9e37, 0x85ebca6b) ^ Math.imul(b + 0x7f4a, 0xc2b2ae35);
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d);
  h = Math.imul(h ^ (h >>> 12), 0x297a2d39);
  return ((h ^ (h >>> 15)) >>> 0) / 4294967296;
}

/**
 * Gives the color of one plank: the mean plank color, lighter or darker by up to the tone of the
 * build ({@link PLANK_TONE} on the classic stage).
 *
 * @param row The row of the plank, from the back.
 * @param index The plank in its row, from the left.
 * @param build The build of the stage.
 * @returns The linear color.
 */
export function plankColor(row: number, index: number, build: StageBuild = CLASSIC_STAGE): Rgb {
  const tone = 1 + build.plankTone * (2 * plankHash(row, index) - 1);
  const [r, g, b] = build.colors.plank;
  return [r * tone, g * tone, b * tone];
}

/**
 * Clips a convex polygon of the stage top to the half plane `nx × x + nz × z <= limit`.
 *
 * @param points The corners of the polygon.
 * @param nx The x of the normal of the boundary.
 * @param nz The z of the normal of the boundary.
 * @param limit The limit.
 * @returns The corners of the clipped polygon, in the same order.
 */
function clipHalfPlane(
  points: readonly FloorPoint[],
  nx: number,
  nz: number,
  limit: number,
): FloorPoint[] {
  const out: FloorPoint[] = [];
  for (let i = 0; i < points.length; i++) {
    const a = points[i] ?? [0, 0];
    const b = points[(i + 1) % points.length] ?? [0, 0];
    const da = nx * a[0] + nz * a[1] - limit;
    const db = nx * b[0] + nz * b[1] - limit;
    if (da <= 0) {
      out.push(a);
    }
    if ((da < 0 && db > 0) || (da > 0 && db < 0)) {
      const t = da / (da - db);
      out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
    }
  }
  return out;
}

/** The area of the planks: a square with cut corners around the stage center. */
interface PlankArea {
  /** Half the side of the square, in meters. */
  readonly half: number;
  /** The largest `|x| + |z|`: the line of the corner cuts. */
  readonly diagonal: number;
}

/**
 * Adds a rectangle of the stage top at y = 0, clipped to the area of the planks, as a fan of
 * triangles that face up. A rectangle outside the area adds nothing.
 *
 * @param builder The builder.
 * @param rect The smallest and the largest x, then the smallest and the largest z.
 * @param area The area of the planks.
 * @param color The color.
 */
function addTopPiece(
  builder: MeshBuilder,
  rect: readonly [number, number, number, number],
  area: PlankArea,
  color: Rgb,
): void {
  const [x0, x1, z0, z1] = rect;
  let points: FloorPoint[] = [
    [x0, z0],
    [x0, z1],
    [x1, z1],
    [x1, z0],
  ];
  for (const [nx, nz, limit] of [
    [1, 0, area.half],
    [-1, 0, area.half],
    [0, 1, area.half],
    [0, -1, area.half],
    [1, 1, area.diagonal],
    [1, -1, area.diagonal],
    [-1, 1, area.diagonal],
    [-1, -1, area.diagonal],
  ] as const) {
    points = clipHalfPlane(points, nx, nz, limit);
  }

  const first = points[0];
  let doubleArea = 0;
  for (let i = 0; i < points.length; i++) {
    const [ax, az] = points[i] ?? [0, 0];
    const [bx, bz] = points[(i + 1) % points.length] ?? [0, 0];
    doubleArea += ax * bz - bx * az;
  }
  if (!first || points.length < 3 || Math.abs(doubleArea) < 1e-12) {
    return;
  }
  const corners: number[] = [];
  for (let i = 1; i + 1 < points.length; i++) {
    const b = points[i] ?? first;
    const c = points[i + 1] ?? first;
    corners.push(first[0], 0, first[1], b[0], 0, b[1], c[0], 0, c[1]);
  }
  builder.add(corners, { color });
}

/**
 * Adds one side of the skirt: panels with grooves between them, from the floor to the lip. The
 * side runs from `from` to `to` on the floor, and its face points out of the stage.
 *
 * @param builder The builder.
 * @param from The start of the side, as x and z.
 * @param to The end of the side, as x and z.
 * @param build The build of the stage.
 */
function addSkirt(builder: MeshBuilder, from: FloorPoint, to: FloorPoint, build: StageBuild): void {
  const length = Math.hypot(to[0] - from[0], to[1] - from[1]);
  const at = (d: number, y: number): Vec3 => [
    from[0] + ((to[0] - from[0]) * d) / length,
    y,
    from[1] + ((to[1] - from[1]) * d) / length,
  ];
  const bottom = -STAGE_THICKNESS;
  const top = -STAGE_LIP.drop;
  const skirt = build.skirt ?? { panel: length, groove: 0 };
  const step = skirt.panel + skirt.groove;
  for (let d = 0; d < length - 1e-9; d += step) {
    const panelEnd = Math.min(d + skirt.panel, length);
    builder.add(quad(at(d, bottom), at(panelEnd, bottom), at(panelEnd, top), at(d, top)), {
      color: build.colors.skirt,
    });
    const grooveEnd = Math.min(d + step, length);
    if (grooveEnd > panelEnd) {
      builder.add(
        quad(at(panelEnd, bottom), at(grooveEnd, bottom), at(grooveEnd, top), at(panelEnd, top)),
        { color: build.colors.groove },
      );
    }
  }
}

/** One closed outline at one height, for a band of {@link addBand}. */
interface Ring {
  /** The corners, in the order of {@link octagon}. */
  readonly points: readonly FloorPoint[];
  /** The height of the outline. */
  readonly y: number;
}

/**
 * Adds a band between two closed outlines of the same count of corners: one quad for each side.
 * The faces point out of the outline and up, when the second outline is higher or further in.
 *
 * @param builder The builder.
 * @param from The first outline.
 * @param to The second outline.
 * @param color The color.
 */
function addBand(builder: MeshBuilder, from: Ring, to: Ring, color: Rgb): void {
  const count = from.points.length;
  const corners: number[] = [];
  for (let i = 0; i < count; i++) {
    const j = (i + 1) % count;
    const a = from.points[i] ?? [0, 0];
    const b = from.points[j] ?? [0, 0];
    const c = to.points[j] ?? [0, 0];
    const d = to.points[i] ?? [0, 0];
    corners.push(
      ...quad([a[0], from.y, a[1]], [b[0], from.y, b[1]], [c[0], to.y, c[1]], [d[0], to.y, d[1]]),
    );
  }
  builder.add(corners, { color });
}

/**
 * Adds a flat polygon at one height as a fan of triangles.
 *
 * @param builder The builder.
 * @param points The corners, in the order of {@link octagon}.
 * @param y The height.
 * @param up True for faces that point up, false for faces that point down.
 * @param color The color.
 */
function addCap(
  builder: MeshBuilder,
  points: readonly FloorPoint[],
  y: number,
  up: boolean,
  color: Rgb,
): void {
  const [ax, az] = points[0] ?? [0, 0];
  const corners: number[] = [];
  for (let i = 1; i + 1 < points.length; i++) {
    const [bx, bz] = points[up ? i : i + 1] ?? [0, 0];
    const [cx, cz] = points[up ? i + 1 : i] ?? [0, 0];
    corners.push(ax, y, az, bx, y, bz, cx, y, cz);
  }
  builder.add(corners, { color });
}

/**
 * Adds the slab of the stage: the skirt on the eight sides, the bottom, and the raised lip around
 * the top.
 *
 * @param builder The builder.
 * @param side The stage side `S`, in meters.
 * @param build The build of the stage.
 */
function addSlab(builder: MeshBuilder, side: number, build: StageBuild): void {
  const outline = stageOutline(side);
  for (let i = 0; i < outline.length; i++) {
    addSkirt(builder, outline[i] ?? [0, 0], outline[(i + 1) % outline.length] ?? [0, 0], build);
  }
  addCap(builder, outline, -STAGE_THICKNESS, false, build.colors.skirt);

  const profile = EDGE_PROFILES[build.edge];
  for (let k = 0; k + 1 < profile.length; k++) {
    const [d0, y0] = profile[k] ?? [0, 0];
    const [d1, y1] = profile[k + 1] ?? [0, 0];
    addBand(
      builder,
      { points: stageOutline(side, d0), y: y0 },
      { points: stageOutline(side, d1), y: y1 },
      build.colors.nosing,
    );
  }
}

/**
 * Gives the area of the boards inside the edge of the stage top.
 *
 * @param side The stage side `S`, in meters.
 * @returns The area.
 */
function boardArea(side: number): PlankArea {
  const [corner] = stageOutline(side, STAGE_LIP.width);
  return {
    half: side / 2 - STAGE_LIP.width,
    diagonal: Math.abs(corner?.[0] ?? 0) + Math.abs(corner?.[1] ?? 0),
  };
}

/**
 * Adds the planks of the stage top inside the lip: rows from the back to the front, and in each
 * row planks of several lengths from the left to the right, with dark lines between them. The
 * planks at the corners end at the corner cuts.
 *
 * @param builder The builder.
 * @param side The stage side `S`, in meters.
 * @param build The build of the stage.
 */
function addPlanks(builder: MeshBuilder, side: number, build: StageBuild): void {
  const area = boardArea(side);
  const inner = area.half;
  const seam = build.colors.seam;
  const { min, extra } = build.plankLength;
  const half = PLANK_LINE_WIDTH / 2;
  const rows = Math.ceil((2 * inner) / build.plankWidth - 1e-9);
  for (let row = 0; row < rows; row++) {
    const z0 = -inner + row * build.plankWidth;
    const z1 = Math.min(z0 + build.plankWidth, inner);
    const isLast = row === rows - 1;
    const plankZ0 = row === 0 ? z0 : z0 + half;
    const plankZ1 = isLast ? z1 : z1 - half;
    if (!isLast) {
      addTopPiece(builder, [-inner, inner, plankZ1, z1 + half], area, seam);
    }
    // The first plank of a row starts at a staggered place, before the left edge.
    let x0 = -inner - plankHash(row, -1) * (min + extra);
    for (let index = 0; x0 < inner - 1e-9; index++) {
      const x1 = x0 + min + extra * plankHash(row, index);
      const left = Math.max(x0, -inner);
      const right = Math.min(x1, inner);
      const plankLeft = x0 <= -inner ? left : left + half;
      const plankRight = x1 >= inner ? right : right - half;
      if (plankRight > plankLeft) {
        const rect = [plankLeft, plankRight, plankZ0, plankZ1] as const;
        addTopPiece(builder, rect, area, plankColor(row, index, build));
      }
      if (x1 < inner) {
        const rect = [plankRight, x1 + half, plankZ0, plankZ1] as const;
        addTopPiece(builder, rect, area, seam);
      }
      x0 = x1;
    }
  }
}

/**
 * Adds one board of a grid of the stage top: the board, inset by half the width of a dark line,
 * and the half lines around it. The half lines of two boards side by side make one line.
 *
 * @param builder The builder.
 * @param rect The smallest and the largest x, then the smallest and the largest z, of the board
 *   with its half lines.
 * @param area The area of the boards.
 * @param color The color of the board.
 * @param seam The color of the dark lines.
 */
function addBoard(
  builder: MeshBuilder,
  rect: readonly [number, number, number, number],
  area: PlankArea,
  color: Rgb,
  seam: Rgb,
): void {
  const [x0, x1, z0, z1] = rect;
  const h = PLANK_LINE_WIDTH / 2;
  addTopPiece(builder, [x0 + h, x1 - h, z0 + h, z1 - h], area, color);
  addTopPiece(builder, [x0, x1, z0, z0 + h], area, seam);
  addTopPiece(builder, [x0, x1, z1 - h, z1], area, seam);
  addTopPiece(builder, [x0, x0 + h, z0 + h, z1 - h], area, seam);
  addTopPiece(builder, [x1 - h, x1, z0 + h, z1 - h], area, seam);
}

/**
 * Adds the boards of a grid on the stage top: a basket weave of parquet tiles, or a grid of square
 * stage decks (`StageBuild.floor`). The grid has a line on the stage center, so it is symmetric
 * from the left to the right.
 *
 * @param builder The builder.
 * @param side The stage side `S`, in meters.
 * @param build The build of the stage.
 */
function addGrid(builder: MeshBuilder, side: number, build: StageBuild): void {
  const area = boardArea(side);
  const parquet = build.floor === 'parquet';
  const count = parquet ? Math.max(1, Math.round(build.plankLength.min / build.plankWidth)) : 1;
  const tile = parquet ? count * build.plankWidth : build.plankLength.min;
  const tiles = Math.ceil(area.half / tile);
  for (let j = -tiles; j < tiles; j++) {
    for (let i = -tiles; i < tiles; i++) {
      const x0 = i * tile;
      const z0 = j * tile;
      const alongX = (i + j) % 2 === 0;
      for (let k = 0; k < count; k++) {
        const a = k * (tile / count);
        const b = (k + 1) * (tile / count);
        const rect = alongX
          ? ([x0, x0 + tile, z0 + a, z0 + b] as const)
          : ([x0 + a, x0 + b, z0, z0 + tile] as const);
        const color = plankColor(j * 64 + k, i, build);
        addBoard(builder, rect, area, color, build.colors.seam);
      }
    }
  }
}

/**
 * Builds the podium with cut corners and framed panels.
 *
 * @param builder The builder.
 * @param podium The podium center.
 * @param stand False for the podium alone, with no conductor stand.
 * @param colors The colors of the stage parts.
 */
function addPodium(
  builder: MeshBuilder,
  podium: Vec3,
  stand = true,
  colors: StageColors = STAGE_COLORS,
): void {
  const [px, , pz] = podium;
  const [w, h] = PODIUM_SIZE;
  const trim = PODIUM_TRIM;
  const plate = PODIUM_PLATE;
  const body = h - plate;

  // The body: a box with cut corners under the top plate.
  const bodyOutline = moved(insetOctagon(w / 2, trim.cut, trim.overhang), px, pz);
  addBand(builder, { points: bodyOutline, y: 0 }, { points: bodyOutline, y: body }, colors.podium);

  // A darker panel on each of the four main sides, inside a frame of the body color.
  for (let i = 0; i < bodyOutline.length; i += 2) {
    const [ax, az] = bodyOutline[i] ?? [0, 0];
    const [bx, bz] = bodyOutline[i + 1] ?? [0, 0];
    const length = Math.hypot(bx - ax, bz - az);
    const [ux, uz] = [(bx - ax) / length, (bz - az) / length];
    const at = (along: number, y: number): Vec3 => [
      ax + ux * along - uz * trim.panelOut,
      y,
      az + uz * along + ux * trim.panelOut,
    ];
    const [from, to] = [trim.sideFrame, length - trim.sideFrame];
    const [low, high] = [trim.sideFrame, body - trim.sideFrame];
    builder.add(quad(at(from, low), at(to, low), at(to, high), at(from, high)), {
      color: colors.podiumPanel,
    });
  }

  // The top plate: its sides, its lower face where it stands out, and a framed panel on the top.
  const plateOutline = moved(octagon(w / 2, trim.cut), px, pz);
  addBand(
    builder,
    { points: plateOutline, y: body },
    { points: plateOutline, y: h },
    colors.podiumTop,
  );
  addCap(builder, plateOutline, body, false, colors.podiumTop);
  const frameInner = moved(insetOctagon(w / 2, trim.cut, trim.topFrame), px, pz);
  const panel = moved(insetOctagon(w / 2, trim.cut, trim.topFrame + trim.groove), px, pz);
  addBand(builder, { points: plateOutline, y: h }, { points: frameInner, y: h }, colors.podiumTop);
  addBand(builder, { points: frameInner, y: h }, { points: panel, y: h }, colors.seam);
  addCap(builder, panel, h, true, colors.podiumTopPanel);

  if (!stand) {
    return;
  }

  // The stand stands on the stage in front of the podium, and its desk is below the chest of the bear.
  const desk = CONDUCTOR_STAND;
  const top = h;
  const z = pz - desk.forward;
  const color = SCENE_COLORS.stand;
  const post = top + desk.deskHeight;
  builder.add(cylinder(desk.baseRadius, desk.baseRadius, 0.02, 6), {
    color,
    at: transform([px, 0, z]),
  });
  builder.add(box(0.025, post, 0.025), { color, at: transform([px, post / 2, z]) });
  // The desk is a vertical plate that leans back by the tilt, so its face points to the conductor.
  const tilt = new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), -desk.tilt);
  const deskCenter = new Vector3(px, top + desk.deskHeight, z);
  addDesk(
    builder,
    box(desk.deskWidth, desk.deskDepth, 0.015),
    transform(toVec3(deskCenter), toQuat(tilt)),
  );
  // The open score: two pages with a small gap, on the front face of the desk.
  const lift = new Vector3(0, 0, SCORE_PAGE.lift).applyQuaternion(tilt);
  for (const sign of [-1, 1]) {
    const page = box(2 * SCORE_PAGE.halfWidth, 2 * SCORE_PAGE.halfHeight, SCORE_PAGE.thickness);
    const center = new Vector3((sign * desk.deskWidth) / 4, 0, 0).add(lift).add(deskCenter);
    builder.add(page, {
      color: SCENE_COLORS.sheet,
      at: transform(toVec3(center), toQuat(tilt)),
    });
  }
}

/** A page of the open score on the conductor stand, in meters (design 4.5). */
const SCORE_PAGE = {
  halfWidth: CONDUCTOR_STAND.deskWidth / 4 - 0.015,
  halfHeight: CONDUCTOR_STAND.deskDepth / 2 - 0.03,
  thickness: 0.004,
  /** The distance of the middle of the page in front of the middle of the desk. */
  lift: 0.0095,
} as const;

/**
 * Gives the place of an object that stands on the stage and turns around y.
 *
 * @param position The position on the stage.
 * @param facing The turn around y, in radians.
 * @returns The place.
 */
function stagePlace(position: Vec3, facing: number): Transform {
  return transform(
    position,
    toQuat(new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), facing)),
  );
}

/**
 * Gives the sheets of music of a layout (design 4.5): the sheet of each music stand, the sheet on
 * the desk of each piano, and the two pages of the score on the conductor stand. The scene draws
 * staff lines and notes on them. The piano does not move in a pose, so its sheet stays at its
 * place in the bind pose of the player.
 *
 * @param layout The layout of a score.
 * @param models The player models of the score, which give the place of each piano.
 * @returns 12 numbers for each sheet: x, y, z of its corners at the lower left, the lower right,
 *   the upper right, and the upper left, as its reader sees it ({@link deskSheetCorners}).
 */
export function buildSheets(layout: SceneLayout, models: ModelCache): Float32Array {
  const corners: number[] = [];
  for (const at of layout.stands) {
    const place = stagePlace(at.position, at.facing);
    for (const corner of standSheetCorners(at.deskHeight)) {
      corners.push(...applyTransform(place, corner));
    }
  }
  for (const { cast, position, facing } of layout.players) {
    if (cast.instrument !== 'piano') {
      continue;
    }
    const model = models.get(cast.species, cast.instrument, cast.kettles, cast.support);
    const piano = model.pieces.find((placed) => placed.piece.bone === 'instrument');
    if (!piano) {
      continue;
    }
    const place = stagePlace(position, facing);
    for (const corner of pianoSheetCorners()) {
      corners.push(...applyTransform(place, applyTransform(piano.at, corner)));
    }
  }
  if (layout.conductor) {
    const desk = CONDUCTOR_STAND;
    const [px, , pz] = layout.podium;
    const deskCenter: Vec3 = [px, PODIUM_SIZE[1] + desk.deskHeight, pz - desk.forward];
    for (const sign of [-1, 1]) {
      const page = deskSheetCorners(deskCenter, desk.tilt, {
        middle: [(sign * desk.deskWidth) / 4, 0, SCORE_PAGE.lift + SCORE_PAGE.thickness / 2],
        halfWidth: SCORE_PAGE.halfWidth,
        halfHeight: SCORE_PAGE.halfHeight,
      });
      corners.push(...page.flat());
    }
  }
  return new Float32Array(corners);
}

/**
 * The cloth banner on the desk of a music stand (design 4.5, stand banner), as a lectern banner:
 * the cloth goes over the top edge of the desk and hangs straight down behind it, to the side
 * away from the reader, with a fringe at its lower edge.
 */
export const STAND_BANNER = {
  /** The width of the banner as a part of the width of the desk. */
  width: 0.9,
  /** The length of the hanging cloth over its width. */
  aspect: 1.5,
  /** The length of the lip on the front face of the desk, in meters. */
  lip: 0.035,
  /** The gap from the desk to the cloth, in meters. */
  gap: 0.004,
  /** The least height of the lower edge of the banner above the floor, in meters. */
  floorGap: 0.15,
} as const;

/** The stands that carry a banner. */
export interface BannerStands {
  /** True for the stand of the conductor. */
  readonly conductor: boolean;
  /** True for the music stands of the players. */
  readonly players: boolean;
}

/**
 * Gives the three rows of corners of the banner on one desk, in the axes of its stand: the
 * reader is at +z, and the desk leans back by its tilt (`buildMusicStand()`).
 *
 * @param desk The desk: its center height, its width, its depth, its thickness, and its tilt.
 * @param desk.height The height of the middle of the desk above the floor.
 * @param desk.width The width of the desk.
 * @param desk.depth The depth of the desk, from its lower edge to its upper edge.
 * @param desk.thickness The thickness of the desk plate.
 * @param desk.tilt The tilt of the desk toward the reader.
 * @returns 18 numbers: the left and the right corner of the lower edge, of the top edge, and of
 *   the lip, as the audience behind the stand sees the left and the right.
 */
function bannerRows(desk: {
  readonly height: number;
  readonly width: number;
  readonly depth: number;
  readonly thickness: number;
  readonly tilt: number;
}): number[] {
  const b = STAND_BANNER;
  const turn = new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), -desk.tilt);
  const center = new Vector3(0, desk.height, 0);
  const onDesk = (y: number, z: number): Vector3 =>
    new Vector3(0, y, z).applyQuaternion(turn).add(center);
  const edge = onDesk(desk.depth / 2 + b.gap, -desk.thickness / 2 - b.gap);
  const lip = onDesk(desk.depth / 2 - b.lip, desk.thickness / 2 + b.gap);
  const width = Math.min(desk.width * b.width, (edge.y - b.floorGap) / b.aspect);
  const length = width * b.aspect;
  const bottom = edge.clone().setY(edge.y - length);
  const rows: number[] = [];
  // The audience looks at the back of the desk, toward +z: its left is at +x.
  for (const point of [bottom, edge, lip]) {
    rows.push(width / 2, point.y, point.z, -width / 2, point.y, point.z);
  }
  return rows;
}

/**
 * Gives the banners on the stands of a layout (design 4.5, stand banner).
 *
 * @param layout The layout of a score.
 * @param stands The stands that carry a banner.
 * @returns 18 numbers for each banner, in the world axes: the left and the right corner of its
 *   lower edge, of the top edge of the desk, and of its lip on the front of the desk. The left is
 *   the left of a viewer who looks at the back of the stand.
 */
export function buildStandBanners(layout: SceneLayout, stands: BannerStands): Float32Array {
  const out: number[] = [];
  const s = MUSIC_STAND;
  if (stands.players) {
    for (const at of layout.stands) {
      const place = stagePlace(at.position, at.facing);
      const rows = bannerRows({
        height: at.deskHeight,
        width: s.deskWidth,
        depth: s.deskDepth,
        thickness: 0.012,
        tilt: s.tilt,
      });
      for (let i = 0; i < rows.length; i += 3) {
        out.push(...applyTransform(place, [rows[i] ?? 0, rows[i + 1] ?? 0, rows[i + 2] ?? 0]));
      }
    }
  }
  if (stands.conductor && layout.conductor) {
    const desk = CONDUCTOR_STAND;
    const [px, , pz] = layout.podium;
    const rows = bannerRows({
      height: PODIUM_SIZE[1] + desk.deskHeight,
      width: desk.deskWidth,
      depth: desk.deskDepth,
      thickness: 0.015,
      tilt: desk.tilt,
    });
    for (let i = 0; i < rows.length; i += 3) {
      out.push(px + (rows[i] ?? 0), rows[i + 1] ?? 0, pz - desk.forward + (rows[i + 2] ?? 0));
    }
  }
  return new Float32Array(out);
}

/**
 * Builds the static mesh of the stage: the skirt, the raised lip, the planks, the podium, and
 * the conductor stand (design 4.4, 4.5). The outline has eight sides: the corners are cut, as in
 * `orchestra-latest.png`. The stage has no steps, as in `mockup.png` and
 * `scene.png`. The world origin is the stage center on the top of the
 * stage, and +z points to the audience.
 *
 * @param stageSide The stage side `S`, in meters.
 * @param podium The podium center of the layout, or `null` for a chamber group, which has no
 *   podium (design 4.2). The podium is 1.0 m behind the front edge, or further with a soloist
 *   (design 4.5, stage origin).
 * @param build The build of the stage in the stage style (design 4.5, stage style).
 * @returns The mesh data. All vertices follow bone 0.
 */
export function buildStage(
  stageSide: number,
  podium: Vec3 | null,
  build: StageBuild = CLASSIC_STAGE,
): MeshData {
  const builder = new MeshBuilder();
  addSlab(builder, stageSide, build);
  if (build.floor === 'planks') {
    addPlanks(builder, stageSide, build);
  } else {
    addGrid(builder, stageSide, build);
  }
  if (podium) {
    addPodium(builder, podium, true, build.colors);
  }
  return builder.build();
}

/**
 * Builds the podium with the conductor stand on it (design 4.5, props), for a view of the
 * conductor alone. The podium center is on the origin, and its bottom is at y = 0.
 *
 * @param stand False for the podium alone, as in `bear-views.png`.
 * @returns The mesh data. All vertices follow bone 0.
 */
export function buildPodium(stand = true): MeshData {
  const builder = new MeshBuilder();
  addPodium(builder, [0, 0, 0], stand);
  return builder.build();
}
