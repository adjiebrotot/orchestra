/**
 * The looks of a text of a capture (design 2.5, capture): a thumbnail needs a title that stands
 * out, and one look for each title tires the viewer. Each look draws the lines of a text with a
 * main color and a second color, at the origin of a context that the caller moves and turns.
 */

/** The look of a text of a capture. */
export type CaptureTextStyle =
  | 'classic'
  | 'punch'
  | 'block'
  | 'neon'
  | 'label'
  | 'marker'
  | 'metal'
  | 'cinema'
  | 'plain';

/** The font of a text of a capture: the serif of the title or the sans of the UI. */
export type CaptureFont = 'serif' | 'sans';

/** The values that a look puts on a text when the user chooses it. */
export interface CaptureStylePreset {
  readonly style: CaptureTextStyle;
  /** The name in the menu. */
  readonly label: string;
  /** What the second color does, for the label of its control. */
  readonly accentRole: string;
  readonly color: string;
  readonly accent: string;
  readonly font: CaptureFont;
  readonly bold: boolean;
  readonly upper: boolean;
}

/** The looks of the menu "Style", in the order of the menu. */
export const CAPTURE_STYLES: readonly CaptureStylePreset[] = [
  {
    style: 'classic',
    label: 'Classic outline',
    accentRole: 'Outline',
    color: '#ffffff',
    accent: '#0a0806',
    font: 'sans',
    bold: true,
    upper: false,
  },
  {
    style: 'punch',
    label: 'Comic punch',
    accentRole: 'Ring',
    color: '#ffde3b',
    accent: '#d7263d',
    font: 'sans',
    bold: true,
    upper: true,
  },
  {
    style: 'block',
    label: '3D block',
    accentRole: 'Depth',
    color: '#ffffff',
    accent: '#e4572e',
    font: 'sans',
    bold: true,
    upper: true,
  },
  {
    style: 'neon',
    label: 'Neon glow',
    accentRole: 'Glow',
    color: '#ff5ad8',
    accent: '#7a2cff',
    font: 'sans',
    bold: true,
    upper: false,
  },
  {
    style: 'label',
    label: 'Label box',
    accentRole: 'Box',
    color: '#ffffff',
    accent: '#d7263d',
    font: 'sans',
    bold: true,
    upper: true,
  },
  {
    style: 'marker',
    label: 'Highlighter',
    accentRole: 'Marker',
    color: '#111111',
    accent: '#ffe14d',
    font: 'sans',
    bold: true,
    upper: false,
  },
  {
    style: 'metal',
    label: 'Gold foil',
    accentRole: 'Outline',
    color: '#f2c14e',
    accent: '#2a1608',
    font: 'serif',
    bold: true,
    upper: false,
  },
  {
    style: 'cinema',
    label: 'Cinema',
    accentRole: 'Rule',
    color: '#f5efe6',
    accent: '#e7b45a',
    font: 'serif',
    bold: false,
    upper: true,
  },
  {
    style: 'plain',
    label: 'Plain',
    accentRole: 'Shadow',
    color: '#ffffff',
    accent: '#000000',
    font: 'sans',
    bold: true,
    upper: false,
  },
];

/**
 * Gives the preset of a look.
 *
 * @param style The look.
 * @returns The preset.
 */
export function stylePreset(style: CaptureTextStyle): CaptureStylePreset {
  return CAPTURE_STYLES.find((preset) => preset.style === style) ?? CAPTURE_STYLES[0]!;
}

/**
 * Gives the space between the letters of a look, as a part of the size of the letters.
 *
 * @param style The look.
 * @returns The space.
 */
export function styleSpacing(style: CaptureTextStyle): number {
  if (style === 'cinema') {
    return 0.22;
  }
  return style === 'punch' || style === 'block' ? 0.02 : 0;
}

/**
 * Gives the space that a look adds around its letters, as a part of the size of the letters, so
 * the box of a text holds its box, its marker, or its depth.
 *
 * @param style The look.
 * @returns The space at each side.
 */
export function stylePad(style: CaptureTextStyle): number {
  switch (style) {
    case 'label': {
      return 0.32;
    }
    case 'marker':
    case 'block':
    case 'punch': {
      return 0.16;
    }
    case 'cinema': {
      return 0.4;
    }
    default: {
      return 0.08;
    }
  }
}

/**
 * Reads a `#rrggbb` color.
 *
 * @param hex The color.
 * @returns The red, the green, and the blue, from 0 to 255.
 */
function rgbOf(hex: string): readonly [number, number, number] {
  const value = Number.parseInt(hex.replace('#', ''), 16);
  if (!Number.isFinite(value)) {
    return [255, 255, 255];
  }
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

/**
 * Mixes two colors.
 *
 * @param a The first color, as `#rrggbb`.
 * @param b The second color, as `#rrggbb`.
 * @param t The part of the second color, from 0 to 1.
 * @param alpha The opacity of the result.
 * @returns The CSS color.
 */
function mix(a: string, b: string, t: number, alpha = 1): string {
  const ca = rgbOf(a);
  const cb = rgbOf(b);
  const channel = (i: 0 | 1 | 2): number => Math.round(ca[i] + (cb[i] - ca[i]) * t);
  return `rgba(${channel(0)}, ${channel(1)}, ${channel(2)}, ${alpha})`;
}

/** A line of a text, with its width and the y of its middle from the middle of the text. */
export interface StyledLine {
  readonly text: string;
  readonly width: number;
  readonly y: number;
}

/** The values of a text that a look reads. */
export interface StyledText {
  readonly style: CaptureTextStyle;
  readonly color: string;
  readonly accent: string;
}

/**
 * Sets a soft shadow below the letters.
 *
 * @param context The context.
 * @param px The size of the letters, in pixels.
 * @param color The CSS color of the shadow.
 */
function softShadow(context: CanvasRenderingContext2D, px: number, color: string): void {
  context.shadowColor = color;
  context.shadowBlur = px * 0.12;
  context.shadowOffsetX = 0;
  context.shadowOffsetY = px * 0.04;
}

/**
 * Removes the shadow.
 *
 * @param context The context.
 */
function noShadow(context: CanvasRenderingContext2D): void {
  context.shadowColor = 'transparent';
  context.shadowBlur = 0;
  context.shadowOffsetX = 0;
  context.shadowOffsetY = 0;
}

/**
 * Adds a path of a box with round corners.
 *
 * @param context The context.
 * @param x The left edge.
 * @param y The top edge.
 * @param w The width.
 * @param h The height.
 * @param r The radius of the corners.
 */
function roundBox(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  context.beginPath();
  context.roundRect(x, y, w, h, Math.min(r, w / 2, h / 2));
}

/**
 * Draws the lines of a text in its look, around the origin of the context. The context holds the
 * font, the space between the letters, `textAlign = 'center'`, and `textBaseline = 'middle'`.
 *
 * @param context The context.
 * @param text The values of the text.
 * @param lines The lines.
 * @param px The size of the letters, in pixels.
 */
export function drawStyledLines(
  context: CanvasRenderingContext2D,
  text: StyledText,
  lines: readonly StyledLine[],
  px: number,
): void {
  const { color, accent } = text;
  const each = (draw: (line: StyledLine) => void): void => {
    for (const line of lines) {
      draw(line);
    }
  };
  context.lineJoin = 'round';
  context.miterLimit = 2;

  switch (text.style) {
    case 'classic': {
      context.lineWidth = px * 0.16;
      context.strokeStyle = mix(accent, accent, 0, 0.92);
      each((line) => context.strokeText(line.text, 0, line.y));
      softShadow(context, px, 'rgba(0, 0, 0, 0.5)');
      context.fillStyle = color;
      each((line) => context.fillText(line.text, 0, line.y));
      break;
    }

    case 'punch': {
      const drop = px * 0.07;
      context.fillStyle = '#000000';
      context.strokeStyle = '#000000';
      context.lineWidth = px * 0.34;
      each((line) => {
        context.strokeText(line.text, drop, line.y + drop);
        context.fillText(line.text, drop, line.y + drop);
      });
      each((line) => context.strokeText(line.text, 0, line.y));
      context.strokeStyle = accent;
      context.lineWidth = px * 0.18;
      each((line) => context.strokeText(line.text, 0, line.y));
      const fill = context.createLinearGradient(0, -px / 2, 0, px / 2);
      fill.addColorStop(0, mix(color, '#ffffff', 0.45));
      fill.addColorStop(0.55, color);
      fill.addColorStop(1, mix(color, '#000000', 0.18));
      each((line) => {
        context.save();
        context.translate(0, line.y);
        context.fillStyle = fill;
        context.fillText(line.text, 0, 0);
        context.restore();
      });
      break;
    }

    case 'block': {
      const depth = px * 0.14;
      const steps = Math.max(2, Math.min(28, Math.round(depth / Math.max(1, px * 0.008))));
      softShadow(context, px * 1.6, 'rgba(0, 0, 0, 0.55)');
      context.fillStyle = mix(accent, '#000000', 0.45);
      each((line) => context.fillText(line.text, depth, line.y + depth));
      noShadow(context);
      for (let i = steps; i >= 1; i--) {
        context.fillStyle = mix(accent, '#000000', 0.35 * (i / steps));
        const d = (depth * i) / steps;
        each((line) => context.fillText(line.text, d, line.y + d));
      }
      context.lineWidth = px * 0.05;
      context.strokeStyle = mix(accent, '#000000', 0.6);
      each((line) => context.strokeText(line.text, 0, line.y));
      context.fillStyle = color;
      each((line) => context.fillText(line.text, 0, line.y));
      break;
    }

    case 'neon': {
      context.fillStyle = mix(color, '#ffffff', 0.15);
      for (const [blur, glow] of [
        [0.9, accent],
        [0.45, color],
        [0.18, color],
      ] as const) {
        context.shadowColor = glow;
        context.shadowBlur = px * blur;
        context.shadowOffsetX = 0;
        context.shadowOffsetY = 0;
        each((line) => context.fillText(line.text, 0, line.y));
      }
      noShadow(context);
      context.lineWidth = px * 0.07;
      context.strokeStyle = color;
      each((line) => context.strokeText(line.text, 0, line.y));
      context.fillStyle = mix(color, '#ffffff', 0.78);
      each((line) => context.fillText(line.text, 0, line.y));
      break;
    }

    case 'label': {
      const padX = px * 0.32;
      const padY = px * 0.16;
      const width = Math.max(0, ...lines.map((line) => line.width)) + 2 * padX;
      const first = lines[0]?.y ?? 0;
      const last = lines.at(-1)?.y ?? 0;
      const height = last - first + px + 2 * padY;
      softShadow(context, px * 1.4, 'rgba(0, 0, 0, 0.45)');
      context.fillStyle = accent;
      roundBox(context, -width / 2, first - px / 2 - padY, width, height, px * 0.14);
      context.fill();
      noShadow(context);
      context.fillStyle = color;
      each((line) => context.fillText(line.text, 0, line.y + px * 0.03));
      break;
    }

    case 'marker': {
      const padX = px * 0.16;
      softShadow(context, px, 'rgba(0, 0, 0, 0.35)');
      context.fillStyle = accent;
      each((line) => {
        const w = line.width + 2 * padX;
        context.beginPath();
        context.moveTo(-w / 2 + px * 0.04, line.y - px * 0.5);
        context.lineTo(w / 2, line.y - px * 0.46);
        context.lineTo(w / 2 - px * 0.04, line.y + px * 0.5);
        context.lineTo(-w / 2, line.y + px * 0.46);
        context.closePath();
        context.fill();
      });
      noShadow(context);
      context.fillStyle = color;
      each((line) => context.fillText(line.text, 0, line.y + px * 0.03));
      break;
    }

    case 'metal': {
      context.lineWidth = px * 0.14;
      context.strokeStyle = accent;
      softShadow(context, px * 1.4, 'rgba(0, 0, 0, 0.6)');
      each((line) => context.strokeText(line.text, 0, line.y));
      noShadow(context);
      each((line) => {
        const foil = context.createLinearGradient(0, line.y - px / 2, 0, line.y + px / 2);
        foil.addColorStop(0, mix(color, '#ffffff', 0.7));
        foil.addColorStop(0.42, color);
        foil.addColorStop(0.5, mix(color, '#000000', 0.38));
        foil.addColorStop(0.62, color);
        foil.addColorStop(1, mix(color, '#ffffff', 0.35));
        context.fillStyle = foil;
        context.fillText(line.text, 0, line.y);
      });
      context.lineWidth = Math.max(1, px * 0.015);
      context.strokeStyle = mix(color, '#ffffff', 0.6, 0.7);
      each((line) => context.strokeText(line.text, 0, line.y));
      break;
    }

    case 'cinema': {
      softShadow(context, px * 2.5, 'rgba(0, 0, 0, 0.7)');
      context.fillStyle = color;
      each((line) => context.fillText(line.text, 0, line.y));
      noShadow(context);
      const last = lines.at(-1);
      if (last) {
        const rule = Math.min(last.width, px * 3);
        context.fillStyle = accent;
        context.fillRect(-rule / 2, last.y + px * 0.72, rule, Math.max(1, px * 0.04));
      }
      break;
    }

    case 'plain': {
      softShadow(context, px * 1.5, mix(accent, accent, 0, 0.6));
      context.fillStyle = color;
      each((line) => context.fillText(line.text, 0, line.y));
      break;
    }
  }
  noShadow(context);
}
