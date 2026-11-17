/**
 * The settings of the stage dressing behind the stage (design 4.5, backdrop): the standing
 * banners, the hanging banners, the flags, and the screen. An image of a setting is an id: a
 * built-in country flag (`flag:<code>`) or an image of the user (`img:<uuid>`).
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

/** The flagpole groups. Each group carries all the flags. */
export interface FlagSettings {
  readonly on: boolean;
  /** The number of flagpole groups. */
  readonly groups: number;
  /** The order of the flags on the groups. */
  readonly arrangement: Arrangement;
  /** The flags of each group, from the left of the left groups. */
  readonly images: readonly string[];
}

/** The screen behind the orchestra. */
export interface ScreenSettings {
  readonly on: boolean;
  readonly material: ScreenMaterial;
  /**
   * The images of the screen. Before the first screen cue of a piece, the screen shows the first
   * image. The cues of the camera director change it.
   */
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

/** The text in the wood of the stage, near the conductor, as the logo of the stage top. */
export interface StageTextSettings {
  readonly on: boolean;
  /** One line of text. An empty text shows nothing. */
  readonly text: string;
  readonly place: StageTextPlace;
  readonly tone: StageTextTone;
  readonly font: StageTextFont;
}

/** All the stage dressing. */
export interface BackdropSettings {
  readonly standing: BannerSettings;
  readonly hanging: BannerSettings;
  readonly flags: FlagSettings;
  readonly screen: ScreenSettings;
  readonly text: StageTextSettings;
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
    groups: 2,
    arrangement: 'mirror',
    images: ['flag:id', 'flag:jp'],
  },
  screen: {
    on: true,
    material: 'led',
    images: ['flag:id', 'flag:jp', 'flag:gb', 'flag:fr'],
  },
  text: { on: false, text: '', place: 'floor', tone: 'light', font: 'serif' },
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
function isRecord(value: Json | undefined): value is JsonRecord {
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
 * @returns True for `flag:<code>` or `img:<id>`.
 */
export function isImageId(value: unknown): value is string {
  return isText(value) && /^(flag:[a-z]{2}|img:[\w-]{1,64})$/u.test(value);
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
    images: readImages(data['images'], fallback.images),
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
  const base = DEFAULT_BACKDROP;
  return {
    standing: readBanners(data['standing'], base.standing, BACKDROP_LIMITS.standing),
    hanging: readBanners(data['hanging'], base.hanging, BACKDROP_LIMITS.hanging),
    flags: {
      on: isBoolean(flags['on']) ? flags['on'] : base.flags.on,
      groups: readCount(flags['groups'], 1, BACKDROP_LIMITS.groups, base.flags.groups),
      arrangement: readOption(flags['arrangement'], ARRANGEMENTS, base.flags.arrangement),
      images: readImages(flags['images'], base.flags.images).slice(0, BACKDROP_LIMITS.flags),
    },
    screen: {
      on: isBoolean(screen['on']) ? screen['on'] : base.screen.on,
      material: readOption(screen['material'], SCREEN_MATERIALS, base.screen.material),
      images: readImages(screen['images'], base.screen.images),
    },
    text: {
      on: isBoolean(text['on']) ? text['on'] : base.text.on,
      text: isText(text['text']) ? cleanStageText(text['text']) : base.text.text,
      place: readOption(text['place'], STAGE_TEXT_PLACES, base.text.place),
      tone: readOption(text['tone'], STAGE_TEXT_TONES, base.text.tone),
      font: readOption(text['font'], STAGE_TEXT_FONTS, base.text.font),
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
    return { from: null, to: first, mix: 1 };
  }
  const before = index > 0 ? (cues[index - 1]?.image ?? first) : first;
  const mix = cue.cut ? 1 : Math.min(1, (songSec - cue.timeSec) / SCREEN_FADE_SEC);
  return { from: before, to: cue.image, mix };
}
