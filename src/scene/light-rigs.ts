import { MathUtils } from 'three';

import type { Vec3 } from '../models/tuples.ts';
import { KEY_PLACE } from '../models/beam.ts';

/**
 * A light setup of the stage (design 4.5, light setups). Each setup puts the key light at one
 * angle and sets the gain of each kind of stage light. The angles follow the standard angles of
 * stage and film light (`docs/reference/light-technique.md`).
 */
export type LightRigId = 'concert' | 'front' | 'side' | 'top' | 'back' | 'cross' | 'low';

/** The place of the key light and the gain of each kind of light of one setup. */
export interface LightRig {
  /** The label in the menu. */
  readonly label: string;
  /**
   * The turn of the key light from the front of the stage axis toward the right side, in radians.
   * A negative turn goes to the left (`KEY_PLACE.azimuth`).
   */
  readonly azimuth: number;
  /** The angle of the key light above the stage top, in radians (`KEY_PLACE.elevation`). */
  readonly elevation: number;
  /** The factor of the key light and of the light on the face of the conductor. */
  readonly key: number;
  /** The factor of the two side lights. */
  readonly side: number;
  /** The factor of the two back-row lights. */
  readonly backRow: number;
  /** The factor of the rim lights behind the orchestra and of their visible beams. */
  readonly rim: number;
  /** The factor of the fill light. */
  readonly fill: number;
}

/**
 * The light setups. "Concert" keeps the lights of `scene/lights.ts`. The other setups keep the
 * distance of the key light (`KEY_PLACE.distance`), so its intensity at the build stays correct.
 * A key light that is almost vertical gives no clear up direction to its cameras, so "Top" stays
 * below 90°.
 */
export const LIGHT_RIGS: Readonly<Record<LightRigId, LightRig>> = {
  concert: {
    label: 'Concert: front key, back beam',
    azimuth: KEY_PLACE.azimuth,
    elevation: KEY_PLACE.elevation,
    key: 1,
    side: 1,
    backRow: 1,
    rim: 1,
    fill: 1,
  },
  front: {
    label: 'Front light',
    azimuth: 0,
    elevation: 45 * MathUtils.DEG2RAD,
    key: 1,
    side: 1.4,
    backRow: 1.2,
    rim: 0.4,
    fill: 1.15,
  },
  side: {
    label: 'Side light',
    azimuth: -78 * MathUtils.DEG2RAD,
    elevation: 32 * MathUtils.DEG2RAD,
    key: 1.25,
    side: 0.3,
    backRow: 0.5,
    rim: 0.7,
    fill: 0.8,
  },
  top: {
    label: 'Top light',
    azimuth: KEY_PLACE.azimuth,
    elevation: 82 * MathUtils.DEG2RAD,
    key: 1.3,
    side: 0.25,
    backRow: 0.4,
    rim: 0.6,
    fill: 0.7,
  },
  back: {
    label: 'Back light',
    azimuth: KEY_PLACE.azimuth,
    elevation: KEY_PLACE.elevation,
    key: 0.3,
    side: 0.5,
    backRow: 0.5,
    rim: 2,
    fill: 0.8,
  },
  cross: {
    label: 'Cross light',
    azimuth: -45 * MathUtils.DEG2RAD,
    elevation: 45 * MathUtils.DEG2RAD,
    key: 0.85,
    side: 3,
    backRow: 1.5,
    rim: 1,
    fill: 1,
  },
  low: {
    label: 'Low front light',
    azimuth: -15 * MathUtils.DEG2RAD,
    elevation: 18 * MathUtils.DEG2RAD,
    key: 0.95,
    side: 0.6,
    backRow: 0.8,
    rim: 0.6,
    fill: 1,
  },
};

/** The ids of the light setups, in the order of the menu. */
const RIG_ORDER: readonly LightRigId[] = [
  'concert',
  'front',
  'side',
  'top',
  'back',
  'cross',
  'low',
];

/** The options of the menu of the light setups, in the order of the menu. */
export const LIGHT_RIG_OPTIONS: readonly (readonly [LightRigId, string])[] = RIG_ORDER.map((id) => [
  id,
  LIGHT_RIGS[id].label,
]);

/**
 * Gives the position of the key light of a stage in a light setup: the azimuth and the elevation
 * of the setup at the distance `KEY_PLACE.distance`. The stage axes have +x to the right, +y up,
 * and +z to the audience.
 *
 * @param stageSide The stage side `S`, in meters.
 * @param rig The light setup.
 * @returns The position, in meters.
 */
export function rigKeyPlace(stageSide: number, rig: LightRig): Vec3 {
  const distance = KEY_PLACE.distance * stageSide;
  const flat = distance * Math.cos(rig.elevation);
  return [
    flat * Math.sin(rig.azimuth),
    distance * Math.sin(rig.elevation),
    flat * Math.cos(rig.azimuth),
  ];
}
