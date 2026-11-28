import { LIGHT_RIG_OPTIONS } from './light-rigs.ts';
import type { LightRigId } from './light-rigs.ts';
import { STAGE_STYLE_OPTIONS } from './stage-style.ts';
import type { StageStyleId } from './stage-style.ts';

/**
 * The settings of the stage dressing behind the stage (design 4.5, backdrop): the standing
 * banners, the hanging banners, the flags, and the screen, and the props that carry an image: the
 * banner on the music stands and the logo on the choir folders. An image of a setting is an id: a
 * built-in country flag (`flag:<code>`), an image of the user (`img:<uuid>`), or a video of the
 * user (`vid:<uuid>`). Only the screen shows a video.
 */

/** The cut of the bottom edge of a banner, as the five banners of the reference image. */
export type BannerCut = 'point' | 'swallowtail' | 'straight' | 'curved' | 'round';

/** The cuts, in the order of the menu, with their labels. */
export const BANNER_CUTS: readonly (readonly [BannerCut, string])[] = [
  ['point', 'Pointed'],
  ['swallowtail', 'Swallowtail'],
  ['straight', 'Straight'],
  ['curved', 'Curved point'],
  ['round', 'Rounded'],
];

/**
 * The aspect ratios of a banner, as the height over the width, in the order of the menu. The
 * value 0 follows the image.
 */
export const BANNER_ASPECTS: readonly (readonly [number, string])[] = [
  [0, 'Follow the image'],
  [1.5, '1 : 1.5'],
  [2, '1 : 2'],
  [2.5, '1 : 2.5'],
  [3, '1 : 3'],
  [3.5, '1 : 3.5'],
  [4, '1 : 4'],
];

/**
 * The order of the images on a row of banners or on the flagpoles: symmetrical from the outside
 * in (ABCCBA), alternating (ABCABC), or grouped (AABBCC).
 */
export type Arrangement = 'mirror' | 'repeat' | 'group';

/** The arrangements, in the order of the menu, with their labels. */
export const ARRANGEMENTS: readonly (readonly [Arrangement, string])[] = [
  ['mirror', 'Symmetrical (ABCCBA)'],
  ['repeat', 'Alternating (ABCABC)'],
  ['group', 'Grouped (AABBCC)'],
];

/** The material of the screen: an LED wall that gives light, or a cloth with a projection. */
export type ScreenMaterial = 'led' | 'cloth';

/** The materials of the screen, in the order of the menu, with their labels. */
export const SCREEN_MATERIALS: readonly (readonly [ScreenMaterial, string])[] = [
  ['led', 'LED screen'],
  ['cloth', 'Cloth (projection)'],
];

/**
 * The aspect ratios of the screen, as the height over the width, in the order of the menu. The
 * value 0 follows the first image of the screen list.
 */
export const SCREEN_ASPECTS: readonly (readonly [number, string])[] = [
  [0, 'Follow the image'],
  [1, '1 : 1'],
  [3 / 4, '4 : 3'],
  [2 / 3, '3 : 2'],
  [9 / 16, '16 : 9'],
  [1 / 2, '2 : 1'],
  [9 / 21, '21 : 9'],
  [9 / 32, '32 : 9'],
  [4 / 3, '3 : 4'],
  [16 / 9, '9 : 16'],
];

/** One row of banners: standing banners on poles, or hanging banners on a batten. */
export interface BannerSettings {
  readonly on: boolean;
  /** The number of banners. */
  readonly count: number;
  readonly cut: BannerCut;
  /** The height over the width, or 0 to follow the image. */
  readonly aspect: number;
  /** The order of the images on the row. */
  readonly arrangement: Arrangement;
  /**
   * The images. In a symmetrical row, the two outer banners show the first image, the next two
   * the second, and so on. Else the images run from left to right.
   */
  readonly images: readonly string[];
}

/**
 * The stand of a group of flags: a row of upright metal poles on round bases, a row of upright
 * wooden poles on plinths, poles that fan out from one base on the floor, or a tall pole with
 * staffs in pairs.
 */
export type FlagStand = 'round' | 'floor' | 'fan' | 'group';

/** The stands, in the order of the menu, with their labels. */
export const FLAG_STANDS: readonly (readonly [FlagStand, string])[] = [
  ['round', 'Floor stands, round metal base'],
  ['floor', 'Floor stands, wooden plinth'],
  ['fan', 'Fan stand, one base'],
  ['group', 'Tall pole with staffs'],
];

/** The groups of flags. Each group carries all the flags. */
export interface FlagSettings {
  readonly on: boolean;
  readonly stand: FlagStand;
  /** The number of groups. */
  readonly groups: number;
  /** The order of the flags on the groups. */
  readonly arrangement: Arrangement;
  /**
   * How limp each flag hangs, from 0 to 1: 0 holds the cloth out from its staff, and 1 hangs it
   * as an indoor flag, straight down from the finial in deep pleats (`flagHang()` of
   * `backdrop.ts`).
   */
  readonly limpness: number;
  /** The flags of each group, from the left of the left groups. */
  readonly images: readonly string[];
}

/** The screen behind the orchestra. */
export interface ScreenSettings {
  readonly on: boolean;
  readonly material: ScreenMaterial;
  /**
   * The height over the width, or 0 to follow the first image of the list. An image of another
   * aspect fits inside the screen with dark bars.
   */
  readonly aspect: number;
  /**
   * The images of the screen. Before the first screen cue of a piece, the screen shows the first
   * image. The cues of the camera director change it.
   */
  readonly images: readonly string[];
}

/** The stands that carry a banner: the stand of the conductor, the stands of the players, or all. */
export type BannerTarget = 'conductor' | 'players' | 'all';

/** The stands that carry a banner, in the order of the menu, with their labels. */
export const BANNER_TARGETS: readonly (readonly [BannerTarget, string])[] = [
  ['conductor', 'Conductor stand'],
  ['players', 'Stands of the players'],
  ['all', 'All stands'],
];

/** The colors of the cloth of a stand banner, as sRGB, in the order of the menu. */
export const BANNER_CLOTHS: readonly (readonly [string, string])[] = [
  ['#b3141c', 'Red'],
  ['#6b1622', 'Maroon'],
  ['#1d2b5c', 'Navy'],
  ['#1f4d31', 'Green'],
  ['#1b1a1c', 'Black'],
  ['#efebe1', 'White'],
];

/** The fringe of a stand banner: none, or its color as sRGB, in the order of the menu. */
export const BANNER_FRINGES: readonly (readonly [string, string])[] = [
  ['#f1eee6', 'White fringe'],
  ['#d3ae4b', 'Gold fringe'],
  ['#c5c8cf', 'Silver fringe'],
  ['', 'No fringe'],
];

/** The cloth banner on the desks of the music stands (design 4.5, stand banner). */
export interface StandBannerSettings {
  readonly on: boolean;
  readonly target: BannerTarget;
  /** The color of the cloth, as sRGB. */
  readonly cloth: string;
  /** The color of the fringe, as sRGB, or an empty text for no fringe. */
  readonly fringe: string;
  /** The image in the middle of the banner: zero or one image id. */
  readonly images: readonly string[];
}

/** The covers of a choir folder that carry the logo. */
export type FolderCovers = 'front' | 'both';

/** The covers, in the order of the menu, with their labels. */
export const FOLDER_COVERS: readonly (readonly [FolderCovers, string])[] = [
  ['front', 'Front cover'],
  ['both', 'Both covers'],
];

/** The logo on the outer covers of the choir folders (design 4.5, folder logo). */
export interface FolderLogoSettings {
  readonly on: boolean;
  readonly covers: FolderCovers;
  /** The logo: zero or one image id. */
  readonly images: readonly string[];
}

/** The place of the stage text: the floor in front of the podium, or the front of the stage. */
export type StageTextPlace = 'floor' | 'front';

/** The places of the stage text, in the order of the menu, with their labels. */
export const STAGE_TEXT_PLACES: readonly (readonly [StageTextPlace, string])[] = [
  ['floor', 'Floor, in front of the podium'],
  ['front', 'Front of the stage'],
];

/** The wood of the letters of the stage text: a pale inlay, a dark stain, or a gold leaf. */
export type StageTextTone = 'light' | 'dark' | 'gold';

/** The tones of the stage text, in the order of the menu, with their labels. */
export const STAGE_TEXT_TONES: readonly (readonly [StageTextTone, string])[] = [
  ['light', 'Pale inlay'],
  ['dark', 'Dark stain'],
  ['gold', 'Gold leaf'],
];

/** The typeface of the stage text. */
export type StageTextFont = 'serif' | 'sans';

/** The typefaces of the stage text, in the order of the menu, with their labels. */
export const STAGE_TEXT_FONTS: readonly (readonly [StageTextFont, string])[] = [
  ['serif', 'Serif'],
  ['sans', 'Sans serif'],
];

/**
 * The size of the stage text (design 4.5, stage text): `fit` fills the floor in front of the
 * podium, and each larger size makes the letters taller by its factor
 * (`STAGE_TEXT.sizes` of `stage-text.ts`).
 */
export type StageTextSize = 'fit' | 'large' | 'larger' | 'largest';

/** The sizes of the stage text, in the order of the menu, with their labels. */
export const STAGE_TEXT_SIZES: readonly (readonly [StageTextSize, string])[] = [
  ['fit', 'Fit in front of the podium'],
  ['large', 'Large (1.6 ×)'],
  ['larger', 'Larger (2.4 ×)'],
  ['largest', 'Largest (3.2 ×)'],
];

/** The text in the wood of the stage, near the conductor, as the logo of the stage top. */
export interface StageTextSettings {
  readonly on: boolean;
  /** One line of text. An empty text shows nothing. */
  readonly text: string;
  readonly place: StageTextPlace;
  readonly tone: StageTextTone;
  readonly font: StageTextFont;
  readonly size: StageTextSize;
}

/**
 * The light factors of the user (design 4.5, light controls). Each value is a factor of the
 * value of the stage style: 1 keeps the look of the style.
 */
export interface LightFactors {
  /** The factor of the density of the room haze. 0 gives clear air. */
  readonly haze: number;
  /** The factor of the light of the visible beams in the haze. 0 hides the beams. */
  readonly beams: number;
  /** The factor of the exposure of the frame. */
  readonly brightness: number;
  /** The factor of the light of the screen. */
  readonly screen: number;
}

/**
 * The light controls of the user (design 4.5, light controls, light setups): the light setup, the
 * switch of the center light, and the light factors.
 */
export interface LightSettings extends LightFactors {
  /** The light setup: the angle of the key light and the gain of each kind of light. */
  readonly rig: LightRigId;
  /**
   * True to show the center light: the rim light behind the middle of the orchestra, with its
   * visible beam and its lamp. False turns off its light, and hides the beam and the lamp.
   */
  readonly center: boolean;
}

/** The limits of each light factor, as [smallest, largest]. */
export const LIGHT_LIMITS: Readonly<Record<keyof LightFactors, readonly [number, number]>> = {
  haze: [0, 2],
  beams: [0, 2],
  brightness: [0.5, 2],
  screen: [0.25, 2],
};

/** All the stage dressing. */
export interface BackdropSettings {
  /** The stage style: the look of the dressing and the colors of the stage lights. */
  readonly style: StageStyleId;
  readonly standing: BannerSettings;
  readonly hanging: BannerSettings;
  readonly flags: FlagSettings;
  readonly screen: ScreenSettings;
  readonly text: StageTextSettings;
  readonly stand: StandBannerSettings;
  readonly folder: FolderLogoSettings;
  readonly light: LightSettings;
}

/** The limits of the counts. */
export const BACKDROP_LIMITS = {
  standing: 12,
  hanging: 12,
  groups: 6,
  /** The most flags in one group. */
  flags: 6,
  /** The most images in one list. */
  images: 12,
  /** The most characters of the stage text. */
  text: 48,
} as const;

/** The settings of a new user: each object is on, with country flags. */
export const DEFAULT_BACKDROP: BackdropSettings = {
  style: 'classic',
  standing: {
    on: true,
    count: 4,
    cut: 'point',
    aspect: 0,
    arrangement: 'mirror',
    images: ['flag:id'],
  },
  hanging: {
    on: true,
    count: 6,
    cut: 'swallowtail',
    aspect: 0,
    arrangement: 'mirror',
    images: ['flag:id', 'flag:jp', 'flag:gb'],
  },
  flags: {
    on: true,
    stand: 'round',
    groups: 2,
    arrangement: 'mirror',
    limpness: 1,
    images: ['flag:id', 'flag:jp'],
  },
  screen: {
    on: true,
    material: 'led',
    aspect: 0,
    images: ['flag:id', 'flag:jp', 'flag:gb', 'flag:fr'],
  },
  text: {
    on: false,
    text: '',
    place: 'floor',
    tone: 'light',
    font: 'serif',
    size: 'fit',
  },
  stand: {
    on: false,
    target: 'conductor',
    cloth: '#b3141c',
    fringe: '#f1eee6',
    images: [],
  },
  folder: { on: false, covers: 'front', images: [] },
  light: { rig: 'concert', center: true, haze: 1, beams: 1, brightness: 1, screen: 1 },
};

/** A value of JSON text. */
export type Json = null | boolean | number | string | readonly Json[] | JsonRecord;

/** An object of JSON text. */
export interface JsonRecord {
  readonly [key: string]: Json | undefined;
}

/**
 * Tells if a value of JSON is an object.
 *
 * @param value A value of JSON.
 * @returns True for an object that is not a list.
 */
export function isRecord(value: Json | undefined): value is JsonRecord {
  return value !== null && value !== undefined && !Array.isArray(value) && Object(value) === value;
}

/**
 * Tells if a value is a text. The settings and the cues come from JSON text in the storage of
 * the browser or from a file, which is an I/O boundary.
 *
 * @param value A value.
 * @returns True for a text.
 */
export function isText(value: unknown): value is string {
  // oxlint-disable-next-line anti-slop/no-runtime-typeof -- stored JSON is an I/O boundary.
  return typeof value === 'string';
}

/**
 * Tells if a value is an image id.
 *
 * @param value A value of JSON.
 * @returns True for `flag:<code>`, `img:<id>`, or `vid:<id>`.
 */
export function isImageId(value: unknown): value is string {
  return isText(value) && /^(flag:[a-z]{2,5}|(img|vid):[\w-]{1,64})$/u.test(value);
}

/**
 * Tells if an image id is a video of the user.
 *
 * @param id An image id.
 * @returns True for `vid:<id>`.
 */
export function isVideoId(id: string): boolean {
  return id.startsWith('vid:');
}

/**
 * Tells if a value is a boolean.
 *
 * @param value A value of JSON.
 * @returns True for `true` or `false`.
 */
function isBoolean(value: Json | undefined): value is boolean {
  return value === true || value === false;
}

/**
 * Tells if a value is a finite number.
 *
 * @param value A value of JSON.
 * @returns True for a finite number.
 */
function isNumber(value: Json | undefined): value is number {
  return Number.isFinite(value);
}

/**
 * Reads a whole number in a range, or gives the fallback.
 *
 * @param value A value of JSON.
 * @param min The smallest value.
 * @param max The largest value.
 * @param fallback The value for a missing or a bad value.
 * @returns The number.
 */
function readCount(value: Json | undefined, min: number, max: number, fallback: number): number {
  return isNumber(value) ? Math.min(max, Math.max(min, Math.round(value))) : fallback;
}

/**
 * Reads a share from 0 to 1, or gives the fallback.
 *
 * @param value A value of JSON.
 * @param fallback The value for a missing or a bad value.
 * @returns The share.
 */
function readShare(value: Json | undefined, fallback: number): number {
  return isNumber(value) ? Math.min(1, Math.max(0, value)) : fallback;
}

/**
 * Reads a list of image ids, or gives the fallback.
 *
 * @param value A value of JSON.
 * @param fallback The list for a missing value.
 * @returns The ids, with no bad entry.
 */
function readImages(value: Json | undefined, fallback: readonly string[]): readonly string[] {
  if (!Array.isArray(value)) {
    return fallback;
  }
  return value.filter(isImageId).slice(0, BACKDROP_LIMITS.images);
}

/**
 * Reads a value of a menu, or gives the fallback.
 *
 * @param value A value of JSON.
 * @param options The menu.
 * @param fallback The value for a missing or a bad value.
 * @returns The value.
 */
function readOption<T>(
  value: Json | undefined,
  options: readonly (readonly [T, string])[],
  fallback: T,
): T {
  return options.find(([option]) => option === value)?.[0] ?? fallback;
}

/**
 * Reads the settings of a row of banners.
 *
 * @param value A value of JSON.
 * @param fallback The defaults of the row.
 * @param max The most banners.
 * @returns The settings.
 */
function readBanners(
  value: Json | undefined,
  fallback: BannerSettings,
  max: number,
): BannerSettings {
  const data = isRecord(value) ? value : {};
  return {
    on: isBoolean(data['on']) ? data['on'] : fallback.on,
    count: readCount(data['count'], 1, max, fallback.count),
    cut: readOption(data['cut'], BANNER_CUTS, fallback.cut),
    aspect: readOption(data['aspect'], BANNER_ASPECTS, fallback.aspect),
    arrangement: readOption(data['arrangement'], ARRANGEMENTS, fallback.arrangement),
    images: readImages(data['images'], fallback.images).filter((id) => !isVideoId(id)),
  };
}

/**
 * Reads the settings of the stage dressing from JSON. A missing or a bad value takes its
 * default, so the settings of an older page still load.
 *
 * @param value A value of JSON.
 * @returns The settings.
 */
export function readBackdrop(value: Json | undefined): BackdropSettings {
  const data = isRecord(value) ? value : {};
  const flags = isRecord(data['flags']) ? data['flags'] : {};
  const screen = isRecord(data['screen']) ? data['screen'] : {};
  const text = isRecord(data['text']) ? data['text'] : {};
  const stand = isRecord(data['stand']) ? data['stand'] : {};
  const folder = isRecord(data['folder']) ? data['folder'] : {};
  const light = isRecord(data['light']) ? data['light'] : {};
  const base = DEFAULT_BACKDROP;
  /** Reads one light factor in its limits. */
  const factor = (key: keyof LightFactors): number => {
    const given = light[key];
    const [min, max] = LIGHT_LIMITS[key];
    return isNumber(given) ? Math.min(max, Math.max(min, given)) : base.light[key];
  };
  /** Reads the one still image of a prop: a video stays out. */
  const propImage = (list: Json | undefined): readonly string[] =>
    readImages(list, [])
      .filter((id) => !isVideoId(id))
      .slice(0, 1);
  return {
    style: readOption(data['style'], STAGE_STYLE_OPTIONS, base.style),
    standing: readBanners(data['standing'], base.standing, BACKDROP_LIMITS.standing),
    hanging: readBanners(data['hanging'], base.hanging, BACKDROP_LIMITS.hanging),
    flags: {
      on: isBoolean(flags['on']) ? flags['on'] : base.flags.on,
      stand: readOption(flags['stand'], FLAG_STANDS, base.flags.stand),
      groups: readCount(flags['groups'], 1, BACKDROP_LIMITS.groups, base.flags.groups),
      arrangement: readOption(flags['arrangement'], ARRANGEMENTS, base.flags.arrangement),
      limpness: readShare(flags['limpness'], base.flags.limpness),
      images: readImages(flags['images'], base.flags.images)
        .filter((id) => !isVideoId(id))
        .slice(0, BACKDROP_LIMITS.flags),
    },
    screen: {
      on: isBoolean(screen['on']) ? screen['on'] : base.screen.on,
      material: readOption(screen['material'], SCREEN_MATERIALS, base.screen.material),
      aspect: readOption(screen['aspect'], SCREEN_ASPECTS, base.screen.aspect),
      images: readImages(screen['images'], base.screen.images),
    },
    text: {
      on: isBoolean(text['on']) ? text['on'] : base.text.on,
      text: isText(text['text']) ? cleanStageText(text['text']) : base.text.text,
      place: readOption(text['place'], STAGE_TEXT_PLACES, base.text.place),
      tone: readOption(text['tone'], STAGE_TEXT_TONES, base.text.tone),
      font: readOption(text['font'], STAGE_TEXT_FONTS, base.text.font),
      size: readOption(text['size'], STAGE_TEXT_SIZES, base.text.size),
    },
    stand: {
      on: isBoolean(stand['on']) ? stand['on'] : base.stand.on,
      target: readOption(stand['target'], BANNER_TARGETS, base.stand.target),
      cloth: readOption(stand['cloth'], BANNER_CLOTHS, base.stand.cloth),
      fringe: readOption(stand['fringe'], BANNER_FRINGES, base.stand.fringe),
      images: propImage(stand['images']),
    },
    folder: {
      on: isBoolean(folder['on']) ? folder['on'] : base.folder.on,
      covers: readOption(folder['covers'], FOLDER_COVERS, base.folder.covers),
      images: propImage(folder['images']),
    },
    light: {
      rig: readOption(light['rig'], LIGHT_RIG_OPTIONS, base.light.rig),
      center: isBoolean(light['center']) ? light['center'] : base.light.center,
      haze: factor('haze'),
      beams: factor('beams'),
      brightness: factor('brightness'),
      screen: factor('screen'),
    },
  };
}

/**
 * Cleans a stage text: one line, with no control characters, and at most
 * `BACKDROP_LIMITS.text` characters.
 *
 * @param text The text of the user.
 * @returns The clean text.
 */
export function cleanStageText(text: string): string {
  return [...text.replaceAll(/\p{Cc}+/gu, ' ')].slice(0, BACKDROP_LIMITS.text).join('');
}

/** One cue of the screen: from its time until the next cue, the screen shows its image. */
export interface ScreenCue {
  /** Song seconds. */
  readonly timeSec: number;
  /** The image id. */
  readonly image: string;
  /** True for a hard cut to the image, false for a fade from the image before it. */
  readonly cut: boolean;
}

/**
 * Tells if a value is a screen cue.
 *
 * @param value A value of JSON.
 * @returns True for a cue.
 */
export function isScreenCue(value: Json | undefined): value is ScreenCue & JsonRecord {
  return (
    isRecord(value) &&
    isNumber(value['timeSec']) &&
    isImageId(value['image']) &&
    isBoolean(value['cut'])
  );
}

/** The time of a fade between two screen images, in song seconds. */
export const SCREEN_FADE_SEC = 0.8;

/** The images that the screen shows at a time: a mix from one image to the next. */
export interface ScreenFrame {
  /** The image before the fade, or `null` for none. */
  readonly from: string | null;
  /** The image after the fade, or `null` for a dark screen. */
  readonly to: string | null;
  /** The share of `to`, from 0 to 1. */
  readonly mix: number;
  /** The song time at which `from` came on the screen, for the time of a video. */
  readonly fromSince: number;
  /** The song time at which `to` came on the screen, for the time of a video. */
  readonly toSince: number;
}

/**
 * Gives the images of the screen at a song time (design 4.5, backdrop). Before the first cue, the
 * screen shows the first image of its list. A cue fades from the image before it over
 * {@link SCREEN_FADE_SEC}, or cuts.
 *
 * @param cues The screen cues, sorted by time.
 * @param first The image before the first cue, or `null` for a dark screen.
 * @param songSec The song time.
 * @returns The images and their mix.
 */
export function screenFrame(
  cues: readonly ScreenCue[],
  first: string | null,
  songSec: number,
): ScreenFrame {
  let index = -1;
  for (const [i, cue] of cues.entries()) {
    if (cue.timeSec <= songSec) {
      index = i;
    }
  }
  const cue = cues[index];
  if (!cue) {
    return { from: null, to: first, mix: 1, fromSince: 0, toSince: 0 };
  }
  const previous = index > 0 ? cues[index - 1] : undefined;
  const before = previous?.image ?? first;
  const mix = cue.cut ? 1 : Math.min(1, (songSec - cue.timeSec) / SCREEN_FADE_SEC);
  return {
    from: before,
    to: cue.image,
    mix,
    fromSince: previous?.timeSec ?? 0,
    toSince: cue.timeSec,
  };
}
