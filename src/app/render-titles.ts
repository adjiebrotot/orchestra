import type { FrameBox } from '../scene/letterbox.ts';

/**
 * The title card in the video of a render (design 2.5, render; 2.8): the look of the title card
 * of the page (`ui/title-card.ts`, `.title-card` in `ui.css`), drawn into each frame, because the
 * video records only the canvas of the stage. The sizes are parts of the short side of the frame,
 * so a 16:9 and a 9:16 video get the same size of letters.
 */
export const RENDER_TITLES = {
  /** The size of the title, as a part of the short side of the frame. */
  titleShare: 0.06,
  /** The line height of the title, as a part of its size. */
  titleLine: 1.15,
  /** The size of the subtitle, as a part of the short side. */
  subtitleShare: 0.022,
  /** The line height of the subtitle, as a part of its size. */
  subtitleLine: 1.5,
  /** The space between the letters of the subtitle, as a part of its size (`0.32em`). */
  subtitleSpacing: 0.32,
  /** The space between the lines of the card and the rule, as a part of the short side. */
  gapShare: 0.014,
  /** The width of the gold rule, as a part of the short side. */
  ruleShare: 0.045,
  /** The widest line, as a part of the width of the frame. */
  widthShare: 0.84,
  /**
   * The space below the card, as a part of the height of the frame: 8% in a wide frame, as the
   * page. A vertical frame keeps the card above the captions and the buttons of the apps of a
   * phone, which cover about the lowest fifth.
   */
  bottomShare: { wide: 0.08, vertical: 0.22 },
  /** The shade behind the card reaches this far past the text, as a part of the short side. */
  shadeShare: { x: 0.12, y: 0.07 },
  /** The colors of `ui.css`: `--text`, `--accent-strong`, `--accent`, and `--title-shade`. */
  colors: {
    title: '#efe8dc',
    subtitle: '#f0c676',
    rule: 'rgba(231, 180, 90, 0.7)',
    shade: [11, 9, 8, 0.8],
  },
} as const;

/** The lines of the title card of a render. */
export interface RenderTitleLines {
  /** The piece title, in the serif. */
  readonly title: string;
  /** The small line above the title, in spaced capitals: the composer by default. */
  readonly subtitle: string;
}

/** The type of the title card: the families of `ui.css`. */
export interface RenderTitleFonts {
  readonly serif: string;
  readonly sans: string;
}

/**
 * Reads the font families of the page for the title card (`--font-serif` and the font of the
 * root in `ui.css`).
 *
 * @returns The families.
 */
export function pageFonts(): RenderTitleFonts {
  const style = getComputedStyle(document.documentElement);
  const serif = style.getPropertyValue('--font-serif').trim();
  return { serif: serif === '' ? 'serif' : serif, sans: style.fontFamily || 'sans-serif' };
}

/**
 * Breaks a text into lines no wider than a width. A line breaks after a space, a hyphen, or an
 * underscore, as a file name has no spaces, and a word wider than the width breaks between its
 * letters.
 *
 * @param context The context, with its font.
 * @param text The text.
 * @param width The widest line, in pixels.
 * @returns The lines.
 */
function breakLines(context: CanvasRenderingContext2D, text: string, width: number): string[] {
  const words = text.split(/(?<=[\s_-])/u);
  const lines: string[] = [];
  let line = '';
  const push = (word: string): void => {
    const joined = line + word;
    if (line === '' || context.measureText(joined.trimEnd()).width <= width) {
      line = joined;
      return;
    }
    lines.push(line.trimEnd());
    line = word.trimStart();
  };
  for (const word of words) {
    if (context.measureText(word.trim()).width <= width) {
      push(word);
      continue;
    }
    for (const letter of word) {
      push(letter);
    }
  }
  if (line.trim() !== '') {
    lines.push(line.trimEnd());
  }
  return lines;
}

/**
 * Draws the title card into a frame of a render (design 2.5, render; 2.8): the subtitle in
 * spaced gold capitals, a short gold rule, and the title in the serif, centered in the lower part
 * of the frame over a soft shade.
 *
 * @param context The context of the frame, at the size of the video.
 * @param box The frame of the film in the video: the full video, or the 21:9 box of a format with
 *   bars.
 * @param lines The lines. An empty line shows nothing, and an empty subtitle hides the rule.
 * @param level The opacity, from 0 to 1 (`titleCardLevel()`).
 * @param fonts The font families.
 */
export function drawTitleCard(
  context: CanvasRenderingContext2D,
  box: FrameBox,
  lines: RenderTitleLines,
  level: number,
  fonts: RenderTitleFonts,
): void {
  const k = RENDER_TITLES;
  const title = lines.title.trim();
  const subtitle = lines.subtitle.trim().toUpperCase();
  if (level <= 0 || (title === '' && subtitle === '')) {
    return;
  }
  const unit = Math.min(box.width, box.height);
  const titlePx = unit * k.titleShare;
  const subtitlePx = unit * k.subtitleShare;
  const gap = unit * k.gapShare;
  const maxWidth = box.width * k.widthShare;
  context.save();
  context.letterSpacing = `${subtitlePx * k.subtitleSpacing}px`;
  context.font = `500 ${subtitlePx}px ${fonts.sans}`;
  const subtitleLines = subtitle === '' ? [] : breakLines(context, subtitle, maxWidth);
  const subtitleWidth = Math.max(0, ...subtitleLines.map((l) => context.measureText(l).width));
  context.letterSpacing = `${titlePx * 0.02}px`;
  context.font = `400 ${titlePx}px ${fonts.serif}`;
  const titleLines = title === '' ? [] : breakLines(context, title, maxWidth);
  const titleWidth = Math.max(0, ...titleLines.map((l) => context.measureText(l).width));
  const subtitleHeight = subtitleLines.length * subtitlePx * k.subtitleLine;
  const titleHeight = titleLines.length * titlePx * k.titleLine;
  const rule = subtitleLines.length > 0 && titleLines.length > 0;
  const height = subtitleHeight + titleHeight + (rule ? 2 * gap + 1 : 0);
  const vertical = box.width < box.height;
  const bottom =
    box.y + box.height / 2 - box.height * (vertical ? k.bottomShare.vertical : k.bottomShare.wide);
  const top = bottom - height;
  const x = box.x;
  context.globalAlpha = Math.min(1, level);

  // The shade: an ellipse that fades to its edge, as the blurred pill of the page.
  const [r, g, b, a] = k.colors.shade;
  const rx = Math.max(subtitleWidth, titleWidth) / 2 + unit * k.shadeShare.x;
  const ry = height / 2 + unit * k.shadeShare.y;
  context.save();
  context.translate(x, top + height / 2);
  context.scale(rx, ry);
  const shade = context.createRadialGradient(0, 0, 0, 0, 0, 1);
  shade.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${a})`);
  shade.addColorStop(0.55, `rgba(${r}, ${g}, ${b}, ${a * 0.85})`);
  shade.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
  context.fillStyle = shade;
  context.beginPath();
  context.arc(0, 0, 1, 0, 2 * Math.PI);
  context.fill();
  context.restore();

  const shadow = unit / 720;
  context.shadowColor = '#000';
  context.shadowBlur = 3 * shadow;
  context.shadowOffsetY = shadow;
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  let y = top;
  context.fillStyle = k.colors.subtitle;
  context.font = `500 ${subtitlePx}px ${fonts.sans}`;
  context.letterSpacing = `${subtitlePx * k.subtitleSpacing}px`;
  for (const line of subtitleLines) {
    const lineHeight = subtitlePx * k.subtitleLine;
    // The spacing follows each letter, also the last one, so the line moves by half a space.
    context.fillText(line, x + (subtitlePx * k.subtitleSpacing) / 2, y + lineHeight / 2);
    y += lineHeight;
  }
  if (rule) {
    y += gap;
    context.shadowColor = 'transparent';
    context.fillStyle = k.colors.rule;
    const ruleWidth = unit * k.ruleShare;
    context.fillRect(x - ruleWidth / 2, y, ruleWidth, Math.max(1, unit / 1080));
    context.shadowColor = '#000';
    y += 1 + gap;
  }
  context.fillStyle = k.colors.title;
  context.font = `400 ${titlePx}px ${fonts.serif}`;
  context.letterSpacing = `${titlePx * 0.02}px`;
  for (const line of titleLines) {
    const lineHeight = titlePx * k.titleLine;
    context.fillText(line, x, y + lineHeight / 2);
    y += lineHeight;
  }
  context.restore();
}
