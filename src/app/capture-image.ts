import type { FrameBox } from '../scene/letterbox.ts';
import { breakLines, drawTitleCard } from './render-titles.ts';
import type { RenderTitleFonts, RenderTitleLines } from './render-titles.ts';
import { stickerImage } from './capture-stickers.ts';
import type { StickerArt, StickerCut } from './capture-stickers.ts';
import { drawStyledLines, styleSpacing, stylePad, stylePreset } from './capture-text-styles.ts';
import type { CaptureFont, CaptureTextStyle } from './capture-text-styles.ts';

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

/** A text over the still image of a capture. */
export interface CaptureText {
  readonly kind: 'text';
  /** The text. A line break starts a new line. */
  text: string;
  /** The middle of the text, from the left edge, as a part of the width. */
  x: number;
  /** The middle of the text, from the top edge, as a part of the height. */
  y: number;
  /** The size of the letters, as a part of the short side of the image. */
  size: number;
  /** The turn of the text, in degrees, clockwise. */
  turn: number;
  /** The look of the text (`CAPTURE_STYLES`). */
  style: CaptureTextStyle;
  /** The main color of the letters, as `#rrggbb`. */
  color: string;
  /** The second color of the look (an outline, a box, a glow), as `#rrggbb`. */
  accent: string;
  font: CaptureFont;
  bold: boolean;
  /** True to write the text in capitals. */
  upper: boolean;
}

/** A flag sticker over the still image of a capture. */
export interface CaptureSticker extends StickerArt {
  readonly kind: 'flag';
  code: string;
  cut: StickerCut;
  border: boolean;
  /** The middle of the sticker, from the left edge, as a part of the width. */
  x: number;
  /** The middle of the sticker, from the top edge, as a part of the height. */
  y: number;
  /** The height of the flag, as a part of the short side of the image. */
  size: number;
  /** The turn of the sticker, in degrees, clockwise. */
  turn: number;
}

/** A part over the still image of a capture: a text or a flag sticker. */
export type CaptureItem = CaptureText | CaptureSticker;

/**
 * Puts the values of a look on a text: its colors, its font, its weight, and the capitals.
 *
 * @param text The text. The function changes it in place.
 * @param style The look.
 */
export function applyStyle(text: CaptureText, style: CaptureTextStyle): void {
  const preset = stylePreset(style);
  text.style = style;
  text.color = preset.color;
  text.accent = preset.accent;
  text.font = preset.font;
  text.bold = preset.bold;
  text.upper = preset.upper;
}

/**
 * Creates the text of the button "Add text": large letters in a look, in the middle.
 *
 * @param style The look.
 * @param value The text.
 * @returns The text.
 */
export function newCaptureText(
  style: CaptureTextStyle = 'classic',
  value = 'Your text',
): CaptureText {
  const text: CaptureText = {
    kind: 'text',
    text: value,
    x: 0.5,
    y: 0.5,
    size: 0.12,
    turn: 0,
    style,
    color: '#ffffff',
    accent: '#000000',
    font: 'sans',
    bold: true,
    upper: false,
  };
  applyStyle(text, style);
  return text;
}

/**
 * Creates a flag sticker: a tilted rectangle with a white border, at the top right.
 *
 * @param code The code of the flag.
 * @returns The sticker.
 */
export function newCaptureSticker(code: string): CaptureSticker {
  return {
    kind: 'flag',
    code,
    cut: 'rect',
    border: true,
    x: 0.82,
    y: 0.22,
    size: 0.2,
    turn: -8,
  };
}

/** The values of the text of a capture (design 2.5, capture). */
export const CAPTURE_TEXT = {
  /** The line height, as a part of the size of the letters. */
  line: 1.12,
  /** The widest line, as a part of the width of the image. */
  widthShare: 0.92,
} as const;

/** The box of a part of a capture, in pixels of the image, with its turn. */
export interface CaptureBox extends FrameBox {
  /** The turn of the box around its middle, in radians, clockwise. */
  readonly angle: number;
}

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
  /** The texts and the stickers, from the back to the front. */
  readonly items: readonly CaptureItem[];
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
 * Draws a text of a capture in its look.
 *
 * @param context The context, at the size of the image.
 * @param text The text.
 * @param fonts The font families.
 * @returns The box of the text.
 */
function drawText(
  context: CanvasRenderingContext2D,
  text: CaptureText,
  fonts: RenderTitleFonts,
): CaptureBox {
  const { width, height } = context.canvas;
  const px = Math.max(1, text.size * Math.min(width, height));
  context.font = fontOf(text, px, fonts);
  context.letterSpacing = `${px * styleSpacing(text.style)}px`;
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  const value = text.upper ? text.text.toLocaleUpperCase() : text.text;
  const words = value
    .split('\n')
    .flatMap((line) => breakLines(context, line, width * CAPTURE_TEXT.widthShare));
  const lineHeight = px * CAPTURE_TEXT.line;
  const boxHeight = words.length * lineHeight;
  const lines = words.map((line, i) => ({
    text: line,
    width: context.measureText(line).width,
    y: -boxHeight / 2 + lineHeight * (i + 0.5),
  }));
  const pad = px * stylePad(text.style);
  const box: CaptureBox = {
    x: text.x * width,
    y: text.y * height,
    width: Math.max(0, ...lines.map((line) => line.width)) + 2 * pad,
    height: boxHeight + 2 * pad,
    angle: (text.turn * Math.PI) / 180,
  };
  context.save();
  context.translate(box.x, box.y);
  context.rotate(box.angle);
  drawStyledLines(context, text, lines, px);
  context.restore();
  context.letterSpacing = '0px';
  return box;
}

/**
 * Draws a flag sticker of a capture, with a soft shadow below it.
 *
 * @param context The context, at the size of the image.
 * @param sticker The sticker.
 * @returns The box of the sticker.
 */
function drawSticker(context: CanvasRenderingContext2D, sticker: CaptureSticker): CaptureBox {
  const { width, height } = context.canvas;
  const px = Math.max(4, sticker.size * Math.min(width, height));
  const image = stickerImage(sticker, px);
  const box: CaptureBox = {
    x: sticker.x * width,
    y: sticker.y * height,
    width: image.width,
    height: image.height,
    angle: (sticker.turn * Math.PI) / 180,
  };
  context.save();
  context.translate(box.x, box.y);
  context.rotate(box.angle);
  context.shadowColor = 'rgba(0, 0, 0, 0.45)';
  context.shadowBlur = px * 0.1;
  context.shadowOffsetY = px * 0.04;
  context.drawImage(image, -image.width / 2, -image.height / 2);
  context.restore();
  return box;
}

/**
 * Draws the image of a capture: the still, the shade, the title card, and each text and sticker.
 * It gives the box of each part, so a press on the preview can find the part under it.
 *
 * @param context The context, at the size of the image.
 * @param layers The parts of the image.
 * @returns The box of each part, in pixels of the image, in the order of `layers.items`.
 */
export function drawCapture(
  context: CanvasRenderingContext2D,
  layers: CaptureLayers,
): CaptureBox[] {
  const { width, height } = context.canvas;
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
  const boxes = layers.items.map((item) =>
    item.kind === 'text' ? drawText(context, item, layers.fonts) : drawSticker(context, item),
  );
  context.restore();
  return boxes;
}

/**
 * Tells if a point is inside a turned box, with a margin.
 *
 * @param box The box.
 * @param x The x of the point.
 * @param y The y of the point.
 * @param pad The margin at each side.
 * @returns True when the point is inside.
 */
export function boxHolds(box: CaptureBox, x: number, y: number, pad: number): boolean {
  const dx = x - box.x;
  const dy = y - box.y;
  const cos = Math.cos(-box.angle);
  const sin = Math.sin(-box.angle);
  const u = dx * cos - dy * sin;
  const v = dx * sin + dy * cos;
  return Math.abs(u) <= box.width / 2 + pad && Math.abs(v) <= box.height / 2 + pad;
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
