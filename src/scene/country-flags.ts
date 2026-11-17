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

/** The flags, by their ISO 3166 code, with the name of the menu and the drawer. */
const FLAGS: readonly (readonly [string, string, FlagDrawer])[] = [
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
  ],
  [
    'gb',
    'United Kingdom',
    (c, w, h) => {
      unionJack(c, w, h);
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
];

/** The built-in flags, in the order of the menu: the code and the name. */
export const COUNTRY_FLAGS: readonly (readonly [string, string])[] = FLAGS.map(([code, name]) => [
  code,
  name,
]);

/**
 * Gives the name of a built-in flag.
 *
 * @param code The ISO 3166 code.
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
 * @param code The ISO 3166 code. An unknown code gives a plain white cloth.
 * @param width The width of the canvas, in pixels.
 * @param height The height of the canvas, in pixels.
 * @param upright True for a banner that hangs from its hoist: the flag turns so that its hoist is
 *   at the top and its top edge at the left of the viewer, as a flag that hangs on a wall.
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
  const draw = FLAGS.find(([id]) => id === code)?.[2];
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  if (!draw) {
    return canvas;
  }
  if (upright) {
    // The flag x goes down the canvas and the flag y goes to the right.
    context.setTransform(0, 1, 1, 0, 0, 0);
    draw(context, canvas.height, canvas.width);
  } else {
    draw(context, canvas.width, canvas.height);
  }
  return canvas;
}
