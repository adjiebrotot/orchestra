import type { SceneLayout } from '../models/layout.ts';
import { standSheetCorners } from '../models/props.ts';
import type { Vec3 } from '../models/tuples.ts';
import { DEG } from '../math.ts';
import { keyDistance, writeKeyPosition } from './camera-keys.ts';
import { bodyBoxes, cameraClear } from './clearance.ts';
import type { ClearBox, StageClearance } from './clearance.ts';
import type { StageHead } from './foreground.ts';
import { frontOf, onStage } from './subjects.ts';
import type { ShotKey } from './types.ts';
import { CINEMA_ASPECT } from './view.ts';

/**
 * The view of the part on a stand from behind its player (design 5.6, part view): an
 * over-the-shoulder camera that looks past the head of the player at the printed music of its
 * stand (design 4.5, sheet music).
 */
export const PART_VIEW = {
  /** The vertical field of view, in degrees. */
  fov: 24,
  /** Half the height of the frame at the sheet, in meters: the sheet with a part of the player. */
  half: 0.3,
  /** The elevation of the camera above the sheet, in degrees. */
  elevation: 34,
  /** The turns from straight behind the player that the search tries, in degrees. */
  turns: [22, -22, 32, -32, 12, -12, 42, -42],
  /** The rises above the elevation that the search tries, in degrees. */
  rises: [0, 8, 16],
  /** The zoom of the end of the move: a slow push-in onto the music. */
  pushIn: 0.9,
  /** The least gap from the line of sight to the sphere of each head, in meters. */
  sightGap: 0.08,
  /** The least gap from the camera to the sphere of each head, in meters. */
  cameraGap: 0.45,
} as const;

/** The stand of a seat, as the view of its part sees it. */
export interface PartSpot {
  readonly seat: number;
  /** The index in `SceneLayout.players` of the principal reader of the stand. */
  readonly owner: number;
  /** The middle of the sheet on the stand. */
  readonly target: Vec3;
  /** The azimuth of the back of the reader: the camera stands near it. */
  readonly behind: number;
}

/** The camera of a part view: its two keys and half the height of its frame. */
export interface PartCamera {
  readonly from: ShotKey;
  readonly to: ShotKey;
  readonly half: number;
}

/**
 * Finds the stand of each seat: the stand that its principal player reads, or else the stand of
 * its first player that reads one. A seat with no stand, such as the piano or the choir, has none.
 *
 * @param layout The layout.
 * @returns The stand of each seat that has one.
 */
export function partSpots(layout: SceneLayout): PartSpot[] {
  const bySeat = new Map<number, PartSpot & { readonly player: number }>();
  for (const stand of layout.stands) {
    for (const reader of stand.readers) {
      const cast = layout.players[reader]?.cast;
      const known = cast ? bySeat.get(cast.seatIndex) : undefined;
      if (!cast || (known && known.player <= cast.player)) {
        continue;
      }
      const [lowLeft, , upRight] = standSheetCorners(stand.deskHeight);
      const middle: Vec3 = [
        (lowLeft[0] + upRight[0]) / 2,
        (lowLeft[1] + upRight[1]) / 2,
        (lowLeft[2] + upRight[2]) / 2,
      ];
      bySeat.set(cast.seatIndex, {
        seat: cast.seatIndex,
        owner: reader,
        player: cast.player,
        target: onStage(middle, stand),
        behind: frontOf(stand.facing) + Math.PI,
      });
    }
  }
  return [...bySeat.values()]
    .map(({ seat, owner, target, behind }) => ({ seat, owner, target, behind }))
    .toSorted((a, b) => a.seat - b.seat);
}

/**
 * Tells if a camera sees the sheet past each head: the line of sight keeps a gap from the sphere
 * of each head, and the camera keeps a gap from it.
 *
 * @param heads The heads of the stage.
 * @param camera The camera.
 * @param target The middle of the sheet.
 * @returns True if no head covers the sheet.
 */
function headsClear(heads: readonly StageHead[], camera: Vec3, target: Vec3): boolean {
  const d = [target[0] - camera[0], target[1] - camera[1], target[2] - camera[2]] as const;
  const length2 = d[0] * d[0] + d[1] * d[1] + d[2] * d[2] || 1;
  return heads.every(({ center, radius }) => {
    const c = [center[0] - camera[0], center[1] - camera[1], center[2] - camera[2]] as const;
    if (Math.hypot(...c) < radius + PART_VIEW.cameraGap) {
      return false;
    }
    const t = Math.min(1, Math.max(0, (c[0] * d[0] + c[1] * d[1] + c[2] * d[2]) / length2));
    const gap = Math.hypot(c[0] - d[0] * t, c[1] - d[1] * t, c[2] - d[2] * t);
    return gap >= radius + PART_VIEW.sightGap;
  });
}

/**
 * Finds the camera of a part view (design 5.6): behind the reader and to one side, above its
 * head, so that the head and the shoulder frame the music. The search tries the turns and the
 * rises of {@link PART_VIEW} in order, and keeps the first camera whose whole move is clear of
 * the bodies of the stage and sees the sheet past each head. A turn to the side of `side` comes
 * first.
 *
 * @param spot The stand.
 * @param clearance The obstacles of the stage.
 * @param heads The heads of the stage.
 * @param side 1 to try the right shoulder first, -1 for the left one.
 * @param accept An added test of the camera at the start of the move, such as the rules of a cut.
 * @returns The camera, or `null` with no clear camera.
 */
export function partCamera(
  spot: PartSpot,
  clearance: StageClearance,
  heads: readonly StageHead[],
  side: 1 | -1 = 1,
  accept: (camera: Vec3, half: number) => boolean = () => true,
): PartCamera | null {
  const v = PART_VIEW;
  const skip = new Set<ClearBox>(bodyBoxes(clearance, spot.target));
  for (const obstacle of clearance.obstacles) {
    if (obstacle.owner === spot.owner) {
      for (const box of obstacle.boxes) {
        skip.add(box);
      }
    }
  }
  for (const rise of v.rises) {
    for (const turn of v.turns) {
      const from: ShotKey = {
        azimuth: spot.behind + side * turn * DEG,
        elevation: (v.elevation + rise) * DEG,
        zoom: 1,
        fov: v.fov,
      };
      const to: ShotKey = { ...from, zoom: v.pushIn };
      const far: [number, number, number] = [0, 0, 0];
      const near: [number, number, number] = [0, 0, 0];
      writeKeyPosition(
        spot.target,
        from.azimuth,
        from.elevation,
        keyDistance(0, v.half, from, CINEMA_ASPECT),
        far,
      );
      writeKeyPosition(
        spot.target,
        to.azimuth,
        to.elevation,
        keyDistance(0, v.half, to, CINEMA_ASPECT),
        near,
      );
      if (
        accept(far, v.half) &&
        headsClear(heads, far, spot.target) &&
        headsClear(heads, near, spot.target) &&
        cameraClear(clearance, spot.target, near, far, skip)
      ) {
        return { from, to, half: v.half };
      }
    }
  }
  return null;
}
