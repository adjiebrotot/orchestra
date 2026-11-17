import type { SceneLayout } from '../models/layout.ts';
import type { ModelCache } from '../models/model-cache.ts';
import type { Vec3 } from '../models/tuples.ts';
import { END_BOW, END_BOW_SEC } from '../pose/end-bow.ts';
import type { Score } from '../score/types.ts';
import { CONDUCTOR_OWNER } from './clearance.ts';
import { prepareSubjects } from './subjects.ts';
import type { Shot, ShotPlan } from './types.ts';

/** Degrees to radians. */
const DEG = Math.PI / 180;

/**
 * The shot of the bow of the conductor (design 5.6, bow shot): a low camera on the audience side
 * orbits around the podium, so that the film shows the bear that turns to the audience and bows.
 */
export const BOW_SHOT = {
  /** The vertical field of view, in degrees. */
  fov: 30,
  /**
   * Half the height of the frame at the target, as a part of the height of the bear above the
   * podium top. The frame holds the bear, the podium, and the bend of the bow.
   */
  frame: 0.8,
  /** The target, as a part of the height of the bear above the podium top. */
  targetShare: 0.55,
  /** The lowest elevation of the camera, in degrees: the camera looks up at the bear. */
  elevation: -10,
  /** The least height of the camera above the stage plane, in meters. */
  floor: 0.35,
  /** Half the arc of the orbit, in degrees, around the audience axis. */
  arc: 24,
  /** The blend into the shot, in seconds. It ends before the bear starts to turn. */
  blendSec: 1,
} as const;

/**
 * Adds the shot of the bow of the conductor to the end of a plan (design 5.6, bow shot). The shot
 * starts after the release of the last chord (`END_BOW.silenceSec`) and orbits until the bear
 * faces the orchestra again (`END_BOW_SEC`). The song time of the camera after the song end is
 * the song end plus the wall seconds since the stop (`App`). Pure: the same inputs give the same
 * plan.
 *
 * @param plan The plan: the automatic plan or the plan of the director.
 * @param score The score.
 * @param layout The layout of the score.
 * @param models The player models of the score.
 * @returns The plan with the bow shot, or `plan` for a layout with no conductor.
 */
export function withBowShot(
  plan: ShotPlan,
  score: Score,
  layout: SceneLayout,
  models: ModelCache,
): ShotPlan {
  const { conductor } = prepareSubjects(score, layout, models);
  if (!conductor) {
    return plan;
  }
  const b = BOW_SHOT;
  const startSec = score.durationSec + END_BOW.silenceSec;
  const [fx, fy, fz] = conductor.feet;
  const height = Math.max(0.5, conductor.top - fy);
  const target: Vec3 = [fx, fy + height * b.targetShare, fz];
  const halfHeight = height * b.frame;
  const distance = halfHeight / Math.tan((b.fov / 2) * DEG);
  const lowest = Math.asin(Math.max(-1, Math.min(1, (b.floor - target[1]) / distance)));
  const elevation = Math.max(b.elevation * DEG, lowest);
  const bow: Shot = {
    kind: 'conductor',
    startSec,
    endSec: Infinity,
    moveEndSec: score.durationSec + END_BOW_SEC,
    seats: [],
    part: null,
    target,
    halfHeight,
    composition: null,
    from: { azimuth: -b.arc * DEG, elevation, zoom: 1, fov: b.fov },
    to: { azimuth: b.arc * DEG, elevation, zoom: 1, fov: b.fov },
    blendSec: b.blendSec,
    hero: CONDUCTOR_OWNER,
  };
  const shots: Shot[] = [];
  for (const shot of plan.shots) {
    if (shot.startSec < startSec) {
      shots.push(shot.endSec > startSec ? Object.assign({}, shot, { endSec: startSec }) : shot);
    }
  }
  shots.push(bow);
  const inserts = plan.inserts.filter((shot) => shot.endSec <= startSec);
  return {
    stageSide: plan.stageSide,
    shots,
    starts: Float64Array.from(shots, (shot) => shot.startSec),
    inserts,
    insertStarts: Float64Array.from(inserts, (shot) => shot.startSec),
  };
}
