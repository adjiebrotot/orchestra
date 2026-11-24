import { FLAG_ASPECT, drawFlag, flagArtReady } from '../scene/country-flags.ts';

/**
 * The flag stickers of a capture (design 2.5, capture): a country flag cut to a form, with an
 * optional white die-cut border, as a sticker on a thumbnail.
 */

/** The cut of a flag sticker. */
export type StickerCut = 'rect' | 'wave' | 'round' | 'heart';

/** The cuts of the menu "Cut", in the order of the menu. */
export const STICKER_CUTS: readonly (readonly [StickerCut, string])[] = [
  ['rect', 'Rectangle'],
  ['wave', 'Waving'],
  ['round', 'Round badge'],
  ['heart', 'Heart'],
];

/** The values of a flag sticker that the drawing reads. */
export interface StickerArt {
  /** The code of the flag (`COUNTRY_FLAGS`). */
  readonly code: string;
  readonly cut: StickerCut;
  /** True to draw a white die-cut border around the sticker. */
  readonly border: boolean;
}

/** The width of the border, as a part of the height of the sticker. */
const BORDER_SHARE = 0.07;

/** The most images that the cache keeps. */
const CACHE_LIMIT = 24;

/** The drawn stickers, by their values and their size, so a drag draws no flag again. */
const CACHE = new Map<string, HTMLCanvasElement>();

/**
 * Gives the width over the height of a sticker of a cut, with no border.
 *
 * @param cut The cut.
 * @returns The aspect.
 */
export function stickerAspect(cut: StickerCut): number {
  if (cut === 'round') {
    return 1;
  }
  return cut === 'heart' ? 1.1 : 1 / FLAG_ASPECT;
}

/**
 * Adds the path of a heart in the box (0, 0)–(w, h).
 *
 * @param context The context.
 * @param w The width.
 * @param h The height.
 */
function heartPath(context: CanvasRenderingContext2D, w: number, h: number): void {
  context.beginPath();
  context.moveTo(w / 2, h * 0.98);
  context.bezierCurveTo(w * 0.1, h * 0.68, -w * 0.02, h * 0.34, w * 0.14, h * 0.13);
  context.bezierCurveTo(w * 0.28, -h * 0.04, w * 0.46, h * 0.04, w / 2, h * 0.22);
  context.bezierCurveTo(w * 0.54, h * 0.04, w * 0.72, -h * 0.04, w * 0.86, h * 0.13);
  context.bezierCurveTo(w * 1.02, h * 0.34, w * 0.9, h * 0.68, w / 2, h * 0.98);
  context.closePath();
}

/**
 * Draws the flag of a sticker in its cut, with no border, on a new canvas.
 *
 * @param art The sticker.
 * @param height The height of the flag part, in pixels.
 * @returns The canvas, with a margin for the wave.
 */
function cutFlag(art: StickerArt, height: number): HTMLCanvasElement {
  const width = Math.round(height * stickerAspect(art.cut));
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');

  if (art.cut === 'wave') {
    const flagWidth = Math.round(height / FLAG_ASPECT);
    const amp = height * 0.07;
    canvas.width = flagWidth;
    canvas.height = Math.round(height + 2 * amp);
    const flag = drawFlag(art.code, flagWidth, height, false);
    if (!context) {
      return canvas;
    }
    const slice = Math.max(1, Math.round(flagWidth / 160));
    for (let x = 0; x < flagWidth; x += slice) {
      const t = x / flagWidth;
      const phase = t * Math.PI * 2.4 - 0.6;
      // The hoist stays still, and the fly waves more.
      const dy = amp * Math.sin(phase) * (0.25 + 0.75 * t);
      context.drawImage(flag, x, 0, slice, height, x, amp + dy, slice + 1, height);
      const light = Math.cos(phase) * (0.25 + 0.75 * t);
      context.fillStyle =
        light > 0 ? `rgba(255, 255, 255, ${0.28 * light})` : `rgba(0, 0, 0, ${-0.32 * light})`;
      context.globalCompositeOperation = 'source-atop';
      context.fillRect(x, 0, slice + 1, canvas.height);
      context.globalCompositeOperation = 'source-over';
    }
    return canvas;
  }

  canvas.width = Math.max(1, width);
  canvas.height = Math.max(1, Math.round(height));
  if (!context) {
    return canvas;
  }
  // A square or a heart takes the middle of the flag, so the emblem stays in it.
  const flagWidth = Math.max(width, Math.round(height / FLAG_ASPECT));
  const flag = drawFlag(art.code, flagWidth, height, false);
  context.save();
  if (art.cut === 'round') {
    context.beginPath();
    context.arc(width / 2, height / 2, Math.min(width, height) / 2, 0, Math.PI * 2);
    context.clip();
  } else if (art.cut === 'heart') {
    heartPath(context, width, height);
    context.clip();
  } else {
    context.beginPath();
    context.roundRect(0, 0, width, height, height * 0.04);
    context.clip();
  }
  context.drawImage(flag, (width - flagWidth) / 2, 0);
  // A soft gloss from the top left, as a printed sticker.
  const gloss = context.createLinearGradient(0, 0, width, height);
  gloss.addColorStop(0, 'rgba(255, 255, 255, 0.22)');
  gloss.addColorStop(0.5, 'rgba(255, 255, 255, 0)');
  gloss.addColorStop(1, 'rgba(0, 0, 0, 0.12)');
  context.fillStyle = gloss;
  context.fillRect(0, 0, width, height);
  if (art.cut === 'round') {
    context.lineWidth = height * 0.03;
    context.strokeStyle = 'rgba(0, 0, 0, 0.18)';
    context.beginPath();
    context.arc(width / 2, height / 2, height / 2 - context.lineWidth / 2, 0, Math.PI * 2);
    context.stroke();
  }
  context.restore();
  return canvas;
}

/**
 * Draws a sticker at a height, with its border, on a canvas. The cache keeps the canvas, so the
 * next call with the same values gives it again.
 *
 * @param art The sticker.
 * @param height The height of the flag part, in pixels.
 * @returns The canvas. The flag part is in the middle.
 */
export function stickerImage(art: StickerArt, height: number): HTMLCanvasElement {
  const px = Math.max(4, Math.round(height));
  const key = `${art.code}|${art.cut}|${art.border}|${px}|${flagArtReady(art.code)}`;
  const cached = CACHE.get(key);
  if (cached) {
    return cached;
  }

  const flag = cutFlag(art, px);
  const border = art.border ? Math.round(px * BORDER_SHARE) : 0;
  const canvas = document.createElement('canvas');
  canvas.width = flag.width + 2 * border;
  canvas.height = flag.height + 2 * border;
  const context = canvas.getContext('2d');
  if (context && border > 0) {
    // The border: the white form of the flag, drawn at many points of a circle around it.
    const white = document.createElement('canvas');
    white.width = flag.width;
    white.height = flag.height;
    const whiteContext = white.getContext('2d');
    if (whiteContext) {
      whiteContext.drawImage(flag, 0, 0);
      whiteContext.globalCompositeOperation = 'source-in';
      whiteContext.fillStyle = '#ffffff';
      whiteContext.fillRect(0, 0, white.width, white.height);
      const steps = 24;
      for (let i = 0; i < steps; i++) {
        const a = (i / steps) * Math.PI * 2;
        context.drawImage(white, border + Math.cos(a) * border, border + Math.sin(a) * border);
      }
      context.drawImage(white, border, border);
    }
  }
  context?.drawImage(flag, border, border);

  CACHE.set(key, canvas);
  if (CACHE.size > CACHE_LIMIT) {
    const oldest = CACHE.keys().next().value;
    if (oldest !== undefined) {
      CACHE.delete(oldest);
    }
  }
  return canvas;
}
