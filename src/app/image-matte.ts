/**
 * The matte of an image of the user (design 4.5, images of the user). Many logo files have no
 * alpha: their "transparent" background is a baked grey and white checkerboard, or plain white.
 * This step finds such a light, neutral background along the border of the image and makes it
 * transparent, so the cloth, the screen, and the folder show around the logo. A checkerboard also
 * goes where the logo encloses it, because its grid of tiles tells it from a white part of the
 * logo.
 */

/** The limits of the matte. */
const MATTE = {
  /** The largest alpha that counts as a real transparent pixel. */
  realAlpha: 250,
  /** The largest spread of the red, the green, and the blue of a neutral pixel. */
  chroma: 18,
  /** The smallest grey level of the background. */
  light: 170,
  /** The smallest part of the border that must be light and neutral. */
  border: 0.9,
  /** The margin of the grey levels of the background past those of the border. */
  margin: 14,
  /** The distance from the background at which an edge pixel is fully opaque. */
  soft: 48,
  /** The smallest step between the two grey levels of a checkerboard. */
  checkerStep: 16,
  /** The smallest tile of a checkerboard, in pixels. */
  minTile: 2,
  /** The smallest part of the tile edges along the border that must fit the grid. */
  gridFit: 0.85,
  /** The distance from a tile edge, in pixels, inside which any grey of the board counts. */
  seam: 1.25,
} as const;

/** The grid of a baked checkerboard: the tile side, the offsets, and the two grey levels. */
interface Checker {
  readonly tile: number;
  readonly x0: number;
  readonly y0: number;
  /** The level of the tiles with an even sum of the tile indices. */
  readonly even: number;
  /** The level of the tiles with an odd sum of the tile indices. */
  readonly odd: number;
}

/**
 * Gives the grey level of a pixel.
 *
 * @param data The RGBA pixels.
 * @param i The index of the first byte of the pixel.
 * @returns The grey level, 0 to 255.
 */
function greyOf(data: Uint8ClampedArray, i: number): number {
  return ((data[i] ?? 0) + (data[i + 1] ?? 0) + (data[i + 2] ?? 0)) / 3;
}

/**
 * Gives the spread of the red, the green, and the blue of a pixel.
 *
 * @param data The RGBA pixels.
 * @param i The index of the first byte of the pixel.
 * @returns The spread, 0 to 255.
 */
function spreadOf(data: Uint8ClampedArray, i: number): number {
  const r = data[i] ?? 0;
  const g = data[i + 1] ?? 0;
  const b = data[i + 2] ?? 0;
  return Math.max(r, g, b) - Math.min(r, g, b);
}

/**
 * Gives the distance of a pixel from the background: 0 for a pixel of the background.
 *
 * @param data The RGBA pixels.
 * @param i The index of the first byte of the pixel.
 * @param low The smallest grey level of the background.
 * @param high The largest grey level of the background.
 * @returns The distance, in levels of 0 to 255.
 */
function backgroundDistance(data: Uint8ClampedArray, i: number, low: number, high: number): number {
  const grey = greyOf(data, i);
  return Math.max(0, spreadOf(data, i) - MATTE.chroma, low - grey, grey - high);
}

/**
 * Gives the median of a list of numbers.
 *
 * @param values The numbers, at least one.
 * @returns The median.
 */
function median(values: readonly number[]): number {
  const sorted = values.toSorted((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] ?? 0;
}

/**
 * Finds the grid of a baked checkerboard from the border of an image.
 *
 * @param data The RGBA pixels.
 * @param width The width of the image.
 * @param height The height of the image.
 * @param low The smallest grey level of the border background.
 * @param high The largest grey level of the border background.
 * @returns The grid, or `null` when the border shows no checkerboard.
 */
function findChecker(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  low: number,
  high: number,
): Checker | null {
  if (high - low < MATTE.checkerStep) {
    return null;
  }
  const middle = (low + high) / 2;
  const lines = [
    { axis: 0, at: (k: number) => k, size: width },
    { axis: 0, at: (k: number) => (height - 1) * width + k, size: width },
    { axis: 1, at: (k: number) => k * width, size: height },
    { axis: 1, at: (k: number) => k * width + width - 1, size: height },
  ];

  // The tile edges along each border line: the places where a clean pixel of one level follows a
  // clean pixel of the other level.
  const edges: { axis: number; line: number; at: number }[] = [];
  const gaps: number[] = [];
  for (const [index, line] of lines.entries()) {
    let last = -1;
    let previous = -1;
    for (let k = 0; k < line.size; k++) {
      const i = 4 * line.at(k);
      const clean = backgroundDistance(data, i, low - MATTE.margin, high + MATTE.margin) === 0;
      const level = clean ? (greyOf(data, i) > middle ? 1 : 0) : -1;
      if (level < 0) {
        last = -1;
      } else if (previous >= 0 && level !== previous) {
        if (last >= 0) {
          gaps.push(k - last);
        }
        edges.push({ axis: line.axis, line: index, at: k });
        last = k;
      }
      previous = level;
    }
  }
  if (gaps.length < 4) {
    return null;
  }
  // The mean of the regular gaps, because a tile of a fractional side gives gaps of two lengths.
  const middleGap = median(gaps);
  const regular = gaps.filter((gap) => Math.abs(gap - middleGap) <= 0.3 * middleGap + 1);
  const rough = regular.reduce((a, b) => a + b, 0) / Math.max(1, regular.length);
  if (rough < MATTE.minTile) {
    return null;
  }

  // The tile side from a fit of the edges of each line to whole tiles, with an offset for each
  // line. A second pass counts the tiles again with the better side.
  let tile = rough;
  for (let pass = 0; pass < 2; pass++) {
    let top = 0;
    let bottom = 0;
    for (let index = 0; index < lines.length; index++) {
      const on = edges.filter((edge) => edge.line === index);
      const first = on[0]?.at ?? 0;
      const ks = on.map((edge) => Math.round((edge.at - first) / tile));
      const kMean = ks.reduce((a, b) => a + b, 0) / Math.max(1, ks.length);
      const tMean = on.reduce((a, edge) => a + edge.at, 0) / Math.max(1, on.length);
      for (const [j, edge] of on.entries()) {
        const k = (ks[j] ?? 0) - kMean;
        top += k * (edge.at - tMean);
        bottom += k * k;
      }
    }
    if (bottom > 0) {
      tile = top / bottom;
    }
  }
  if (tile < MATTE.minTile) {
    return null;
  }
  const offsets = [0, 1].map((axis) => {
    let c = 0;
    let s = 0;
    for (const edge of edges) {
      if (edge.axis === axis) {
        const angle = (2 * Math.PI * edge.at) / tile;
        c += Math.cos(angle);
        s += Math.sin(angle);
      }
    }
    const offset = (Math.atan2(s, c) / (2 * Math.PI)) * tile;
    return offset < 0 ? offset + tile : offset;
  });
  const x0 = offsets[0] ?? 0;
  const y0 = offsets[1] ?? 0;

  // The level of each parity, and the part of the edges that fits the grid.
  let fit = 0;
  for (const edge of edges) {
    const offset = edge.axis === 0 ? x0 : y0;
    const phase = (edge.at - offset) / tile;
    if (Math.abs(phase - Math.round(phase)) * tile <= Math.max(1, 0.15 * tile)) {
      fit++;
    }
  }
  if (fit < MATTE.gridFit * edges.length) {
    return null;
  }
  const sums = [0, 0];
  const counts = [0, 0];
  for (const line of lines) {
    for (let k = 0; k < line.size; k++) {
      const p = line.at(k);
      const x = p % width;
      const y = Math.floor(p / width);
      const parity = parityAt(x, y, tile, x0, y0, 0);
      if (parity >= 0) {
        const i = 4 * p;
        if (backgroundDistance(data, i, low - MATTE.margin, high + MATTE.margin) === 0) {
          sums[parity] = (sums[parity] ?? 0) + greyOf(data, i);
          counts[parity] = (counts[parity] ?? 0) + 1;
        }
      }
    }
  }
  const even = (sums[0] ?? 0) / Math.max(1, counts[0] ?? 0);
  const odd = (sums[1] ?? 0) / Math.max(1, counts[1] ?? 0);
  if (Math.abs(even - odd) < MATTE.checkerStep) {
    return null;
  }
  return { tile, x0, y0, even, odd };
}

/**
 * Gives the parity of the tile at a pixel, or -1 for a pixel on a tile edge.
 *
 * @param x The column of the pixel.
 * @param y The row of the pixel.
 * @param tile The tile side.
 * @param x0 The offset of the grid along x.
 * @param y0 The offset of the grid along y.
 * @param edge The distance from a tile edge, in pixels, that counts as on the edge.
 * @returns 0 for an even tile, 1 for an odd tile, or -1 on an edge.
 */
function parityAt(
  x: number,
  y: number,
  tile: number,
  x0: number,
  y0: number,
  edge: number = MATTE.seam,
): number {
  const u = (x + 0.5 - x0) / tile;
  const v = (y + 0.5 - y0) / tile;
  const seam = edge / tile;
  const nearU = Math.abs(u - Math.round(u)) < seam;
  const nearV = Math.abs(v - Math.round(v)) < seam;
  if (nearU || nearV) {
    return -1;
  }
  return (((Math.floor(u) + Math.floor(v)) % 2) + 2) % 2;
}

/**
 * Makes a baked light background of an image transparent. An image that has real transparent
 * pixels, or a border that is not light and neutral, stays as it is. A plain background goes where
 * it touches the border, so the white parts inside a logo stay. A checkerboard also goes where
 * the logo encloses it.
 *
 * @param data The RGBA pixels, which the step changes in place.
 * @param width The width of the image.
 * @param height The height of the image.
 * @returns True when the step made a part of the image transparent.
 */
export function clearBakedBackground(
  data: Uint8ClampedArray,
  width: number,
  height: number,
): boolean {
  const count = width * height;
  if (width < 3 || height < 3 || data.length < 4 * count) {
    return false;
  }
  for (let p = 0; p < count; p++) {
    if ((data[4 * p + 3] ?? 255) < MATTE.realAlpha) {
      return false;
    }
  }

  const border: number[] = [];
  for (let x = 0; x < width; x++) {
    border.push(x, (height - 1) * width + x);
  }
  for (let y = 1; y < height - 1; y++) {
    border.push(y * width, y * width + width - 1);
  }
  let low = 255;
  let high = 0;
  let light = 0;
  for (const p of border) {
    if (backgroundDistance(data, 4 * p, MATTE.light, 255) === 0) {
      const grey = greyOf(data, 4 * p);
      low = Math.min(low, grey);
      high = Math.max(high, grey);
      light++;
    }
  }
  if (light < MATTE.border * border.length) {
    return false;
  }
  const checker = findChecker(data, width, height, low, high);
  low = Math.max(MATTE.light, low - MATTE.margin);
  high = Math.min(255, high + MATTE.margin);

  // The pixels that can be background. On a checkerboard, a pixel must have the level of its tile.
  // A pixel on a tile edge, where the levels mix, counts only between tiles of both levels, so a
  // white part of the logo does not join the board through the edges of its tiles.
  const level = new Int8Array(count).fill(-1);
  const candidate = new Uint8Array(count);
  const seams: number[] = [];
  for (let p = 0; p < count; p++) {
    const i = 4 * p;
    if (backgroundDistance(data, i, low, high) > 0) {
      continue;
    }
    if (!checker) {
      candidate[p] = 1;
      continue;
    }
    const parity = parityAt(p % width, Math.floor(p / width), checker.tile, checker.x0, checker.y0);
    if (parity < 0) {
      seams.push(p);
    } else if (
      Math.abs(greyOf(data, i) - (parity === 0 ? checker.even : checker.odd)) <= MATTE.margin
    ) {
      candidate[p] = 1;
      level[p] = parity;
    }
  }
  const reach = Math.ceil(MATTE.seam) + 1;
  for (const p of seams) {
    const x = p % width;
    const y = Math.floor(p / width);
    let even = false;
    let odd = false;
    for (let dy = -reach; dy <= reach && !(even && odd); dy++) {
      for (let dx = -reach; dx <= reach; dx++) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
          const l = level[ny * width + nx] ?? -1;
          even ||= l === 0;
          odd ||= l === 1;
        }
      }
    }
    const edge = x === 0 || y === 0 || x === width - 1 || y === height - 1;
    if ((even && odd) || edge) {
      candidate[p] = 1;
    }
  }

  // The regions of the candidates. A region goes when it touches the border, or when it holds
  // half a tile or more of each level of the checkerboard.
  const background = new Uint8Array(count);
  const seen = new Uint8Array(count);
  const stack = new Int32Array(count);
  const region: number[] = [];
  const enough = checker ? 0.5 * checker.tile * checker.tile : Infinity;
  for (let start = 0; start < count; start++) {
    if (candidate[start] === 0 || seen[start] === 1) {
      continue;
    }
    region.length = 0;
    let touches = false;
    const levels = [0, 0];
    let top = 0;
    seen[start] = 1;
    stack[top++] = start;
    while (top > 0) {
      const p = stack[--top] ?? 0;
      region.push(p);
      const x = p % width;
      const y = Math.floor(p / width);
      if (x === 0 || y === 0 || x === width - 1 || y === height - 1) {
        touches = true;
      }
      const l = level[p] ?? -1;
      if (l >= 0) {
        levels[l] = (levels[l] ?? 0) + 1;
      }
      const next = [x > 0 ? p - 1 : -1, x < width - 1 ? p + 1 : -1, p - width, p + width];
      for (const q of next) {
        if (q >= 0 && q < count && candidate[q] === 1 && seen[q] === 0) {
          seen[q] = 1;
          stack[top++] = q;
        }
      }
    }
    if (touches || ((levels[0] ?? 0) >= enough && (levels[1] ?? 0) >= enough)) {
      for (const p of region) {
        background[p] = 1;
      }
    }
  }

  // The edge pixels next to the background get a soft alpha, and their color loses the part of
  // the background that the antialiasing mixed in.
  let cleared = 0;
  const edge = new Float32Array(count).fill(1);
  for (let p = 0; p < count; p++) {
    if (background[p] === 1) {
      cleared++;
      continue;
    }
    const x = p % width;
    const y = Math.floor(p / width);
    let near = 0;
    let sum = 0;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx;
        const ny = y + dy;
        const q = ny * width + nx;
        if (nx >= 0 && nx < width && ny >= 0 && ny < height && background[q] === 1) {
          near++;
          sum += greyOf(data, 4 * q);
        }
      }
    }
    if (near > 0) {
      const alpha = Math.min(1, backgroundDistance(data, 4 * p, low, high) / MATTE.soft);
      edge[p] = alpha;
      if (alpha > 0) {
        const behind = sum / near;
        for (let c = 0; c < 3; c++) {
          const value = data[4 * p + c] ?? 0;
          data[4 * p + c] = (value - (1 - alpha) * behind) / alpha;
        }
      }
    }
  }
  if (cleared === 0) {
    return false;
  }
  for (let p = 0; p < count; p++) {
    data[4 * p + 3] = background[p] === 1 ? 0 : Math.round(255 * (edge[p] ?? 1));
  }
  return true;
}
