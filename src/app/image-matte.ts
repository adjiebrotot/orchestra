/**
 * The matte of an image of the user (design 4.5, images of the user). Many logo files have no
 * alpha: their "transparent" background is a baked grey and white checkerboard, or plain white.
 * This step finds such a light, neutral background along the border of the image and makes it
 * transparent, so the cloth, the screen, and the folder show around the logo.
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
} as const;

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
  const r = data[i] ?? 0;
  const g = data[i + 1] ?? 0;
  const b = data[i + 2] ?? 0;
  const spread = Math.max(r, g, b) - Math.min(r, g, b);
  const grey = (r + g + b) / 3;
  return Math.max(0, spread - MATTE.chroma, low - grey, grey - high);
}

/**
 * Makes a baked light background of an image transparent. An image that has real transparent
 * pixels, or a border that is not light and neutral, stays as it is. Only the background that
 * touches the border goes, so the white parts inside a logo stay.
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
      const grey = ((data[4 * p] ?? 0) + (data[4 * p + 1] ?? 0) + (data[4 * p + 2] ?? 0)) / 3;
      low = Math.min(low, grey);
      high = Math.max(high, grey);
      light++;
    }
  }
  if (light < MATTE.border * border.length) {
    return false;
  }
  low = Math.max(MATTE.light, low - MATTE.margin);
  high = Math.min(255, high + MATTE.margin);

  // A flood fill from the border through the pixels of the background.
  const background = new Uint8Array(count);
  const stack = new Int32Array(count);
  let top = 0;
  for (const p of border) {
    if (background[p] === 0 && backgroundDistance(data, 4 * p, low, high) === 0) {
      background[p] = 1;
      stack[top++] = p;
    }
  }
  while (top > 0) {
    const p = stack[--top] ?? 0;
    const x = p % width;
    const next = [x > 0 ? p - 1 : -1, x < width - 1 ? p + 1 : -1, p - width, p + width];
    for (const q of next) {
      if (q >= 0 && q < count && background[q] === 0) {
        if (backgroundDistance(data, 4 * q, low, high) === 0) {
          background[q] = 1;
          stack[top++] = q;
        }
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
          sum += ((data[4 * q] ?? 0) + (data[4 * q + 1] ?? 0) + (data[4 * q + 2] ?? 0)) / 3;
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
