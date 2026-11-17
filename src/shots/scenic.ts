import type { Vec3 } from '../models/tuples.ts';
import type { ShotKey } from './types.ts';
import { CINEMA_ASPECT, FIELD_OF_VIEW, defaultDistance } from './view.ts';

/** Degrees to radians. */
const DEG = Math.PI / 180;

/**
 * The scenic moves (design 5.6, scenic shots): far shots that show the stage dressing and the hall
 * behind the orchestra, as the crane and drone shots of a concert film.
 *
 * - `helicopter`: a high orbit over the orchestra that sinks while it turns, with the dressing
 *   behind the back row.
 * - `low-orbit`: a low camera near the height of the stage top turns around the orchestra. It
 *   looks up a little, so the screen and the banners stand above the heads.
 * - `backdrop-orbit`: the camera turns around the dressing itself, over the heads of the
 *   orchestra.
 */
export type ScenicMove = 'helicopter' | 'low-orbit' | 'backdrop-orbit';

/** The scenic moves, in the order of the menu of the camera director, with their labels. */
export const SCENIC_MOVES: readonly (readonly [ScenicMove, string])[] = [
  ['helicopter', 'Helicopter view'],
  ['low-orbit', 'Low-angle orbit'],
  ['backdrop-orbit', 'Backdrop orbit'],
];

/**
 * The vertical field of view of the scenic shots, in degrees: the field of view of the wide and
 * high shots (`WIDE_FOV` of `prepare.ts`). At 21:9, it shows the horizontal angle of the stage
 * view of a desktop.
 */
const SCENIC_FOV =
  (2 * Math.atan((Math.tan((FIELD_OF_VIEW / 2) * DEG) * 1.6) / CINEMA_ASPECT)) / DEG;

/** The values of one scenic move. */
interface ScenicValues {
  /** The target: x and y in meters, and z in stage sides plus meters (`zSides`, `zMeters`). */
  readonly y: number;
  readonly zSides: number;
  readonly zMeters: number;
  /** The elevation at the start and at the end, in degrees. */
  readonly elevation: readonly [number, number];
  /**
   * The height of the camera above the stage top, in meters, in place of the elevation: the
   * elevation follows from the distance. `null` uses `elevation`.
   */
  readonly height: readonly [number, number] | null;
  /** The arc of the orbit, in degrees. The arc is centered on the audience axis. */
  readonly arc: number;
  /** The zoom at the start and at the end: a factor of the default distance. */
  readonly zoom: readonly [number, number];
}

/**
 * The scenic shots (design 5.6, scenic shots). Each one keeps the camera out of the box of the
 * stage and the players: a helicopter camera stands high above the heads, and the other cameras
 * stand in front of the front edge of the stage.
 */
export const SCENIC_SHOTS = {
  /**
   * A target above the middle of the stage, so the dressing behind the back row stays in the
   * upper part of the frame. The orbit sinks from 52° to 40°, and it pulls in a little.
   */
  helicopter: {
    y: 0.8,
    zSides: -0.12,
    zMeters: 0,
    elevation: [52, 40],
    height: null,
    arc: 56,
    zoom: [1.0, 0.86],
  },
  /**
   * The camera stands 0.5 m to 0.8 m above the stage top, and it looks at a point 1.5 m above the
   * stage top. Thus the frame holds the front row, the heads of the back rows, and the screen and
   * the banners above them.
   */
  'low-orbit': {
    y: 1.5,
    zSides: -0.1,
    zMeters: 0,
    elevation: [0, 0],
    height: [0.5, 0.8],
    arc: 44,
    zoom: [0.48, 0.42],
  },
  /**
   * The target is the middle of the screen (`BACKDROP.screen` of `scene/backdrop.ts`): 1.3 m
   * behind the back edge, and about 2.3 m above the stage top. The camera stands over the front
   * of the stage, so the orchestra fills the lower part of the frame.
   */
  'backdrop-orbit': {
    y: 2.3,
    zSides: -0.5,
    zMeters: -1.3,
    elevation: [13, 9],
    height: null,
    arc: 40,
    zoom: [0.52, 0.48],
  },
} as const satisfies Readonly<Record<ScenicMove, ScenicValues>>;

/** The framing of a scenic shot: the target, and the cameras at the start and at the end. */
export interface ScenicFraming {
  readonly target: Vec3;
  readonly from: ShotKey;
  readonly to: ShotKey;
}

/**
 * Gives the elevation of a camera at a height above the stage top.
 *
 * @param target The target.
 * @param distance The distance from the target to the camera, in meters.
 * @param height The height of the camera above the stage top, in meters.
 * @returns The elevation, in radians.
 */
function elevationAt(target: Vec3, distance: number, height: number): number {
  return Math.asin(Math.min(1, Math.max(-1, (height - target[1]) / distance)));
}

/**
 * Makes the framing of a scenic shot (design 5.6, scenic shots). Pure: the same inputs give the
 * same framing.
 *
 * @param move The move.
 * @param stageSide The stage side `S`, in meters.
 * @param direction The direction of the orbit: 1 to the right (toward +x), -1 to the left, or 0
 *   for a camera that holds the middle of the arc.
 * @returns The framing.
 */
export function scenicFraming(
  move: ScenicMove,
  stageSide: number,
  direction: -1 | 0 | 1,
): ScenicFraming {
  const k: ScenicValues = SCENIC_SHOTS[move];
  const target: Vec3 = [0, k.y, k.zSides * stageSide + k.zMeters];
  const base = defaultDistance(stageSide, CINEMA_ASPECT);
  const key = (part: 0 | 1): ShotKey => {
    const zoom = direction === 0 ? (k.zoom[0] + k.zoom[1]) / 2 : k.zoom[part];
    const distance = base * zoom;
    const elevation = k.height
      ? elevationAt(target, distance, direction === 0 ? k.height[0] : k.height[part])
      : (direction === 0 ? (k.elevation[0] + k.elevation[1]) / 2 : k.elevation[part]) * DEG;
    const side = part === 0 ? -1 : 1;
    return {
      azimuth: (direction * side * k.arc * DEG) / 2,
      elevation,
      zoom,
      fov: SCENIC_FOV,
    };
  };
  return { target, from: key(0), to: key(1) };
}
