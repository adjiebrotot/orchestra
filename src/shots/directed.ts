import type { ModelCache } from '../models/model-cache.ts';
import type { SceneLayout } from '../models/layout.ts';
import type { Vec3 } from '../models/tuples.ts';
import type { Score } from '../score/types.ts';
import { keyDistance, writeKeyPosition } from './camera-keys.ts';
import { CONDUCTOR_OWNER, cameraClear, prepareClearance } from './clearance.ts';
import type { ClearBox, StageClearance } from './clearance.ts';
import { thirdOf } from './grammar.ts';
import { SHOT_SIZES, frameHalfHeight } from './shot-size.ts';
import type { ShotSize } from './shot-size.ts';
import { conductorCloseSubject, prepareSubjects, sectionSubject, soloSubject } from './subjects.ts';
import type { StageSubjects, Subject } from './subjects.ts';
import type { Composition, Shot, ShotKey, ShotKind, ShotPlan } from './types.ts';
import { CINEMA_ASPECT, DEFAULT_ELEVATION, DEFAULT_TARGET, FIELD_OF_VIEW } from './view.ts';

/** Degrees to radians. */
const DEG = Math.PI / 180;

/**
 * Where a cue points the camera: the automatic plan (`auto`), the whole stage (`wide`), the stage
 * from high in the hall (`high`), the conductor, or one seat of the score (`seat:<index>`).
 */
export type DirectorFocus = 'auto' | 'wide' | 'high' | 'conductor' | `seat:${number}`;

/** The move of the camera during a directed shot. */
export type DirectorMotion =
  | 'static'
  | 'push-in'
  | 'pull-out'
  | 'orbit-left'
  | 'orbit-right'
  | 'crane-up'
  | 'crane-down';

/** The moves, in the order of the menu, with their labels. */
export const DIRECTOR_MOTIONS: readonly (readonly [DirectorMotion, string])[] = [
  ['static', 'Static'],
  ['push-in', 'Push in'],
  ['pull-out', 'Pull out'],
  ['orbit-left', 'Orbit left'],
  ['orbit-right', 'Orbit right'],
  ['crane-up', 'Crane up'],
  ['crane-down', 'Crane down'],
];

/** One cue of the camera path: from its time until the next cue, the camera follows it. */
export interface DirectorCue {
  /** Song seconds. */
  readonly timeSec: number;
  readonly focus: DirectorFocus;
  readonly motion: DirectorMotion;
  /** True for a hard cut into the shot, false for a blend from the shot before it. */
  readonly cut: boolean;
}

/** The longest blend into a directed shot, in song seconds. */
const MAX_BLEND_SEC = 1.5;

/** The zoom factor of a push-in or a pull-out. Less than 1 is closer. */
const PUSH_ZOOM = 0.8;

/** Half the arc of an orbit, in degrees, for a close shot and for a far shot. */
const ORBIT_DEG = { close: 10, far: 14 } as const;

/** The change of the elevation of a crane move, in degrees: down from the key, and up from it. */
const CRANE_DEG = { low: 5, high: 10 } as const;

/**
 * The vertical field of view of the wide and the high shots, as `WIDE_FOV` of `prepare.ts`: the
 * horizontal angle of {@link FIELD_OF_VIEW} on a desktop of aspect 1.6, in a 21:9 frame.
 */
const WIDE_FOV = (2 * Math.atan((Math.tan((FIELD_OF_VIEW / 2) * DEG) * 1.6) / CINEMA_ASPECT)) / DEG;

/** The values of the key of each kind of directed close shot. */
const CLOSE_KEYS = {
  conductor: { fov: 26, elevation: 8, backRise: 0, size: SHOT_SIZES.conductor },
  section: { fov: 30, elevation: 11, backRise: 8, size: SHOT_SIZES.section },
  solo: { fov: 24, elevation: 9, backRise: 10, size: SHOT_SIZES.solo },
} as const satisfies Readonly<
  Record<string, { fov: number; elevation: number; backRise: number; size: ShotSize }>
>;

/** The framing of one directed shot, before its times. */
interface Framing {
  readonly kind: ShotKind;
  readonly target: Vec3;
  readonly halfHeight: number;
  readonly composition: Composition | null;
  readonly from: ShotKey;
  readonly to: ShotKey;
  readonly seats: readonly number[];
  readonly hero: number | null;
}

/**
 * Gives the seat of a focus, or `null` for a focus that names no seat.
 *
 * @param focus The focus.
 * @returns The index of the seat in `Score.seats`, or `null`.
 */
export function focusSeat(focus: string): number | null {
  const match = /^seat:(\d+)$/u.exec(focus);
  return match ? Number(match[1]) : null;
}

/**
 * Gives the two keys of a move around one key.
 *
 * @param key The key of the shot.
 * @param motion The move.
 * @param close True for a close shot.
 * @returns The key at the start and at the end of the move.
 */
function moveKeys(key: ShotKey, motion: DirectorMotion, close: boolean): [ShotKey, ShotKey] {
  const orbit = (close ? ORBIT_DEG.close : ORBIT_DEG.far) * DEG;
  switch (motion) {
    case 'push-in':
      return [key, { ...key, zoom: key.zoom * PUSH_ZOOM }];
    case 'pull-out':
      return [{ ...key, zoom: key.zoom * PUSH_ZOOM }, key];
    case 'orbit-left':
      return [
        { ...key, azimuth: key.azimuth + orbit },
        { ...key, azimuth: key.azimuth - orbit },
      ];
    case 'orbit-right':
      return [
        { ...key, azimuth: key.azimuth - orbit },
        { ...key, azimuth: key.azimuth + orbit },
      ];
    case 'crane-up':
      return [
        { ...key, elevation: key.elevation - CRANE_DEG.low * DEG },
        { ...key, elevation: key.elevation + CRANE_DEG.high * DEG },
      ];
    case 'crane-down':
      return [
        { ...key, elevation: key.elevation + CRANE_DEG.high * DEG },
        { ...key, elevation: key.elevation - CRANE_DEG.low * DEG },
      ];
    default:
      return [key, key];
  }
}

/**
 * Makes the framing of a far shot: the whole stage from the front, or from high in the hall.
 *
 * @param kind `wide` or `high`.
 * @param stageSide The stage side `S`, in meters.
 * @param motion The move.
 * @returns The framing.
 */
function farFraming(kind: 'wide' | 'high', stageSide: number, motion: DirectorMotion): Framing {
  const key: ShotKey =
    kind === 'wide'
      ? { azimuth: 0, elevation: DEFAULT_ELEVATION * 0.8, zoom: 1, fov: WIDE_FOV }
      : { azimuth: 0, elevation: 39 * DEG, zoom: 0.75, fov: WIDE_FOV };
  const [from, to] = moveKeys(key, motion, false);
  const target: Vec3 = kind === 'wide' ? DEFAULT_TARGET : [0, 0, -0.05 * stageSide];
  return { kind, target, halfHeight: 0, composition: null, from, to, seats: [], hero: null };
}

/** The turns of the camera from the front of a subject that the search tries, in degrees. */
const SEARCH_TURNS = [0, 15, -15, 30, -30, 45, -45, 60, -60] as const;

/** The rises of the camera above the elevation of the kind that the search tries, in degrees. */
const SEARCH_RISES = [0, 10, 20, 32] as const;

/**
 * Tells if the cameras of a move stand clear of the bodies of the stage and see the target.
 *
 * @param clearance The obstacles of the layout.
 * @param skip The boxes of the subject players.
 * @param target The target of the shot.
 * @param halfHeight Half the height of the frame of the shot.
 * @param keys The keys of the move.
 * @returns True if each camera of the move is clear.
 */
function moveClear(
  clearance: StageClearance,
  skip: ReadonlySet<ClearBox>,
  target: Vec3,
  halfHeight: number,
  keys: readonly ShotKey[],
): boolean {
  const [from, to] = [keys[0], keys[1]];
  if (!from || !to) {
    return false;
  }
  const mid: ShotKey = {
    azimuth: (from.azimuth + to.azimuth) / 2,
    elevation: (from.elevation + to.elevation) / 2,
    zoom: (from.zoom + to.zoom) / 2,
    fov: from.fov,
  };
  return [from, mid, to].every((key) => {
    const near: [number, number, number] = [0, 0, 0];
    const far: [number, number, number] = [0, 0, 0];
    const d = keyDistance(0, halfHeight, key, CINEMA_ASPECT);
    writeKeyPosition(target, key.azimuth, key.elevation, d * 0.9, near);
    writeKeyPosition(target, key.azimuth, key.elevation, d, far);
    return cameraClear(clearance, target, near, far, skip);
  });
}

/**
 * Makes the framing of a close shot of a subject. The camera stands in front of the subject; when
 * a body of the stage is in the way, the camera turns around the subject and rises until it is
 * clear, as the cameras of the automatic plan do.
 *
 * @param kind The kind of the shot.
 * @param subject The subject.
 * @param motion The move.
 * @param hero The hero of the shot.
 * @param clearance The obstacles of the layout.
 * @returns The framing, or `null` for a search with no candidate.
 */
function closeFraming(
  kind: 'conductor' | 'section' | 'solo',
  subject: Subject,
  motion: DirectorMotion,
  hero: number | null,
  clearance: StageClearance,
): Framing | null {
  const k = CLOSE_KEYS[kind];
  const members = new Set(subject.members);
  const skip = new Set(
    clearance.obstacles.filter((o) => members.has(o.owner)).flatMap((o) => o.boxes),
  );
  const base = (k.elevation + k.backRise * subject.back) * DEG + subject.lift;
  let chosen: Framing | null = null;
  let fallback: Framing | null = null;
  search: for (const rise of SEARCH_RISES) {
    for (const turn of SEARCH_TURNS) {
      const elevation = base + rise * DEG;
      const azimuth = subject.front + turn * subject.spread * DEG;
      const key: ShotKey = { azimuth, elevation, zoom: 1, fov: k.fov };
      const [from, to] = moveKeys(key, motion, true);
      const third = subject.eyes ? thirdOf(subject.facing, azimuth) : 0;
      const zoom = Math.min(from.zoom, to.zoom);
      const halfHeight = frameHalfHeight(subject, k.size, azimuth, elevation, third, k.fov, zoom);
      const framing: Framing = {
        kind,
        target: subject.target,
        halfHeight,
        composition: subject.eyes ? { eyes: subject.eyes, third } : null,
        from,
        to,
        seats: subject.seats,
        hero,
      };
      fallback = framing;
      if (moveClear(clearance, skip, subject.target, halfHeight, [from, to])) {
        chosen = framing;
        break search;
      }
    }
  }
  // With no clear camera, the highest front camera of the search looks down over the bodies.
  return chosen ?? fallback;
}

/**
 * Makes the framing of a cue.
 *
 * @param subjects The subjects of the layout.
 * @param cue The cue. Its focus is not `auto`.
 * @returns The framing. A focus with no players on the stage gives the wide shot.
 */
function framingOf(subjects: StageSubjects, clearance: StageClearance, cue: DirectorCue): Framing {
  const { stageSide } = subjects;
  if (cue.focus === 'high') {
    return farFraming('high', stageSide, cue.motion);
  }
  if (cue.focus === 'conductor' && subjects.conductor) {
    const subject = conductorCloseSubject(subjects.conductor);
    const framing = closeFraming('conductor', subject, cue.motion, CONDUCTOR_OWNER, clearance);
    if (framing) {
      return framing;
    }
  }
  const seat = focusSeat(cue.focus);
  const players = seat === null ? null : subjects.seats[seat];
  if (seat !== null && players) {
    if (players.players.length === 1) {
      const subject = soloSubject(subjects, seat);
      const framing =
        subject && closeFraming('solo', subject, cue.motion, subject.members[0] ?? null, clearance);
      if (framing) {
        return framing;
      }
    }
    const subject = sectionSubject(subjects, [seat]);
    const framing =
      subject &&
      closeFraming('section', subject, cue.motion, subject.members[0] ?? null, clearance);
    if (framing) {
      return framing;
    }
  }
  return farFraming('wide', stageSide, cue.motion);
}

/**
 * Cuts a shot of the automatic plan to a span of time.
 *
 * @param shot The shot.
 * @param start The start of the span.
 * @param end The end of the span.
 * @param blendSec The blend into the shot when the span cuts its start.
 * @returns The shot in the span.
 */
function clipShot(shot: Shot, start: number, end: number, blendSec: number): Shot {
  const clipped = shot.startSec < start;
  return {
    ...shot,
    startSec: clipped ? start : shot.startSec,
    endSec: Math.min(shot.endSec, end),
    moveEndSec: Math.max(Math.min(shot.moveEndSec, end), clipped ? start : shot.startSec),
    blendSec: clipped ? blendSec : shot.blendSec,
  };
}

/**
 * Gives the blend into a shot of a cue.
 *
 * @param cut True for a hard cut.
 * @param span The length of the shot, in song seconds.
 * @returns The blend, in song seconds.
 */
function blendOf(cut: boolean, span: number): number {
  return cut ? 0 : Math.min(MAX_BLEND_SEC, span / 2);
}

/**
 * Makes the shot plan of the directed camera path. Before the first cue, and from each cue with
 * the focus `auto`, the shots of the automatic plan show. From each other cue to the next cue,
 * one shot shows its focus with its move. Pure: the same inputs give the same plan.
 *
 * @param auto The automatic plan of the score, from `prepareShots()`.
 * @param score The score.
 * @param layout The layout of the score.
 * @param models The player models of the score.
 * @param cues The cues, in any order.
 * @returns The plan. With no cue, the automatic plan.
 */
export function directedPlan(
  auto: ShotPlan,
  score: Score,
  layout: SceneLayout,
  models: ModelCache,
  cues: readonly DirectorCue[],
): ShotPlan {
  const sorted = cues
    .filter((cue) => Number.isFinite(cue.timeSec))
    .toSorted((a, b) => a.timeSec - b.timeSec);
  if (sorted.length === 0) {
    return auto;
  }
  const subjects = prepareSubjects(score, layout, models);
  const clearance = prepareClearance(layout, models);
  const shots: Shot[] = [];
  const inserts: Shot[] = [];
  /** Adds the shots and the inserts of the automatic plan in a span. */
  const addAuto = (start: number, end: number, blendSec: number): void => {
    for (const shot of auto.shots) {
      if (shot.startSec < end && shot.endSec > start) {
        shots.push(clipShot(shot, start, end, blendSec));
      }
    }
    for (const insert of auto.inserts) {
      if (insert.startSec >= start && insert.endSec <= end) {
        inserts.push(insert);
      }
    }
  };
  const firstTime = Math.max(0, sorted[0]?.timeSec ?? 0);
  if (firstTime > 0) {
    addAuto(-Infinity, firstTime, 0);
  }
  for (const [i, cue] of sorted.entries()) {
    const start = i === 0 && firstTime <= 0 ? -Infinity : Math.max(0, cue.timeSec);
    const next = sorted[i + 1];
    const end = next ? Math.max(start, next.timeSec) : Infinity;
    if (end <= start) {
      continue;
    }
    const span = (Number.isFinite(end) ? end : score.durationSec) - Math.max(start, 0);
    const blendSec = shots.length === 0 ? 0 : blendOf(cue.cut, span);
    if (cue.focus === 'auto') {
      addAuto(start, end, blendSec);
      continue;
    }
    const framing = framingOf(subjects, clearance, cue);
    shots.push({
      kind: framing.kind,
      startSec: start,
      endSec: end,
      moveEndSec: Number.isFinite(end) ? end : Math.max(score.durationSec, Math.max(start, 0)),
      seats: framing.seats,
      part: null,
      target: framing.target,
      halfHeight: framing.halfHeight,
      composition: framing.composition,
      from: framing.from,
      to: framing.to,
      blendSec,
      hero: framing.hero,
    });
  }
  return {
    stageSide: auto.stageSide,
    shots,
    starts: Float64Array.from(shots, (shot) => shot.startSec),
    inserts,
    insertStarts: Float64Array.from(inserts, (shot) => shot.startSec),
  };
}
