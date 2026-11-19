/**
 * The built-in country flags of the stage dressing (design 4.5, backdrop). Each flag draws on a
 * canvas at any aspect, so a banner of any aspect ratio shows a flag with round discs and true
 * stars: the stripes stretch with the box, and the emblems keep their form.
 */

/** A 2D context of a canvas. */
type Context = CanvasRenderingContext2D;

/** Draws a flag in the box (0, 0)–(w, h), with the hoist at the left. */
type FlagDrawer = (context: Context, w: number, h: number) => void;

/**
 * Fills horizontal bands of the same height, from the top.
 *
 * @param context The context.
 * @param w The width.
 * @param h The height.
 * @param colors The colors of the bands.
 */
function bands(context: Context, w: number, h: number, colors: readonly string[]): void {
  for (const [i, color] of colors.entries()) {
    context.fillStyle = color;
    context.fillRect(0, (i * h) / colors.length, w, h / colors.length + 1);
  }
}

/**
 * Fills vertical bands of the same width, from the hoist.
 *
 * @param context The context.
 * @param w The width.
 * @param h The height.
 * @param colors The colors of the bands.
 */
function pales(context: Context, w: number, h: number, colors: readonly string[]): void {
  for (const [i, color] of colors.entries()) {
    context.fillStyle = color;
    context.fillRect((i * w) / colors.length, 0, w / colors.length + 1, h);
  }
}

/**
 * Fills a star.
 *
 * @param context The context.
 * @param x The x of the center.
 * @param y The y of the center.
 * @param radius The outer radius.
 * @param color The color.
 * @param points The number of points.
 * @param turn The turn of the first point from the top, in radians.
 */
function star(
  context: Context,
  x: number,
  y: number,
  radius: number,
  color: string,
  points = 5,
  turn = 0,
): void {
  const inner = radius * (points === 5 ? 0.382 : 0.45);
  context.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? radius : inner;
    const a = turn + (i * Math.PI) / points;
    context.lineTo(x + r * Math.sin(a), y - r * Math.cos(a));
  }
  context.closePath();
  context.fillStyle = color;
  context.fill();
}

/**
 * Fills horizontal bands of different heights, from the top.
 *
 * @param context The context.
 * @param w The width.
 * @param h The height.
 * @param parts The color and the relative height of each band.
 */
function stripes(
  context: Context,
  w: number,
  h: number,
  parts: readonly (readonly [string, number])[],
): void {
  const total = parts.reduce((sum, [, weight]) => sum + weight, 0);
  let y = 0;
  for (const [color, weight] of parts) {
    context.fillStyle = color;
    context.fillRect(0, (y * h) / total, w, (weight * h) / total + 1);
    y += weight;
  }
}

/**
 * Fills a disc.
 *
 * @param context The context.
 * @param x The x of the center.
 * @param y The y of the center.
 * @param radius The radius.
 * @param color The color.
 */
function disc(context: Context, x: number, y: number, radius: number, color: string): void {
  context.fillStyle = color;
  context.beginPath();
  context.arc(x, y, radius, 0, Math.PI * 2);
  context.fill();
}

/**
 * Fills a polygon.
 *
 * @param context The context.
 * @param color The color.
 * @param points The corners.
 */
function polygon(
  context: Context,
  color: string,
  points: readonly (readonly [number, number])[],
): void {
  context.fillStyle = color;
  context.beginPath();
  for (const [x, y] of points) {
    context.lineTo(x, y);
  }
  context.closePath();
  context.fill();
}

/**
 * Strokes a line.
 *
 * @param context The context.
 * @param color The color.
 * @param width The line width.
 * @param points The points of the line.
 */
function stroke(
  context: Context,
  color: string,
  width: number,
  points: readonly (readonly [number, number])[],
): void {
  context.strokeStyle = color;
  context.lineWidth = width;
  context.beginPath();
  for (const [x, y] of points) {
    context.lineTo(x, y);
  }
  context.stroke();
}

/**
 * Draws a Nordic cross flag.
 *
 * @param context The context.
 * @param w The width.
 * @param h The height.
 * @param field The color of the field.
 * @param crosses The color and the width (a fraction of the height) of each cross, outer first.
 * @param at The center of the upright bar, as a fraction of the width.
 */
function nordic(
  context: Context,
  w: number,
  h: number,
  field: string,
  crosses: readonly (readonly [string, number])[],
  at: number,
): void {
  context.fillStyle = field;
  context.fillRect(0, 0, w, h);
  for (const [color, width] of crosses) {
    context.fillStyle = color;
    context.fillRect(at * w - (width * h) / 2, 0, width * h, h);
    context.fillRect(0, h / 2 - (width * h) / 2, w, width * h);
  }
}

/**
 * Draws a flag with a serrated white band at the hoist, as Bahrain and Qatar.
 *
 * @param context The context.
 * @param w The width.
 * @param h The height.
 * @param color The color of the fly.
 * @param points The number of white points.
 * @param base The width of the white band, as a fraction of the width.
 * @param tip The x of the points, as a fraction of the width.
 */
function serrated(
  context: Context,
  w: number,
  h: number,
  color: string,
  points: number,
  base: number,
  tip: number,
): void {
  context.fillStyle = color;
  context.fillRect(0, 0, w, h);
  const edge: [number, number][] = [[0, 0]];
  for (let i = 0; i < points; i++) {
    edge.push([base * w, (i * h) / points], [tip * w, ((i + 0.5) * h) / points]);
  }
  edge.push([base * w, h], [0, h]);
  polygon(context, '#ffffff', edge);
}

/**
 * Draws a crescent that opens to the fly.
 *
 * @param context The context.
 * @param x The x of the center of the outer disc.
 * @param y The y of the center.
 * @param radius The radius of the outer disc.
 * @param color The color of the crescent.
 * @param field The color of the field behind it.
 */
function crescent(
  context: Context,
  x: number,
  y: number,
  radius: number,
  color: string,
  field: string,
): void {
  disc(context, x, y, radius, color);
  disc(context, x + 0.25 * radius, y, 0.8 * radius, field);
}

/**
 * Draws the Union Jack in the box (0, 0)–(w, h).
 *
 * @param context The context.
 * @param w The width.
 * @param h The height.
 */
function unionJack(context: Context, w: number, h: number): void {
  context.save();
  context.beginPath();
  context.rect(0, 0, w, h);
  context.clip();
  context.fillStyle = '#012169';
  context.fillRect(0, 0, w, h);
  const line = (width: number, color: string, ax: number, ay: number, bx: number, by: number) => {
    context.strokeStyle = color;
    context.lineWidth = width;
    context.beginPath();
    context.moveTo(ax, ay);
    context.lineTo(bx, by);
    context.stroke();
  };
  line(h / 5, '#ffffff', 0, 0, w, h);
  line(h / 5, '#ffffff', w, 0, 0, h);
  line(h / 15, '#c8102e', 0, 0, w, h);
  line(h / 15, '#c8102e', w, 0, 0, h);
  line(h / 3, '#ffffff', w / 2, 0, w / 2, h);
  line(h / 3, '#ffffff', 0, h / 2, w, h / 2);
  line(h / 5, '#c8102e', w / 2, 0, w / 2, h);
  line(h / 5, '#c8102e', 0, h / 2, w, h / 2);
  context.restore();
}

/** The width of the raster of a flag artwork, in pixels. */
const ART_WIDTH = 2048;

/** The rasters of the loaded flag artworks, by the code of the flag. */
const ART = new Map<string, HTMLCanvasElement>();

/** The loads of the flag artworks that run or ended, by the code of the flag. */
const ART_LOADS = new Map<string, Promise<void>>();

/** The keyed crops of the artworks, by the code, the box, and the key colors. */
const KEYED = new Map<string, HTMLCanvasElement>();

/**
 * Gives a loader of the URL of each flag artwork of Wikimedia Commons (`assets/flags/`), by its
 * path relative to this module. Each file is an asset of a lazy chunk of Vite, so the first
 * download holds none of them (design 7.2).
 *
 * @returns The loaders.
 */
function artUrls(): Record<string, () => Promise<string>> {
  return import.meta.glob<string>('../../assets/flags/*.svg', { query: '?url', import: 'default' });
}

/**
 * Gives the loader of the artwork of a flag.
 *
 * @param code The code of the flag.
 * @returns The loader, or `undefined` for a flag with no artwork.
 */
function artUrl(code: string): (() => Promise<string>) | undefined {
  return artUrls()[`../../assets/flags/${code}.svg`];
}

/**
 * Tells if a flag shows all its artwork: it has none, or the artwork is loaded.
 *
 * @param code The code of the flag.
 * @returns True when a drawing of the flag is final.
 */
export function flagArtReady(code: string): boolean {
  return ART.has(code) || !artUrl(code);
}

/**
 * Loads the artworks of flags. A flag with no artwork or a failed load draws with no emblem.
 *
 * @param codes The codes of the flags.
 * @returns A promise that settles when each load ends.
 */
export async function loadFlagArt(codes: Iterable<string>): Promise<void> {
  const loads: Promise<void>[] = [];
  for (const code of codes) {
    const url = artUrl(code);
    if (!url) {
      continue;
    }
    let load = ART_LOADS.get(code);
    if (!load) {
      load = (async () => {
        const image = new Image();
        image.src = await url();
        await image.decode();
        const canvas = document.createElement('canvas');
        canvas.width = ART_WIDTH;
        canvas.height = Math.round((ART_WIDTH * image.naturalHeight) / image.naturalWidth);
        canvas.getContext('2d')?.drawImage(image, 0, 0, canvas.width, canvas.height);
        ART.set(code, canvas);
      })().catch(() => {
        // The flag keeps its field with no emblem.
      });
      ART_LOADS.set(code, load);
    }
    loads.push(load);
  }
  await Promise.all(loads);
}

/** A part of a flag artwork: the left, top, right, and bottom, as fractions of the flag. */
type ArtBox = readonly [number, number, number, number];

/**
 * Gives the source rectangle of a part of an artwork, in pixels.
 *
 * @param art The raster of the artwork.
 * @param box The part.
 * @returns The x, the y, the width, and the height.
 */
function sourceRect(art: HTMLCanvasElement, box: ArtBox): [number, number, number, number] {
  const [x0, y0, x1, y1] = box;
  return [x0 * art.width, y0 * art.height, (x1 - x0) * art.width, (y1 - y0) * art.height];
}

/**
 * Gives a part of an artwork in which the background colors that touch its edge are clear, so
 * that the part shows over any field.
 *
 * @param code The code of the flag.
 * @param art The raster of the artwork.
 * @param box The part.
 * @param keys The background colors, as `#rrggbb`.
 * @returns The part as a canvas.
 */
function keyedPart(
  code: string,
  art: HTMLCanvasElement,
  box: ArtBox,
  keys: readonly string[],
): HTMLCanvasElement {
  const id = `${code}:${box.join(',')}:${keys.join(',')}`;
  const cached = KEYED.get(id);
  if (cached) {
    return cached;
  }
  const [sx, sy, sw, sh] = sourceRect(art, box);
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(sw));
  canvas.height = Math.max(1, Math.round(sh));
  const context = canvas.getContext('2d');
  if (context) {
    context.drawImage(art, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
    const image = context.getImageData(0, 0, canvas.width, canvas.height);
    const data = image.data;
    const rgb = keys.map((key) => [1, 3, 5].map((i) => Number.parseInt(key.slice(i, i + 2), 16)));
    const near = (i: number): boolean =>
      rgb.some(
        ([r = 0, g = 0, b = 0]) =>
          Math.abs((data[i] ?? 0) - r) +
            Math.abs((data[i + 1] ?? 0) - g) +
            Math.abs((data[i + 2] ?? 0) - b) <
          90,
      );
    const { width, height } = canvas;
    const seen = new Uint8Array(width * height);
    const stack: number[] = [];
    for (let x = 0; x < width; x++) {
      stack.push(x, x + (height - 1) * width);
    }
    for (let y = 0; y < height; y++) {
      stack.push(y * width, y * width + width - 1);
    }
    while (stack.length > 0) {
      const p = stack.pop() ?? 0;
      if (seen[p] || !near(p * 4)) {
        continue;
      }
      seen[p] = 1;
      data[p * 4 + 3] = 0;
      const x = p % width;
      if (x > 0) {
        stack.push(p - 1);
      }
      if (x < width - 1) {
        stack.push(p + 1);
      }
      if (p >= width) {
        stack.push(p - width);
      }
      if (p < width * (height - 1)) {
        stack.push(p + width);
      }
    }
    context.putImageData(image, 0, 0);
  }
  KEYED.set(id, canvas);
  return canvas;
}

/** How a part of an artwork shows. */
interface PartOptions {
  /** Clips the part to the ellipse in its box, for a disc. */
  readonly round?: boolean;
  /** Clears the background colors that touch the edge of the part, as `#rrggbb`. */
  readonly keys?: readonly string[];
  /** Turns the part a quarter turn clockwise (1) or counterclockwise (-1). */
  readonly turn?: 1 | -1;
}

/**
 * Draws a part of the artwork of a flag upright, with its own aspect, centered on a point. A flag
 * whose artwork is not loaded draws nothing.
 *
 * @param context The context.
 * @param code The code of the flag.
 * @param box The part, as fractions of the flag.
 * @param x The x of the center.
 * @param y The y of the center.
 * @param width The width of the part as drawn, before a turn.
 * @param options How the part shows.
 */
function part(
  context: Context,
  code: string,
  box: ArtBox,
  x: number,
  y: number,
  width: number,
  options: PartOptions = {},
): void {
  const art = ART.get(code);
  if (!art) {
    return;
  }
  const [sx, sy, sw, sh] = sourceRect(art, box);
  const height = (width * sh) / sw;
  context.save();
  context.translate(x, y);
  if (options.turn) {
    context.rotate((options.turn * Math.PI) / 2);
  }
  if (options.round) {
    context.beginPath();
    context.ellipse(0, 0, width / 2, height / 2, 0, 0, Math.PI * 2);
    context.clip();
  }
  if (options.keys) {
    context.drawImage(
      keyedPart(code, art, box, options.keys),
      -width / 2,
      -height / 2,
      width,
      height,
    );
  } else {
    context.drawImage(art, sx, sy, sw, sh, -width / 2, -height / 2, width, height);
  }
  context.restore();
}

/**
 * Gives the width of a part of an artwork that fits in a box, with its own aspect.
 *
 * @param code The code of the flag.
 * @param box The part, as fractions of the flag.
 * @param maxWidth The largest width.
 * @param maxHeight The largest height.
 * @returns The width.
 */
function fitWidth(code: string, box: ArtBox, maxWidth: number, maxHeight: number): number {
  const art = ART.get(code);
  if (!art) {
    return maxWidth;
  }
  const [, , sw, sh] = sourceRect(art, box);
  return Math.min(maxWidth, (maxHeight * sw) / sh);
}

/**
 * Draws a flag turned for a vertical banner: the hoist at the top and the top edge at the left,
 * as a flag that hangs with its reverse side to the viewer.
 *
 * @param context The context.
 * @param w The width of the banner.
 * @param h The height of the banner.
 * @param draw The drawer of the flag.
 */
function flipped(context: Context, w: number, h: number, draw: FlagDrawer): void {
  context.save();
  context.transform(0, 1, 1, 0, 0, 0);
  draw(context, h, w);
  context.restore();
}

/** The part of the Saudi artwork with the Shahada and the sword. */
const SA_ART: ArtBox = [0.25, 0.25, 0.75, 0.744];

/** The part of the Brazilian artwork with the globe. */
const BR_ART: ArtBox = [0.325, 0.25, 0.675, 0.75];

/** The part of the Mexican artwork with the arms. */
const MX_ART: ArtBox = [0.37, 0.295, 0.63, 0.705];

/** The part of the Cambodian artwork with the temple. */
const KH_ART: ArtBox = [0.29, 0.287, 0.71, 0.713];

/** The part of the Vatican artwork with the keys and the tiara. */
const VA_ART: ArtBox = [0.57, 0.24, 0.932, 0.775];

/** The part of the Spanish artwork with the arms. */
const ES_ART: ArtBox = [0.208, 0.295, 0.459, 0.705];

/** The part of the Bruneian artwork with the crest. */
const BN_ART: ArtBox = [0.32, 0.19, 0.68, 0.81];

/** The colors of the Bruneian field, which clear around the crest. */
const BN_KEYS = ['#f7e017', '#ffffff', '#000000'];

/** The part of the Iranian artwork with the emblem. */
const IR_ART: ArtBox = [0.424, 0.37, 0.576, 0.63];

/** One tile of the takbir of the Iranian artwork at the foot of the green stripe. */
const IR_TAKBIR_TOP: ArtBox = [8.4 / 630, 99 / 360, 64.4 / 630, 123 / 360];

/** One tile of the takbir of the Iranian artwork at the top of the red stripe. */
const IR_TAKBIR_FOOT: ArtBox = [8.4 / 630, 237 / 360, 64.4 / 630, 262 / 360];

/** The part of the Kazakh artwork with the sun and the eagle. */
const KZ_EMBLEM: ArtBox = [0.38, 0.205, 0.7, 0.775];

/** The part of the Kazakh artwork with the ornament at the hoist. */
const KZ_ORNAMENT: ArtBox = [0.028, 0.05, 0.092, 0.95];

/** The part of the Mongolian artwork with the Soyombo. */
const MN_ART: ArtBox = [0.07, 0.095, 0.263, 0.855];

/** The part of the Argentine artwork with the Sun of May. */
const AR_ART: ArtBox = [0.408, 0.355, 0.592, 0.645];

/** The part of the Canadian artwork with the maple leaf. */
const CA_ART: ArtBox = [0.3, 0.078, 0.7, 0.928];

/** The part of the Philippine artwork with the sun. */
const PH_SUN: ArtBox = [0.048, 0.288, 0.262, 0.712];

/** The stripes of North Korea, from the top. */
const KP_STRIPES: readonly (readonly [string, number])[] = [
  ['#024fa2', 6],
  ['#ffffff', 1],
  ['#ed1c27', 22],
  ['#ffffff', 1],
  ['#024fa2', 6],
];

/** The stripes of Spain, from the top. */
const ES_STRIPES: readonly (readonly [string, number])[] = [
  ['#ad1519', 1],
  ['#fabd00', 2],
  ['#ad1519', 1],
];

/** The bands of Venezuela, from the top. */
const VE_BANDS = ['#ffcc00', '#00247d', '#cf142b'];

/** The bands of Argentina, from the top. */
const AR_BANDS = ['#74acdf', '#ffffff', '#74acdf'];

/** The pales of Mexico, from the hoist. */
const MX_PALES = ['#006847', '#ffffff', '#ce1126'];

/** The pales of the Vatican City, from the hoist. */
const VA_PALES = ['#fff200', '#ffffff'];

/** The pales of Mongolia, from the hoist. */
const MN_PALES = ['#da2031', '#0066b2', '#da2031'];

/**
 * Draws the canton of Taiwan: the white sun on blue.
 *
 * @param context The context.
 * @param cw The width of the canton.
 * @param ch The height of the canton.
 */
function rocCanton(context: Context, cw: number, ch: number): void {
  context.fillStyle = '#000095';
  context.fillRect(0, 0, cw, ch);
  const s = Math.min(cw, 1.5 * ch) / 1.5;
  star(context, cw / 2, ch / 2, 0.37 * s, '#ffffff', 12);
  disc(context, cw / 2, ch / 2, 0.2 * s, '#000095');
  disc(context, cw / 2, ch / 2, 0.17 * s, '#ffffff');
}

/**
 * Draws the flag of Vietnam. The star stays upright at any aspect.
 *
 * @param context The context.
 * @param w The width.
 * @param h The height.
 */
function vietnam(context: Context, w: number, h: number): void {
  context.fillStyle = '#da251d';
  context.fillRect(0, 0, w, h);
  star(context, w / 2, h / 2, 0.3 * Math.min(w, h), '#ffff00');
}

/**
 * Draws the flag of Europe. The stars stay upright at any aspect.
 *
 * @param context The context.
 * @param w The width.
 * @param h The height.
 */
function europe(context: Context, w: number, h: number): void {
  context.fillStyle = '#003399';
  context.fillRect(0, 0, w, h);
  const r = Math.min(w, h) / 3;
  for (let i = 0; i < 12; i++) {
    const a = (i * Math.PI) / 6;
    star(context, w / 2 + r * Math.sin(a), h / 2 - r * Math.cos(a), r / 6, '#ffcc00');
  }
}

/**
 * Draws the question mark: a black "?" in the middle of a white cloth. The mark stays upright and
 * keeps its form at any aspect.
 *
 * @param context The context.
 * @param w The width.
 * @param h The height.
 */
function questionMark(context: Context, w: number, h: number): void {
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, w, h);
  const u = Math.min(w, h);
  context.font = `bold ${String(Math.round(0.8 * u))}px Georgia, 'Times New Roman', serif`;
  context.textAlign = 'center';
  context.textBaseline = 'alphabetic';
  const metrics = context.measureText('?');
  const ascent = metrics.actualBoundingBoxAscent;
  const descent = metrics.actualBoundingBoxDescent;
  context.fillStyle = '#1a1a1a';
  context.fillText('?', w / 2, h / 2 + (ascent - descent) / 2);
}

/**
 * Draws the flag of ASEAN: eleven stalks of rice in a red disc. The emblem stays upright at any
 * aspect.
 *
 * @param context The context.
 * @param w The width.
 * @param h The height.
 */
function asean(context: Context, w: number, h: number): void {
  context.fillStyle = '#0033a0';
  context.fillRect(0, 0, w, h);
  const u = Math.min(h, (2 * w) / 3);
  const x = w / 2;
  const y = h / 2;
  disc(context, x, y, 0.3 * u, '#ffffff');
  disc(context, x, y, 0.286 * u, '#ef3340');
  const pitch = 0.0283 * u;
  const half = 0.0102 * u;
  const top = 0.15 * u;
  context.fillStyle = '#f7e400';
  for (let i = -5; i <= 5; i++) {
    const sx = x + i * pitch;
    const waist = x + 0.47 * i * pitch;
    context.beginPath();
    context.moveTo(sx - half, y - top);
    context.lineTo(sx + half, y - top);
    context.quadraticCurveTo(sx + half, y, waist, y);
    context.quadraticCurveTo(sx + half, y, sx + half, y + top);
    context.lineTo(sx - half, y + top);
    context.quadraticCurveTo(sx - half, y, waist, y);
    context.quadraticCurveTo(sx - half, y, sx - half, y - top);
    context.fill();
  }
}

/**
 * Draws the flag of Iran. The stripes stay horizontal at any aspect, as on a vertical banner: the
 * takbir keeps the scale of the stripes, and the emblem stays upright.
 *
 * @param context The context.
 * @param w The width.
 * @param h The height.
 */
function iran(context: Context, w: number, h: number): void {
  bands(context, w, h, ['#239f40', '#ffffff', '#da0000']);
  const s = h / 360;
  const tile = 56 * s;
  const count = Math.max(1, Math.floor(w / tile));
  const x0 = (w - count * tile) / 2;
  for (let i = 0; i < count; i++) {
    const x = x0 + (i + 0.5) * tile;
    part(context, 'ir', IR_TAKBIR_TOP, x, 111 * s, tile);
    part(context, 'ir', IR_TAKBIR_FOOT, x, 249.5 * s, tile);
  }
  part(context, 'ir', IR_ART, w / 2, h / 2, Math.min(95.76 * s, 0.8 * w));
}

/**
 * Draws the flag of Portugal: the artwork, or the field until it loads.
 *
 * @param context The context.
 * @param w The width.
 * @param h The height.
 */
function portugal(context: Context, w: number, h: number): void {
  const art = ART.get('pt');
  if (art) {
    context.drawImage(art, 0, 0, w, h);
    return;
  }
  context.fillStyle = '#ff0000';
  context.fillRect(0, 0, w, h);
  context.fillStyle = '#006600';
  context.fillRect(0, 0, 0.4 * w, h);
}

/**
 * Draws the field of Brazil: the yellow rhombus on green.
 *
 * @param context The context.
 * @param w The width.
 * @param h The height.
 */
function brazilField(context: Context, w: number, h: number): void {
  context.fillStyle = '#009440';
  context.fillRect(0, 0, w, h);
  polygon(context, '#ffcb00', [
    [0.085 * w, h / 2],
    [w / 2, 0.1214 * h],
    [0.915 * w, h / 2],
    [w / 2, 0.8786 * h],
  ]);
}

/**
 * Draws the field of Brunei: the white and black bands across the yellow.
 *
 * @param context The context.
 * @param w The width.
 * @param h The height.
 */
function bruneiField(context: Context, w: number, h: number): void {
  context.fillStyle = '#f7e017';
  context.fillRect(0, 0, w, h);
  polygon(context, '#ffffff', [
    [0, (50 / 720) * h],
    [0, (370 / 720) * h],
    [w, (520 / 720) * h],
    [w, (350 / 720) * h],
  ]);
  polygon(context, '#000000', [
    [0, (220 / 720) * h],
    [0, (370 / 720) * h],
    [w, (670 / 720) * h],
    [w, (520 / 720) * h],
  ]);
}

/**
 * The flags, by their ISO 3166 code (or `asean` for a group), with the name of the menu, the
 * drawer, and the drawer of the vertical banner. With no vertical drawer, a banner shows the flag
 * {@link flipped}.
 */
const FLAGS: readonly (readonly [string, string, FlagDrawer, FlagDrawer?])[] = [
  [
    'id',
    'Indonesia',
    (c, w, h) => {
      bands(c, w, h, ['#e70011', '#ffffff']);
    },
  ],
  [
    'jp',
    'Japan',
    (c, w, h) => {
      c.fillStyle = '#ffffff';
      c.fillRect(0, 0, w, h);
      c.fillStyle = '#bc002d';
      c.beginPath();
      c.arc(w / 2, h / 2, 0.3 * Math.min(h, w), 0, Math.PI * 2);
      c.fill();
    },
  ],
  [
    'cn',
    'China',
    (c, w, h) => {
      c.fillStyle = '#ee1c25';
      c.fillRect(0, 0, w, h);
      const u = Math.min(h / 20, w / 30);
      star(c, 5 * u, 5 * u, 3 * u, '#ffff00');
      for (const [x, y] of [
        [10, 2],
        [12, 4],
        [12, 7],
        [10, 9],
      ] as const) {
        star(c, x * u, y * u, u, '#ffff00', 5, Math.atan2(x - 5, -(y - 5)) + Math.PI);
      }
    },
    (c, w, h) => {
      // The vertical flag: the large star at the top middle, the small stars in an arc below it.
      c.fillStyle = '#ee1c25';
      c.fillRect(0, 0, w, h);
      const u = Math.min(w / 20, h / 30);
      const x = w / 2;
      const y = 5.8 * u;
      star(c, x, y, 3.6 * u, '#ffff00');
      for (const [dx, dy] of [
        [-6.2, 2.9],
        [6.2, 2.9],
        [-2.5, 6.7],
        [2.5, 6.7],
      ] as const) {
        star(c, x + dx * u, y + dy * u, 1.2 * u, '#ffff00', 5, Math.atan2(dx, -dy) + Math.PI);
      }
    },
  ],
  [
    'gb',
    'United Kingdom',
    (c, w, h) => {
      unionJack(c, w, h);
    },
    (c, w, h) => {
      // The Union Flag turns a quarter turn with its obverse to the viewer.
      c.save();
      c.translate(w, 0);
      c.rotate(Math.PI / 2);
      unionJack(c, h, w);
      c.restore();
    },
  ],
  [
    'us',
    'United States',
    (c, w, h) => {
      for (let i = 0; i < 13; i++) {
        c.fillStyle = i % 2 === 0 ? '#b22234' : '#ffffff';
        c.fillRect(0, (i * h) / 13, w, h / 13 + 1);
      }
      const cw = Math.min(0.4 * w, 0.76 * h);
      const ch = (7 / 13) * h;
      c.fillStyle = '#3c3b6e';
      c.fillRect(0, 0, cw, ch);
      for (let row = 0; row < 9; row++) {
        const count = row % 2 === 0 ? 6 : 5;
        for (let col = 0; col < count; col++) {
          const x = ((2 * col + (row % 2 === 0 ? 1 : 2)) * cw) / 12;
          const y = ((row + 1) * ch) / 10;
          star(c, x, y, 0.031 * h, '#ffffff');
        }
      }
    },
  ],
  [
    'fr',
    'France',
    (c, w, h) => {
      pales(c, w, h, ['#0055a4', '#ffffff', '#ef4135']);
    },
  ],
  [
    'de',
    'Germany',
    (c, w, h) => {
      bands(c, w, h, ['#000000', '#dd0000', '#ffce00']);
    },
  ],
  [
    'it',
    'Italy',
    (c, w, h) => {
      pales(c, w, h, ['#009246', '#ffffff', '#ce2b37']);
    },
  ],
  [
    'nl',
    'Netherlands',
    (c, w, h) => {
      bands(c, w, h, ['#ae1c28', '#ffffff', '#21468b']);
    },
  ],
  [
    'ua',
    'Ukraine',
    (c, w, h) => {
      bands(c, w, h, ['#0057b7', '#ffd700']);
    },
  ],
  [
    'in',
    'India',
    (c, w, h) => {
      bands(c, w, h, ['#ff9933', '#ffffff', '#138808']);
      const r = 0.4 * (h / 3);
      c.strokeStyle = '#000080';
      c.lineWidth = r * 0.12;
      c.beginPath();
      c.arc(w / 2, h / 2, r, 0, Math.PI * 2);
      c.stroke();
      c.lineWidth = r * 0.04;
      for (let i = 0; i < 24; i++) {
        const a = (i * Math.PI) / 12;
        c.beginPath();
        c.moveTo(w / 2, h / 2);
        c.lineTo(w / 2 + r * Math.cos(a), h / 2 + r * Math.sin(a));
        c.stroke();
      }
    },
  ],
  [
    'sg',
    'Singapore',
    (c, w, h) => {
      bands(c, w, h, ['#ef3340', '#ffffff']);
      const u = h / 2;
      c.fillStyle = '#ffffff';
      c.beginPath();
      c.arc(0.25 * u + 0.2 * u, 0.5 * u, 0.3 * u, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = '#ef3340';
      c.beginPath();
      c.arc(0.33 * u + 0.2 * u, 0.5 * u, 0.28 * u, 0, Math.PI * 2);
      c.fill();
      for (let i = 0; i < 5; i++) {
        const a = (i * 2 * Math.PI) / 5;
        star(
          c,
          0.72 * u + 0.15 * u * Math.sin(a),
          0.5 * u - 0.15 * u * Math.cos(a),
          0.06 * u,
          '#fff',
        );
      }
    },
  ],
  [
    'au',
    'Australia',
    (c, w, h) => {
      c.fillStyle = '#012169';
      c.fillRect(0, 0, w, h);
      unionJack(c, Math.min(w / 2, h), h / 2);
      const cx = Math.min(w / 4, h / 2);
      star(c, cx, 0.75 * h, 0.15 * h, '#ffffff', 7);
      const fly = (x: number, y: number, r: number, points = 7) => {
        star(c, w - (1 - x) * Math.min(w / 2, h), y * h, r * h, '#ffffff', points);
      };
      fly(0.5, 0.833, 0.067);
      fly(0.25, 0.43, 0.067);
      fly(0.5, 0.17, 0.067);
      fly(0.72, 0.38, 0.067);
      fly(0.62, 0.53, 0.04, 5);
    },
  ],
  [
    'nz',
    'New Zealand',
    (c, w, h) => {
      c.fillStyle = '#012169';
      c.fillRect(0, 0, w, h);
      unionJack(c, Math.min(w / 2, h), h / 2);
      const fly = (x: number, y: number, r: number) => {
        const px = w - (1 - x) * Math.min(w / 2, h);
        star(c, px, y * h, r * h * 1.3, '#ffffff');
        star(c, px, y * h, r * h, '#c8102e');
      };
      fly(0.5, 0.8, 0.065);
      fly(0.28, 0.43, 0.055);
      fly(0.5, 0.17, 0.055);
      fly(0.72, 0.4, 0.05);
    },
  ],
  [
    'ae',
    'United Arab Emirates',
    (c, w, h) => {
      bands(c, w, h, ['#00732f', '#ffffff', '#000000']);
      c.fillStyle = '#ff0000';
      c.fillRect(0, 0, w / 4, h);
    },
  ],
  [
    'th',
    'Thailand',
    (c, w, h) => {
      stripes(c, w, h, [
        ['#a51931', 1],
        ['#f4f5f8', 1],
        ['#2d2a4a', 2],
        ['#f4f5f8', 1],
        ['#a51931', 1],
      ]);
    },
  ],
  [
    'fi',
    'Finland',
    (c, w, h) => {
      nordic(c, w, h, '#ffffff', [['#002f6c', 3 / 11]], 6.5 / 18);
    },
  ],
  [
    'bh',
    'Bahrain',
    (c, w, h) => {
      serrated(c, w, h, '#ce1126', 5, 0.24, 0.38);
    },
  ],
  [
    'kz',
    'Kazakhstan',
    (c, w, h) => {
      c.fillStyle = '#00abc2';
      c.fillRect(0, 0, w, h);
      const u = Math.min(h, w / 2);
      part(c, 'kz', KZ_ORNAMENT, 0.06 * u, h / 2, 0.12 * u);
      part(c, 'kz', KZ_EMBLEM, 0.54 * w, 0.49 * h, 0.624 * u);
    },
    (c, w, h) => {
      // The vertical flag: the ornament across the top, the sun and the eagle upright.
      c.fillStyle = '#00abc2';
      c.fillRect(0, 0, w, h);
      part(c, 'kz', KZ_ORNAMENT, w / 2, 0.12 * w, 0.12 * w, { turn: -1 });
      part(
        c,
        'kz',
        KZ_EMBLEM,
        w / 2,
        h / 2 + 0.08 * w,
        fitWidth('kz', KZ_EMBLEM, 0.62 * w, 0.4 * h),
      );
    },
  ],
  [
    'qa',
    'Qatar',
    (c, w, h) => {
      serrated(c, w, h, '#8a1538', 9, 0.27, 0.39);
    },
  ],
  [
    'br',
    'Brazil',
    (c, w, h) => {
      brazilField(c, w, h);
      const r = 0.25 * Math.min(h, 0.7 * w);
      disc(c, w / 2, h / 2, r, '#302681');
      part(c, 'br', BR_ART, w / 2, h / 2, 2 * r, { round: true });
    },
    (c, w, h) => {
      // The globe stays upright, so the motto reads.
      flipped(c, w, h, brazilField);
      const r = 0.25 * Math.min(w, 0.7 * h);
      disc(c, w / 2, h / 2, r, '#302681');
      part(c, 'br', BR_ART, w / 2, h / 2, 2 * r, { round: true });
    },
  ],
  [
    'bd',
    'Bangladesh',
    (c, w, h) => {
      c.fillStyle = '#006a4e';
      c.fillRect(0, 0, w, h);
      disc(c, 0.45 * w, h / 2, h / 3, '#f42a41');
    },
  ],
  [
    'ca',
    'Canada',
    (c, w, h) => {
      c.fillStyle = '#ffffff';
      c.fillRect(0, 0, w, h);
      c.fillStyle = '#ff0000';
      c.fillRect(0, 0, w / 4, h);
      c.fillRect((3 * w) / 4, 0, w / 4 + 1, h);
      part(c, 'ca', CA_ART, w / 2, 0.503 * h, 0.388 * Math.min(w, 2 * h));
    },
  ],
  [
    'mx',
    'Mexico',
    (c, w, h) => {
      pales(c, w, h, MX_PALES);
      part(c, 'mx', MX_ART, w / 2, h / 2, 0.25 * Math.min(w, 1.75 * h));
    },
    (c, w, h) => {
      // The vertical flag: green at the top and the arms upright in the white band.
      flipped(c, w, h, (f, fw, fh) => {
        pales(f, fw, fh, MX_PALES);
      });
      part(c, 'mx', MX_ART, w / 2, h / 2, fitWidth('mx', MX_ART, 0.7 * w, 0.28 * h));
    },
  ],
  ['vn', 'Vietnam', vietnam, vietnam],
  [
    'kh',
    'Cambodia',
    (c, w, h) => {
      stripes(c, w, h, [
        ['#032ea1', 1],
        ['#e00025', 2],
        ['#032ea1', 1],
      ]);
      part(c, 'kh', KH_ART, w / 2, h / 2, 0.415 * Math.min(w, 1.5625 * h));
    },
    (c, w, h) => {
      // The vertical flag has narrower blue stripes, so the temple stays upright in the red.
      flipped(c, w, h, (f, fw, fh) => {
        stripes(f, fw, fh, [
          ['#032ea1', 1],
          ['#e00025', 3],
          ['#032ea1', 1],
        ]);
      });
      part(c, 'kh', KH_ART, w / 2, h / 2, fitWidth('kh', KH_ART, 0.54 * w, 0.3 * h));
    },
  ],
  [
    'la',
    'Laos',
    (c, w, h) => {
      stripes(c, w, h, [
        ['#ce1126', 1],
        ['#002868', 2],
        ['#ce1126', 1],
      ]);
      disc(c, w / 2, h / 2, 0.2 * h, '#ffffff');
    },
  ],
  [
    'kp',
    'North Korea',
    (c, w, h) => {
      stripes(c, w, h, KP_STRIPES);
      const x = Math.min(w / 3, (2 * h) / 3);
      disc(c, x, h / 2, 0.24 * h, '#ffffff');
      star(c, x, h / 2, 0.23 * h, '#ed1c27');
    },
    (c, w, h) => {
      // The vertical flag turns the stripes and keeps the star upright.
      flipped(c, w, h, (f, fw, fh) => {
        stripes(f, fw, fh, KP_STRIPES);
      });
      const y = Math.min(h / 3, (2 * w) / 3);
      disc(c, w / 2, y, 0.24 * w, '#ffffff');
      star(c, w / 2, y, 0.23 * w, '#ed1c27');
    },
  ],
  [
    'kr',
    'South Korea',
    (c, w, h) => {
      c.fillStyle = '#ffffff';
      c.fillRect(0, 0, w, h);
      const r = h / 4;
      c.save();
      c.translate(w / 2, h / 2);
      c.rotate(Math.atan2(h, w));
      c.fillStyle = '#cd2e3a';
      c.beginPath();
      c.arc(0, 0, r, Math.PI, 0);
      c.fill();
      c.fillStyle = '#0047a0';
      c.beginPath();
      c.arc(0, 0, r, 0, Math.PI);
      c.fill();
      disc(c, -r / 2, 0, r / 2, '#cd2e3a');
      disc(c, r / 2, 0, r / 2, '#0047a0');
      c.restore();
      const bar = r / 6;
      for (const [sx, sy, bars] of [
        [-1, -1, [true, true, true]],
        [1, 1, [false, false, false]],
        [1, -1, [false, true, false]],
        [-1, 1, [true, false, true]],
      ] as const) {
        c.save();
        c.translate(w / 2 + sx * (w / 2 - 0.22 * w), h / 2 + sy * (h / 2 - 0.22 * h));
        c.rotate(Math.atan2(sy * h, sx * w) + Math.PI / 2);
        c.fillStyle = '#000000';
        for (const [i, solid] of bars.entries()) {
          const y = (i - 1) * 1.5 * bar - bar / 2;
          if (solid) {
            c.fillRect(-r / 2, y, r, bar);
          } else {
            c.fillRect(-r / 2, y, 0.45 * r, bar);
            c.fillRect(0.05 * r, y, 0.45 * r, bar);
          }
        }
        c.restore();
      }
    },
  ],
  [
    'tw',
    'Taiwan',
    (c, w, h) => {
      c.fillStyle = '#fe0000';
      c.fillRect(0, 0, w, h);
      rocCanton(c, w / 2, h / 2);
    },
    (c, w, h) => {
      // The vertical flag: the canton keeps its form across the top.
      c.fillStyle = '#fe0000';
      c.fillRect(0, 0, w, h);
      rocCanton(c, w, Math.min((2 * w) / 3, h / 2));
    },
  ],
  [
    'tr',
    'Türkiye',
    (c, w, h) => {
      c.fillStyle = '#e30a17';
      c.fillRect(0, 0, w, h);
      const x = Math.min(0.5 * h, w / 3);
      crescent(c, x, h / 2, 0.25 * h, '#ffffff', '#e30a17');
      star(c, x + 0.36 * h, h / 2, 0.125 * h, '#ffffff', 5, -Math.PI / 2);
    },
  ],
  [
    'za',
    'South Africa',
    (c, w, h) => {
      bands(c, w, h, ['#e03c31', '#001489']);
      const jx = Math.min(0.4 * w, 0.6 * h);
      c.lineCap = 'butt';
      c.lineJoin = 'miter';
      for (const [color, width] of [
        ['#ffffff', h / 3],
        ['#007749', h / 5],
      ] as const) {
        stroke(c, color, width, [
          [-0.2 * jx, -0.1 * h],
          [jx, h / 2],
          [-0.2 * jx, 1.1 * h],
        ]);
        stroke(c, color, width, [
          [0.5 * jx, h / 2],
          [w, h / 2],
        ]);
      }
      const len = Math.hypot(jx, h / 2);
      const triangle = (d: number): [number, number][] => [
        [0, (d * len) / jx],
        [jx - (d * len) / (h / 2), h / 2],
        [0, h - (d * len) / jx],
      ];
      polygon(c, '#ffb612', triangle(h / 10));
      polygon(c, '#000000', triangle(h / 10 + h / 24));
    },
  ],
  [
    'ar',
    'Argentina',
    (c, w, h) => {
      bands(c, w, h, AR_BANDS);
      part(c, 'ar', AR_ART, w / 2, h / 2, 0.175 * Math.min(w, 1.6 * h));
    },
    (c, w, h) => {
      // The Sun of May stays upright.
      flipped(c, w, h, (f, fw, fh) => {
        bands(f, fw, fh, AR_BANDS);
      });
      part(c, 'ar', AR_ART, w / 2, h / 2, 0.28 * Math.min(w, h / 1.6));
    },
  ],
  [
    'ie',
    'Ireland',
    (c, w, h) => {
      pales(c, w, h, ['#169b62', '#ffffff', '#ff883e']);
    },
  ],
  [
    'be',
    'Belgium',
    (c, w, h) => {
      pales(c, w, h, ['#000000', '#fdda24', '#ef3340']);
    },
  ],
  [
    'gr',
    'Greece',
    (c, w, h) => {
      for (let i = 0; i < 9; i++) {
        c.fillStyle = i % 2 === 0 ? '#0d5eaf' : '#ffffff';
        c.fillRect(0, (i * h) / 9, w, h / 9 + 1);
      }
      const s = Math.min((5 * h) / 9, w / 2);
      c.fillStyle = '#0d5eaf';
      c.fillRect(0, 0, s, (5 * h) / 9);
      c.fillStyle = '#ffffff';
      c.fillRect((2 * s) / 5, 0, s / 5, (5 * h) / 9);
      c.fillRect(0, (2 * h) / 9, s, h / 9);
    },
  ],
  [
    'mn',
    'Mongolia',
    (c, w, h) => {
      pales(c, w, h, MN_PALES);
      part(c, 'mn', MN_ART, w / 6, 0.476 * h, fitWidth('mn', MN_ART, (0.8 * w) / 3, 0.75 * h));
    },
    (c, w, h) => {
      // The Soyombo stays upright in the top stripe.
      flipped(c, w, h, (f, fw, fh) => {
        pales(f, fw, fh, MN_PALES);
      });
      part(c, 'mn', MN_ART, w / 2, h / 6, fitWidth('mn', MN_ART, 0.8 * w, 0.28 * h));
    },
  ],
  [
    'pt',
    'Portugal',
    portugal,
    (c, w, h) => {
      // The flag turns a quarter turn with its arms.
      c.save();
      c.translate(w, 0);
      c.rotate(Math.PI / 2);
      portugal(c, h, w);
      c.restore();
    },
  ],
  [
    'ro',
    'Romania',
    (c, w, h) => {
      pales(c, w, h, ['#002b7f', '#fcd116', '#ce1126']);
    },
  ],
  [
    'co',
    'Colombia',
    (c, w, h) => {
      stripes(c, w, h, [
        ['#fcd116', 2],
        ['#003893', 1],
        ['#ce1126', 1],
      ]);
    },
  ],
  [
    'es',
    'Spain',
    (c, w, h) => {
      stripes(c, w, h, ES_STRIPES);
      const u = Math.min(w, 1.5 * h);
      part(c, 'es', ES_ART, u / 3, h / 2, 0.245 * u);
    },
    (c, w, h) => {
      // The arms stay upright in the yellow stripe, near the hoist at the top.
      flipped(c, w, h, (f, fw, fh) => {
        stripes(f, fw, fh, ES_STRIPES);
      });
      part(
        c,
        'es',
        ES_ART,
        w / 2,
        Math.min(h, 1.5 * w) / 3,
        fitWidth('es', ES_ART, 0.45 * w, 0.3 * h),
      );
    },
  ],
  [
    'ch',
    'Switzerland',
    (c, w, h) => {
      c.fillStyle = '#da291c';
      c.fillRect(0, 0, w, h);
      const u = Math.min(w, h);
      c.fillStyle = '#ffffff';
      c.fillRect(w / 2 - (3 / 32) * u, h / 2 - (10 / 32) * u, (6 / 32) * u, (20 / 32) * u);
      c.fillRect(w / 2 - (10 / 32) * u, h / 2 - (3 / 32) * u, (20 / 32) * u, (6 / 32) * u);
    },
  ],
  [
    'va',
    'Vatican City',
    (c, w, h) => {
      pales(c, w, h, VA_PALES);
      part(c, 'va', VA_ART, 0.751 * w, 0.507 * h, 0.352 * Math.min(w, h));
    },
    (c, w, h) => {
      // The vertical flag: yellow at the top and the keys upright in the white half.
      flipped(c, w, h, (f, fw, fh) => {
        pales(f, fw, fh, VA_PALES);
      });
      part(c, 'va', VA_ART, w / 2, 0.75 * h, fitWidth('va', VA_ART, 0.7 * w, 0.4 * h));
    },
  ],
  [
    'se',
    'Sweden',
    (c, w, h) => {
      nordic(c, w, h, '#006aa7', [['#fecc02', 0.2]], 6 / 16);
    },
  ],
  [
    'no',
    'Norway',
    (c, w, h) => {
      nordic(
        c,
        w,
        h,
        '#ba0c2f',
        [
          ['#ffffff', 0.25],
          ['#00205b', 0.125],
        ],
        8 / 22,
      );
    },
  ],
  [
    'dk',
    'Denmark',
    (c, w, h) => {
      nordic(c, w, h, '#c8102e', [['#ffffff', 4 / 28]], 14 / 37);
    },
  ],
  [
    'pe',
    'Peru',
    (c, w, h) => {
      pales(c, w, h, ['#d91023', '#ffffff', '#d91023']);
    },
  ],
  [
    'sa',
    'Saudi Arabia',
    (c, w, h) => {
      c.fillStyle = '#005430';
      c.fillRect(0, 0, w, h);
      part(c, 'sa', SA_ART, w / 2, 0.497 * h, Math.min(0.5 * w, 0.75 * h));
    },
    (c, w, h) => {
      // The Shahada and the sword stay upright and readable.
      c.fillStyle = '#005430';
      c.fillRect(0, 0, w, h);
      part(c, 'sa', SA_ART, w / 2, 0.495 * h, fitWidth('sa', SA_ART, 0.74 * w, 0.45 * h));
    },
  ],
  [
    'my',
    'Malaysia',
    (c, w, h) => {
      for (let i = 0; i < 14; i++) {
        c.fillStyle = i % 2 === 0 ? '#cc0001' : '#ffffff';
        c.fillRect(0, (i * h) / 14, w, h / 14 + 1);
      }
      const ch = (8 / 14) * h;
      const cw = w / 2;
      c.fillStyle = '#010066';
      c.fillRect(0, 0, cw, ch);
      const r = 0.38 * ch;
      const x = Math.min(cw / 2, ch) - 0.25 * r;
      crescent(c, x, ch / 2, r, '#ffcc00', '#010066');
      star(c, x + 1.15 * r, ch / 2, 0.55 * r, '#ffcc00', 14);
    },
    (c, w, h) => {
      // The vertical flag: the canton across the top, the crescent open to the top, and the star
      // above it.
      for (let i = 0; i < 14; i++) {
        c.fillStyle = i % 2 === 0 ? '#cc0001' : '#ffffff';
        c.fillRect((i * w) / 14, 0, w / 14 + 1, h);
      }
      const ch = Math.min((8 / 14) * h, 1.75 * w);
      c.fillStyle = '#010066';
      c.fillRect(0, 0, w, ch);
      const u = Math.min(w, ch / 1.75);
      const top = (ch - 1.75 * u) / 2;
      disc(c, w / 2, top + 1.033 * u, 0.375 * u, '#ffcc00');
      disc(c, w / 2, top + 0.937 * u, 0.333 * u, '#010066');
      star(c, w / 2, top + 0.657 * u, 0.312 * u, '#ffcc00', 14);
    },
  ],
  [
    'bn',
    'Brunei',
    (c, w, h) => {
      bruneiField(c, w, h);
      part(c, 'bn', BN_ART, w / 2, h / 2, 0.36 * Math.min(w, 2 * h), { keys: BN_KEYS });
    },
    (c, w, h) => {
      // The bands turn, and the crest stays upright.
      flipped(c, w, h, bruneiField);
      part(c, 'bn', BN_ART, w / 2, h / 2, fitWidth('bn', BN_ART, 0.75 * w, 0.6 * h), {
        keys: BN_KEYS,
      });
    },
  ],
  ['ir', 'Iran', iran, iran],
  [
    'ph',
    'Philippines',
    (c, w, h) => {
      bands(c, w, h, ['#0038a8', '#ce1126']);
      const tip = Math.min(0.866 * h, w / 2);
      polygon(c, '#ffffff', [
        [0, 0],
        [tip, h / 2],
        [0, h],
      ]);
      const gold = '#fcd116';
      part(c, 'ph', PH_SUN, 0.358 * tip, h / 2, 0.494 * tip, { round: true });
      for (const [sx, sy] of [
        [0.09 * h, 0.09 * h],
        [0.09 * h, 0.91 * h],
        [tip - 0.13 * h, h / 2],
      ] as const) {
        star(c, sx, sy, 0.045 * h, gold);
      }
    },
  ],
  [
    've',
    'Venezuela',
    (c, w, h) => {
      bands(c, w, h, VE_BANDS);
      for (let i = 0; i < 8; i++) {
        const a = ((i - 3.5) * 2 * Math.PI) / 18;
        star(
          c,
          w / 2 + 0.3 * h * Math.sin(a),
          0.72 * h - 0.3 * h * Math.cos(a),
          0.035 * h,
          '#ffffff',
        );
      }
    },
    (c, w, h) => {
      // The arc turns with the stripes, and each star stays upright.
      flipped(c, w, h, (f, fw, fh) => {
        bands(f, fw, fh, VE_BANDS);
      });
      for (let i = 0; i < 8; i++) {
        const a = ((i - 3.5) * 2 * Math.PI) / 18;
        star(
          c,
          0.72 * w - 0.3 * w * Math.cos(a),
          h / 2 + 0.3 * w * Math.sin(a),
          0.035 * w,
          '#ffffff',
        );
      }
    },
  ],
  [
    'pl',
    'Poland',
    (c, w, h) => {
      bands(c, w, h, ['#ffffff', '#dc143c']);
    },
  ],
  ['asean', 'ASEAN', asean, asean],
  ['qmark', 'Question Mark (?)', questionMark, questionMark],
  ['eu', 'European Union', europe, europe],
];

/** The other names of a flag that the search of the menu finds. */
const ALIASES = new Map([
  ['ae', 'UAE Emirates'],
  ['asean', 'Association of Southeast Asian Nations'],
  ['ch', 'Swiss'],
  ['cn', 'PRC'],
  ['eu', 'EU Europe'],
  ['gb', 'UK Britain England'],
  ['kp', 'DPRK'],
  ['kr', 'ROK Korea'],
  ['la', 'Lao'],
  ['nl', 'Holland'],
  ['qmark', 'Unknown Mystery'],
  ['tr', 'Turkey Turkiye'],
  ['us', 'USA America'],
  ['va', 'Holy See'],
  ['za', 'RSA'],
]);

/** The built-in flags, in the order of the menu: the code, the name, and the other names. */
export const COUNTRY_FLAGS: readonly (readonly [string, string, string])[] = FLAGS.map(
  ([code, name]): readonly [string, string, string] => [code, name, ALIASES.get(code) ?? ''],
).toSorted((a, b) => a[1].localeCompare(b[1]));

/**
 * Gives the name of a built-in flag.
 *
 * @param code The code of the flag.
 * @returns The name, or the code for an unknown flag.
 */
export function flagName(code: string): string {
  return FLAGS.find(([id]) => id === code)?.[1] ?? code.toUpperCase();
}

/** The aspect of a flag on a pole, as the height over the width. */
export const FLAG_ASPECT = 2 / 3;

/**
 * Draws a built-in flag on a new canvas.
 *
 * @param code The code of the flag. An unknown code gives a plain white cloth.
 * @param width The width of the canvas, in pixels.
 * @param height The height of the canvas, in pixels.
 * @param upright True for a banner that hangs from its hoist. A flag with a vertical design shows
 *   it. Another flag turns so that its hoist is at the top and its top edge at the left of the
 *   viewer, as a flag that hangs on a wall.
 * @returns The canvas.
 */
export function drawFlag(
  code: string,
  width: number,
  height: number,
  upright: boolean,
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width));
  canvas.height = Math.max(1, Math.round(height));
  const context = canvas.getContext('2d');
  if (!context) {
    return canvas;
  }
  const entry = FLAGS.find(([id]) => id === code);
  const draw = entry?.[2];
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  if (!entry || !draw) {
    return canvas;
  }
  const vertical = entry[3];
  if (upright && vertical) {
    vertical(context, canvas.width, canvas.height);
  } else if (upright) {
    flipped(context, canvas.width, canvas.height, draw);
  } else {
    draw(context, canvas.width, canvas.height);
  }
  return canvas;
}
