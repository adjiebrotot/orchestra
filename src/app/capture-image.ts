import type { FrameBox } from '../scene/letterbox.ts';
import { breakLines, drawTitleCard } from './render-titles.ts';
import type { RenderTitleFonts, RenderTitleLines } from './render-titles.ts';

/** An aspect of the still image of a capture (design 2.5, capture). */
export interface CaptureAspect {
  /** The name in the menu. */
  readonly label: string;
  /** The width part of the ratio. */
  readonly x: number;
  /** The height part of the ratio. */
  readonly y: number;
}

/** The aspects of the capture menu. 16:9 comes first, because it is the aspect of a thumbnail. */
export const CAPTURE_ASPECTS: readonly CaptureAspect[] = [
  { label: '16:9 (YouTube thumbnail)', x: 16, y: 9 },
  { label: '4:3', x: 4, y: 3 },
  { label: '1:1 (square)', x: 1, y: 1 },
  { label: '4:5 (Instagram feed)', x: 4, y: 5 },
  { label: '9:16 (Reels, Shorts)', x: 9, y: 16 },
  { label: '21:9 (cinema)', x: 21, y: 9 },
];

/**
 * The resolutions of the capture menu: the length of the short side of the image, in pixels. 720
 * gives the 1280 × 720 thumbnail of YouTube.
 */
export const CAPTURE_SHORT_SIDES: readonly number[] = [720, 1080, 1440, 2160];

/** The longest side of a capture, in pixels, so that each GPU can render it. */
const CAPTURE_MAX_SIDE = 4096;

/** The size of the still image of a capture, in pixels. */
export interface CaptureSize {
  readonly width: number;
  readonly height: number;
}

/**
 * Gives the size of a capture from its aspect and the length of its short side. The long side
 * stops at {@link CAPTURE_MAX_SIDE}, and the short side then shrinks to keep the aspect. Each side
 * is even, because some encoders of the apps that read the image need it.
 *
 * @param aspect The aspect.
 * @param shortSide The length of the short side, in pixels.
 * @returns The size.
 */
export function captureSize(aspect: CaptureAspect, shortSide: number): CaptureSize {
  const ratio = aspect.x / aspect.y;
  const long = Math.max(ratio, 1 / ratio);
  const short = Math.min(shortSide, CAPTURE_MAX_SIDE / long);
  const even = (value: number): number => 2 * Math.round(value / 2);
  return ratio >= 1
    ? { width: even(short * ratio), height: even(short) }
    : { width: even(short), height: even(short / ratio) };
}

/** The file types of a saved capture. */
export const CAPTURE_TYPES = [
  ['PNG', 'image/png', 'png'],
  ['JPEG', 'image/jpeg', 'jpg'],
  ['WebP', 'image/webp', 'webp'],
] as const;

/** The quality of a JPEG or a WebP file, from 0 to 1. */
export const CAPTURE_QUALITY = 0.92;

/** The font of a text of a capture: the serif of the title or the sans of the UI. */
export type CaptureFont = 'serif' | 'sans';

/** A text over the still image of a capture. */
export interface CaptureText {
  /** The text. A line break starts a new line. */
  text: string;
  /** The middle of the text, from the left edge, as a part of the width. */
  x: number;
  /** The middle of the text, from the top edge, as a part of the height. */
  y: number;
  /** The size of the letters, as a part of the short side of the image. */
  size: number;
  /** The color of the letters, as `#rrggbb`. */
  color: string;
  font: CaptureFont;
  bold: boolean;
  /** True to draw a dark outline around the letters, so they read over a bright stage. */
  outline: boolean;
}

/**
 * Creates the text of the button "Add text": large white letters with an outline, in the middle.
 *
 * @returns The text.
 */
export function newCaptureText(): CaptureText {
  return {
    text: 'Your text',
    x: 0.5,
    y: 0.5,
    size: 0.12,
    color: '#ffffff',
    font: 'sans',
    bold: true,
    outline: true,
  };
}

/** The values of the text of a capture (design 2.5, capture). */
export const CAPTURE_TEXT = {
  /** The line height, as a part of the size of the letters. */
  line: 1.12,
  /** The width of the outline, as a part of the size of the letters. */
  outline: 0.16,
  /** The color of the outline. */
  outlineColor: 'rgba(8, 6, 5, 0.92)',
  /** The widest line, as a part of the width of the image. */
  widthShare: 0.92,
} as const;

/** The image of a capture: the still of the stage, and the parts over it. */
export interface CaptureLayers {
  /** The still of the stage, at the size of the image. */
  readonly still: CanvasImageSource;
  /** The title card of the page (`drawTitleCard()`), or `null` for none. */
  readonly titleCard: RenderTitleLines | null;
  /**
   * The darkness of a shade from the bottom edge, from 0 (none) to 1, so a text over the stage
   * reads better.
   */
  readonly shade: number;
  readonly texts: readonly CaptureText[];
  readonly fonts: RenderTitleFonts;
}

/**
 * Gives the CSS font of a text of a capture.
 *
 * @param text The text.
 * @param px The size of the letters, in pixels.
 * @param fonts The font families.
 * @returns The font.
 */
function fontOf(text: CaptureText, px: number, fonts: RenderTitleFonts): string {
  return `${text.bold ? 800 : 400} ${px}px ${text.font === 'serif' ? fonts.serif : fonts.sans}`;
}

/**
 * Draws the image of a capture: the still, the shade, the title card, and each text. It gives the
 * box of each text, so a press on the preview can find the text under it.
 *
 * @param context The context, at the size of the image.
 * @param layers The parts of the image.
 * @returns The box of each text, in pixels of the image, in the order of `layers.texts`.
 */
export function drawCapture(context: CanvasRenderingContext2D, layers: CaptureLayers): FrameBox[] {
  const { width, height } = context.canvas;
  const unit = Math.min(width, height);
  context.save();
  context.drawImage(layers.still, 0, 0, width, height);
  if (layers.shade > 0) {
    const shade = context.createLinearGradient(0, height, 0, height * 0.35);
    shade.addColorStop(0, `rgba(0, 0, 0, ${0.85 * layers.shade})`);
    shade.addColorStop(1, 'rgba(0, 0, 0, 0)');
    context.fillStyle = shade;
    context.fillRect(0, 0, width, height);
  }
  if (layers.titleCard) {
    drawTitleCard(
      context,
      { x: width / 2, y: height / 2, width, height },
      layers.titleCard,
      1,
      layers.fonts,
    );
  }
  const boxes: FrameBox[] = [];
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.lineJoin = 'round';
  for (const text of layers.texts) {
    const px = Math.max(1, text.size * unit);
    context.font = fontOf(text, px, layers.fonts);
    const lines = text.text
      .split('\n')
      .flatMap((line) => breakLines(context, line, width * CAPTURE_TEXT.widthShare));
    const lineHeight = px * CAPTURE_TEXT.line;
    const boxWidth = Math.max(0, ...lines.map((line) => context.measureText(line).width));
    const boxHeight = lines.length * lineHeight;
    const x = text.x * width;
    const y = text.y * height;
    boxes.push({ x, y, width: boxWidth, height: boxHeight });
    let lineY = y - boxHeight / 2 + lineHeight / 2;
    for (const line of lines) {
      if (text.outline) {
        context.lineWidth = px * CAPTURE_TEXT.outline;
        context.strokeStyle = CAPTURE_TEXT.outlineColor;
        context.strokeText(line, x, lineY);
      }
      context.shadowColor = 'rgba(0, 0, 0, 0.5)';
      context.shadowBlur = px * 0.08;
      context.shadowOffsetY = px * 0.03;
      context.fillStyle = text.color;
      context.fillText(line, x, lineY);
      context.shadowColor = 'transparent';
      lineY += lineHeight;
    }
  }
  context.restore();
  return boxes;
}

/**
 * Gives the file name of a capture: the piece title in safe letters, the size, and the type.
 *
 * @param title The piece title.
 * @param size The size of the image.
 * @param extension The file extension.
 * @returns The file name.
 */
export function captureFileName(title: string, size: CaptureSize, extension: string): string {
  const base =
    title
      .normalize('NFKD')
      .replaceAll(/[^\w\s-]/gu, '')
      .trim()
      .replaceAll(/\s+/gu, '-')
      .toLowerCase()
      .slice(0, 60) || 'orchestra';
  return `${base}-${size.width}x${size.height}.${extension}`;
}
