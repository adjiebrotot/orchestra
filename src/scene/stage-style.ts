/**
 * The stage styles (design 4.5, stage style): each style sets the look of the stage itself (the
 * boards, the edge, the skirt, the podium, and the finish), the stage dressing (the poles, the
 * rods, the batten, the cloth, and the screen), and the colors of the stage lights. The style
 * "Classic hall" keeps the values of `BACKDROP`, of `scene/lights.ts`, and of `scene/stage.ts`.
 */

import { srgb } from '../models/mesh.ts';
import type { StageColors } from '../models/stage.ts';
import { CLASSIC_LOOK, STAGE_FINISH } from './stage.ts';
import type { StageLook } from './stage.ts';

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

/** One stage style: its label, the look of the stage and the dressing, and the lights. */
export interface StageStyle {
  readonly label: string;
  readonly stage: StageLook;
  readonly dressing: DressingStyle;
  readonly light: LightStyle;
}

/**
 * Gives the linear colors of the stage parts from sRGB colors.
 *
 * @param hex The sRGB colors.
 * @returns The linear colors.
 */
function stageColors(hex: Readonly<Record<keyof StageColors, string>>): StageColors {
  return {
    plank: srgb(hex.plank),
    seam: srgb(hex.seam),
    nosing: srgb(hex.nosing),
    skirt: srgb(hex.skirt),
    groove: srgb(hex.groove),
    podium: srgb(hex.podium),
    podiumPanel: srgb(hex.podiumPanel),
    podiumTop: srgb(hex.podiumTop),
    podiumTopPanel: srgb(hex.podiumTopPanel),
  };
}

/**
 * Royal gala: a basket weave of mahogany parquet under a high lacquer, a gilded molded edge, and a
 * crimson skirt.
 */
const GALA_STAGE: StageLook = {
  build: {
    colors: stageColors({
      plank: '#7c3519',
      seam: '#4a1c0a',
      nosing: '#b08a3a',
      skirt: '#4c1418',
      groove: '#2a080b',
      podium: '#5c2216',
      podiumPanel: '#481810',
      podiumTop: '#a8823a',
      podiumTopPanel: '#6e2c16',
    }),
    floor: 'parquet',
    plankWidth: 0.15,
    plankLength: { min: 0.6, extra: 0 },
    plankTone: 0.14,
    edge: 'molded',
    skirt: { panel: 0.8, groove: 0.05 },
  },
  finish: {
    ...STAGE_FINISH,
    roughness: 0.45,
    grain: 0.12,
    clearcoat: 0.38,
    clearcoatRoughness: 0.22,
    sideGlow: 0.9,
  },
};

/**
 * Midnight blue: narrow planks of a dark blue stain under a glossy lacquer, a low bevel of silver,
 * and a dark blue skirt.
 */
const MIDNIGHT_STAGE: StageLook = {
  build: {
    colors: stageColors({
      plank: '#3c4458',
      seam: '#1c2230',
      nosing: '#9aa6bc',
      skirt: '#141c2e',
      groove: '#090e1a',
      podium: '#28324a',
      podiumPanel: '#1c2438',
      podiumTop: '#566484',
      podiumTopPanel: '#3a4560',
    }),
    floor: 'planks',
    plankWidth: 0.1,
    plankLength: { min: 1.4, extra: 1.6 },
    plankTone: 0.12,
    edge: 'chamfer',
    skirt: { panel: 0.3, groove: 0.02 },
  },
  finish: {
    ...STAGE_FINISH,
    roughness: 0.32,
    grain: 0.1,
    specular: 0.6,
    clearcoat: 0.3,
    clearcoatRoughness: 0.26,
    sideGlow: 1,
  },
};

/**
 * Festival: a grid of black stage decks of 1.2 m with a matte paint, an aluminium trim on a square
 * edge, and a plain black skirt.
 */
const FESTIVAL_STAGE: StageLook = {
  build: {
    colors: stageColors({
      plank: '#26262b',
      seam: '#0b0b0d',
      nosing: '#a4a6ae',
      skirt: '#141417',
      groove: '#0a0a0c',
      podium: '#1c1c20',
      podiumPanel: '#2a2a30',
      podiumTop: '#34343a',
      podiumTopPanel: '#1e1e22',
    }),
    floor: 'deck',
    plankWidth: 1.2,
    plankLength: { min: 1.2, extra: 0 },
    plankTone: 0.05,
    edge: 'square',
    skirt: null,
  },
  finish: {
    ...STAGE_FINISH,
    roughness: 0.72,
    grain: 0.03,
    grainRoughness: 0.05,
    specular: 0.5,
    plankRoughness: 0.08,
    plankGloss: 0.3,
    clearcoat: 0.06,
    clearcoatRoughness: 0.5,
    sideGlow: 1.2,
  },
};

/**
 * Modern white: wide planks of pale ash with a matte oil, a square edge, a white skirt with no
 * panels, and a white podium.
 */
const MODERN_STAGE: StageLook = {
  build: {
    colors: stageColors({
      plank: '#a88c68',
      seam: '#6e5a40',
      nosing: '#dcdad6',
      skirt: '#cfcfcc',
      groove: '#a8a8a5',
      podium: '#d6d6d3',
      podiumPanel: '#c4c4c1',
      podiumTop: '#b09470',
      podiumTopPanel: '#9e8460',
    }),
    floor: 'planks',
    plankWidth: 0.2,
    plankLength: { min: 1.8, extra: 1.8 },
    plankTone: 0.1,
    edge: 'square',
    skirt: null,
  },
  finish: {
    ...STAGE_FINISH,
    roughness: 0.72,
    grain: 0.1,
    specular: 0.3,
    clearcoat: 0.04,
    clearcoatRoughness: 0.5,
    sideGlow: 0.35,
  },
};

/**
 * The stage styles, in the order of the menu. "Classic hall" has the values of `BACKDROP` and of
 * the lights of `scene/lights.ts`.
 */
export const STAGE_STYLES: Readonly<Record<StageStyleId, StageStyle>> = {
  classic: {
    label: 'Classic hall: walnut planks, warm amber light, chrome poles',
    stage: CLASSIC_LOOK,
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
    label: 'Royal gala: mahogany parquet, gilded edge, gold poles, golden light',
    stage: GALA_STAGE,
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
    label: 'Midnight blue: blue-stained planks, silver poles, cool moonlight',
    stage: MIDNIGHT_STAGE,
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
    label: 'Festival: black stage decks, black truss, magenta and cyan wash',
    stage: FESTIVAL_STAGE,
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
    label: 'Modern white: pale ash planks, white skirt and poles, daylight',
    stage: MODERN_STAGE,
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
