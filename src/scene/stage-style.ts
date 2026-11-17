/**
 * The stage styles (design 4.5, stage style): each style sets the look of the stage dressing (the
 * poles, the rods, the batten, the cloth, and the screen) and the colors of the stage lights. The
 * style "Classic hall" keeps the values of `BACKDROP` and of `scene/lights.ts`.
 */

/** A stage style. */
export type StageStyleId = 'classic' | 'gala' | 'midnight' | 'festival' | 'modern';

/** The look of the stage dressing in one style. The colors are in sRGB. */
export interface DressingStyle {
  /** The poles, the bases, and the staffs of the flags. */
  readonly metal: string;
  /** The batten, the cables, and the frame of the screen. */
  readonly dark: string;
  /** The rods of the hanging banners. */
  readonly rod: string;
  /** The sheen of a banner or a flag, and of a metal part. */
  readonly sheen: { readonly cloth: number; readonly metal: number };
  /** The color of the sheen, as linear factors. */
  readonly sheenColor: readonly [number, number, number];
  /** The light of the cloth, as a part of the baked light of the hall (`BACKDROP.level`). */
  readonly level: number;
  /** The factor of the light of the screen (`BACKDROP.screen.level`). */
  readonly screenLevel: number;
  /** The tint of the screen image, as linear factors. */
  readonly screenTint: readonly [number, number, number];
}

/** The colors of the stage lights in one style. The colors are in sRGB. */
export interface LightStyle {
  /** The key light and the light on the face of the conductor. */
  readonly key: string;
  /** The two side lights. */
  readonly side: string;
  /** The two back-row lights. */
  readonly backRow: string;
  /** The rim lights behind the orchestra. */
  readonly rim: string;
  /** The visible beams of the rim lights in the haze. */
  readonly beam: string;
  /** The sky and the ground of the fill light. */
  readonly fill: { readonly sky: string; readonly ground: string };
  /** The factor of the intensity of each spotlight and of the beams. */
  readonly gain: number;
  /** The extra exposure, in stops. */
  readonly exposure: number;
}

/** One stage style: its label, the look of the dressing, and the lights. */
export interface StageStyle {
  readonly label: string;
  readonly dressing: DressingStyle;
  readonly light: LightStyle;
}

/**
 * The stage styles, in the order of the menu. "Classic hall" has the values of `BACKDROP` and of
 * the lights of `scene/lights.ts`.
 */
export const STAGE_STYLES: Readonly<Record<StageStyleId, StageStyle>> = {
  classic: {
    label: 'Classic hall: warm amber light, chrome poles',
    dressing: {
      metal: '#b9b6b0',
      dark: '#1b1714',
      rod: '#5a3d26',
      sheen: { cloth: 0.08, metal: 0.55 },
      sheenColor: [1, 0.86, 0.68],
      level: 0.5,
      screenLevel: 1,
      screenTint: [1, 1, 1],
    },
    light: {
      key: '#ffca98',
      side: '#ffe6d2',
      backRow: '#ffe6d2',
      rim: '#ffca98',
      beam: '#ffcf9e',
      fill: { sky: '#2c2c2e', ground: '#2c241e' },
      gain: 1,
      exposure: 0,
    },
  },
  gala: {
    label: 'Royal gala: gold poles, crimson frame, golden light',
    dressing: {
      metal: '#d9b25c',
      dark: '#3a1216',
      rod: '#8a2a22',
      sheen: { cloth: 0.2, metal: 0.8 },
      sheenColor: [1, 0.8, 0.45],
      level: 0.56,
      screenLevel: 1,
      screenTint: [1.05, 0.97, 0.85],
    },
    light: {
      key: '#ffc27e',
      side: '#ffd8a6',
      backRow: '#ffd8a6',
      rim: '#ffb050',
      beam: '#ffb85e',
      fill: { sky: '#30241c', ground: '#36221a' },
      gain: 1.1,
      exposure: 0.1,
    },
  },
  midnight: {
    label: 'Midnight blue: silver poles, cool moonlight',
    dressing: {
      metal: '#cdd6e4',
      dark: '#0d1424',
      rod: '#26365a',
      sheen: { cloth: 0.12, metal: 0.7 },
      sheenColor: [0.7, 0.82, 1],
      level: 0.42,
      screenLevel: 0.9,
      screenTint: [0.85, 0.93, 1.1],
    },
    light: {
      key: '#dbe5ff',
      side: '#c3d4ff',
      backRow: '#b4c8ff',
      rim: '#7ea2ff',
      beam: '#8eaeff',
      fill: { sky: '#1a2236', ground: '#151a28' },
      gain: 0.95,
      exposure: -0.05,
    },
  },
  festival: {
    label: 'Festival: black truss, magenta and cyan wash, bright screen',
    dressing: {
      metal: '#2b2b30',
      dark: '#121216',
      rod: '#1b1b20',
      sheen: { cloth: 0.14, metal: 0.4 },
      sheenColor: [1, 0.55, 0.95],
      level: 0.62,
      screenLevel: 1.6,
      screenTint: [1, 1, 1],
    },
    light: {
      key: '#fff1e4',
      side: '#ff86dc',
      backRow: '#78dcff',
      rim: '#ff5cc8',
      beam: '#ff78d2',
      fill: { sky: '#2a1d34', ground: '#1d1826' },
      gain: 1.05,
      exposure: 0.1,
    },
  },
  modern: {
    label: 'Modern white: matte white poles, neutral daylight',
    dressing: {
      metal: '#e4e4e2',
      dark: '#232325',
      rod: '#3b3b3e',
      sheen: { cloth: 0.04, metal: 0.25 },
      sheenColor: [1, 1, 1],
      level: 0.5,
      screenLevel: 1.3,
      screenTint: [1, 1, 1],
    },
    light: {
      key: '#fff5ea',
      side: '#f2f5ff',
      backRow: '#f2f5ff',
      rim: '#e6efff',
      beam: '#edf2ff',
      fill: { sky: '#2c2e31', ground: '#262629' },
      gain: 1,
      exposure: 0,
    },
  },
};

/** The styles, in the order of the menu, with their labels. */
export const STAGE_STYLE_OPTIONS: readonly (readonly [StageStyleId, string])[] = (
  ['classic', 'gala', 'midnight', 'festival', 'modern'] as const
).map((id) => [id, STAGE_STYLES[id].label]);
