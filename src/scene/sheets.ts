import { BufferAttribute, BufferGeometry, CanvasTexture, Mesh, SRGBColorSpace } from 'three';
import type { MeshStandardMaterial } from 'three';

import { SCENE_COLORS } from '../models/colors.ts';
import type { SceneLayout } from '../models/layout.ts';
import { FINISH_ORDER } from '../models/mesh.ts';
import type { SheetMusic, SheetSet } from '../models/stage.ts';
import { MIDDLE_STEP, engravePart, engraveScore, partLabel } from '../score/engrave.ts';
import type { Bar, BarEvent, Clef, Part, Staff } from '../score/engrave.ts';
import type { Score, SectionId } from '../score/types.ts';

/**
 * The printed music on the sheets of the stands, on the desk of each piano, and on the score of
 * the conductor (design 4.5, sheet music). Each sheet prints the real part of its readers from
 * the score (`score/engrave.ts`), under the title and the subtitle of the render panel. All the
 * pages share one canvas texture, an atlas, that the scene draws at the build and again at each
 * change of the titles. The texture holds no file.
 */
const SHEET_PRINT = {
  /** The pixels for each meter of a sheet, before the atlas shrinks to its largest height. */
  pixelsPerMeter: 1100,
  /** The width of the atlas, in pixels. */
  atlasWidth: 2048,
  /** The largest height of the atlas, in pixels. */
  atlasHeight: 4096,
  /** The white gap around each page in the atlas, in pixels, so the mip levels do not mix pages. */
  gutter: 4,
  /** The margin of a page at each side, as a part of its width. */
  margin: 0.06,
  /** The systems of a stand part with one staff. A grand staff gets half of them. */
  partLines: 4,
  /** The bar slots of a system on a stand or a piano desk. */
  barsPerLine: 4,
  /** The bars of a page of the conductor score. */
  scoreBars: 3,
  /** The color of the ink, in sRGB. The paper color comes from the faces of the sheet. */
  ink: '#2f2a25',
  /** The color of the paper in the texture: white, so the sheet keeps its face color. */
  paper: '#ffffff',
  /** The font of the titles and the numbers. */
  serif: 'Georgia, "Times New Roman", serif',
} as const;

/** The texture points of the corners of the two triangles of a sheet. */
const SHEET_UVS = [0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1] as const;

/** The corners of the two triangles of a sheet, as indices of its four corners. */
const SHEET_TRIANGLES = [0, 1, 2, 0, 2, 3] as const;

/** The short names of the sections at the staves of the conductor score. */
const SHORT_NAME: Readonly<Record<SectionId, string>> = {
  violin: 'Vln.',
  viola: 'Vla.',
  cello: 'Vc.',
  contrabass: 'Cb.',
  harp: 'Hp.',
  piano: 'Pno.',
  flute: 'Fl.',
  oboe: 'Ob.',
  clarinet: 'Cl.',
  bassoon: 'Bsn.',
  horn: 'Hn.',
  trumpet: 'Tpt.',
  trombone: 'Tbn.',
  tuba: 'Tba.',
  timpani: 'Timp.',
  percussion: 'Perc.',
  choir: 'Ch.',
  'sound-only': '',
};

/** The sections whose desks share one part for the whole seat. */
const STRING_SECTIONS: ReadonlySet<SectionId> = new Set(['violin', 'viola', 'cello', 'contrabass']);

/** The title and the subtitle at the top of the first page (the fields of the render panel). */
export interface SheetTitles {
  readonly title: string;
  readonly subtitle: string;
}

/** The music of one page, ready to draw. */
type PageMusic =
  | {
      readonly kind: 'part';
      readonly part: Part;
      /** The number of systems on the page. */
      readonly lines: number;
    }
  | {
      readonly kind: 'score';
      /** The parts of the seats, one system of all of them. */
      readonly parts: readonly Part[];
      /** The short name at the left of each part. */
      readonly names: readonly string[];
      /** True for the left page, which carries the titles. */
      readonly titled: boolean;
    };

/** One page in the atlas. */
interface Page {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly music: PageMusic;
}

/** The pen of one staff: the context, the staff gap, and the top line. */
interface Pen {
  readonly c: CanvasRenderingContext2D;
  /** The gap between two lines of the staff, in pixels. */
  readonly g: number;
  /** The y of the top line of the staff. */
  readonly top: number;
  readonly clef: Clef;
}

/**
 * Gives the y of a step on a staff.
 *
 * @param pen The pen of the staff.
 * @param step The diatonic step.
 * @returns The y, in pixels.
 */
function stepY(pen: Pen, step: number): number {
  return pen.top + 2 * pen.g - ((step - MIDDLE_STEP[pen.clef]) * pen.g) / 2;
}

/**
 * Strokes a path of points, each as x and y in staff gaps from an origin.
 *
 * @param pen The pen.
 * @param x The x of the origin.
 * @param y The y of the origin.
 * @param width The line width in staff gaps.
 * @param points The points.
 */
function strokeLine(pen: Pen, x: number, y: number, width: number, points: number[]): void {
  const { c, g } = pen;
  c.lineWidth = width * g;
  c.beginPath();
  for (let i = 0; i < points.length; i += 2) {
    c.lineTo(x + (points[i] ?? 0) * g, y + (points[i + 1] ?? 0) * g);
  }
  c.stroke();
}

/**
 * Fills a dot.
 *
 * @param pen The pen.
 * @param x The x of the middle.
 * @param y The y of the middle.
 * @param radius The radius in staff gaps.
 */
function dot(pen: Pen, x: number, y: number, radius: number): void {
  pen.c.beginPath();
  pen.c.arc(x, y, radius * pen.g, 0, 2 * Math.PI);
  pen.c.fill();
}

/**
 * Draws a clef at the start of a staff.
 *
 * @param pen The pen.
 * @param x The left of the clef.
 */
function drawClef(pen: Pen, x: number): void {
  const { c, g, top } = pen;
  if (pen.clef === 'treble') {
    const cx = x + 1.1 * g;
    const gy = top + 3 * g;
    c.lineWidth = 0.2 * g;
    c.beginPath();
    c.arc(cx, gy + 0.05 * g, 0.85 * g, -0.1 * Math.PI, 1.55 * Math.PI);
    c.quadraticCurveTo(cx + 0.9 * g, gy - 2.6 * g, cx + 0.5 * g, gy - 4.3 * g);
    c.quadraticCurveTo(cx - 0.4 * g, gy - 3.4 * g, cx + 0.05 * g, gy - 2.2 * g);
    c.lineTo(cx + 0.45 * g, gy + 2.4 * g);
    c.quadraticCurveTo(cx + 0.5 * g, gy + 3.3 * g, cx - 0.35 * g, gy + 3.0 * g);
    c.stroke();
    dot(pen, cx - 0.3 * g, gy + 2.85 * g, 0.3);
  } else if (pen.clef === 'bass') {
    const fy = top + g;
    dot(pen, x + 0.5 * g, fy, 0.35);
    c.lineWidth = 0.28 * g;
    c.beginPath();
    c.moveTo(x + 0.3 * g, fy - 0.1 * g);
    c.bezierCurveTo(
      x + 0.6 * g,
      fy - 1.2 * g,
      x + 2.1 * g,
      fy - 1.1 * g,
      x + 2.0 * g,
      fy + 0.4 * g,
    );
    c.quadraticCurveTo(x + 1.9 * g, fy + 1.9 * g, x + 0.2 * g, fy + 3.0 * g);
    c.stroke();
    dot(pen, x + 2.6 * g, fy - 0.5 * g, 0.17);
    dot(pen, x + 2.6 * g, fy + 0.5 * g, 0.17);
  } else if (pen.clef === 'alto') {
    const mid = top + 2 * g;
    c.fillRect(x + 0.2 * g, top, 0.5 * g, 4 * g);
    c.fillRect(x + 0.95 * g, top, 0.15 * g, 4 * g);
    c.lineWidth = 0.3 * g;
    c.beginPath();
    c.arc(x + 1.5 * g, mid - g, g, 0.5 * Math.PI, -0.5 * Math.PI, true);
    c.stroke();
    c.beginPath();
    c.arc(x + 1.5 * g, mid + g, g, -0.5 * Math.PI, 0.5 * Math.PI);
    c.stroke();
  } else {
    c.fillRect(x + 0.6 * g, top + g, 0.4 * g, 2 * g);
    c.fillRect(x + 1.4 * g, top + g, 0.4 * g, 2 * g);
  }
}

/**
 * Draws an accidental with its middle at a point.
 *
 * @param pen The pen.
 * @param x The x of the middle.
 * @param y The y of the middle.
 * @param kind The accidental.
 */
function drawAccidental(pen: Pen, x: number, y: number, kind: 'sharp' | 'flat' | 'natural'): void {
  if (kind === 'sharp') {
    strokeLine(pen, x, y, 0.12, [-0.25, -1.3, -0.25, 1.4]);
    strokeLine(pen, x, y, 0.12, [0.25, -1.4, 0.25, 1.3]);
    strokeLine(pen, x, y, 0.3, [-0.55, -0.3, 0.55, -0.6]);
    strokeLine(pen, x, y, 0.3, [-0.55, 0.6, 0.55, 0.3]);
  } else if (kind === 'flat') {
    strokeLine(pen, x, y, 0.13, [-0.3, -1.9, -0.3, 0.5]);
    const { c, g } = pen;
    c.lineWidth = 0.22 * g;
    c.beginPath();
    c.moveTo(x - 0.3 * g, y - 0.1 * g);
    c.bezierCurveTo(x + 0.3 * g, y - 0.8 * g, x + 0.9 * g, y - 0.2 * g, x - 0.3 * g, y + 0.5 * g);
    c.stroke();
  } else {
    strokeLine(pen, x, y, 0.12, [-0.3, -1.3, -0.3, 0.6]);
    strokeLine(pen, x, y, 0.12, [0.3, -0.6, 0.3, 1.3]);
    strokeLine(pen, x, y, 0.3, [-0.3, -0.2, 0.3, -0.4]);
    strokeLine(pen, x, y, 0.3, [-0.3, 0.4, 0.3, 0.2]);
  }
}

/** The steps of the sharps of a key signature on the treble staff. */
const SHARP_STEPS = [45, 42, 46, 43, 40, 44, 41] as const;

/** The steps of the flats of a key signature on the treble staff. */
const FLAT_STEPS = [41, 44, 40, 43, 39, 42, 38] as const;

/**
 * Draws a key signature.
 *
 * @param pen The pen.
 * @param x The left of the signature.
 * @param fifths The key signature.
 * @returns The width, in pixels.
 */
function drawKey(pen: Pen, x: number, fifths: number): number {
  if (pen.clef === 'percussion' || fifths === 0) {
    return 0;
  }
  const shift = MIDDLE_STEP.treble - MIDDLE_STEP[pen.clef];
  const steps = fifths > 0 ? SHARP_STEPS : FLAT_STEPS;
  for (let i = 0; i < Math.abs(fifths); i++) {
    const y = stepY(pen, (steps[i] ?? 41) - shift);
    drawAccidental(pen, x + (i + 0.6) * pen.g, y, fifths > 0 ? 'sharp' : 'flat');
  }
  return (Math.abs(fifths) + 0.6) * pen.g;
}

/**
 * Draws a time signature.
 *
 * @param pen The pen.
 * @param x The left of the signature.
 * @param meter The numerator and the denominator.
 * @returns The width, in pixels.
 */
function drawMeter(pen: Pen, x: number, meter: readonly [number, number]): number {
  const { c, g, top } = pen;
  c.font = `bold ${2.3 * g}px ${SHEET_PRINT.serif}`;
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  const width = Math.max(...meter.map((n) => c.measureText(String(n)).width));
  c.fillText(String(meter[0]), x + width / 2 + 0.3 * g, top + g);
  c.fillText(String(meter[1]), x + width / 2 + 0.3 * g, top + 3 * g);
  return width + 0.8 * g;
}

/**
 * Draws a rest.
 *
 * @param pen The pen.
 * @param x The middle of the rest.
 * @param value The value in grid steps.
 */
function drawRest(pen: Pen, x: number, value: number): void {
  const { c, g, top } = pen;
  const mid = top + 2 * g;
  if (value >= 16) {
    c.fillRect(x - 0.6 * g, top + g, 1.2 * g, 0.5 * g);
  } else if (value >= 8) {
    c.fillRect(x - 0.6 * g, mid - 0.5 * g, 1.2 * g, 0.5 * g);
  } else if (value >= 4) {
    strokeLine(pen, x, mid, 0.28, [-0.3, -1.5, 0.35, -0.7, -0.25, 0, 0.35, 0.7]);
    strokeLine(pen, x, mid, 0.22, [0.35, 0.7, -0.2, 0.8, 0.1, 1.5]);
  } else {
    const flags = value >= 2 ? 1 : 2;
    strokeLine(pen, x, mid, 0.14, [0.45, -0.9, -0.1, 0.4 + flags * 0.6]);
    for (let f = 0; f < flags; f++) {
      dot(pen, x - 0.3 * g, mid - (0.5 - f * 0.9) * g, 0.28);
      strokeLine(pen, x, mid, 0.12, [-0.3, -0.5 + f * 0.9, 0.45 - f * 0.25, -0.9 + f * 0.9]);
    }
  }
}

/** A chord in a bar with its place on the page, for the stems and the beams. */
interface PlacedChord {
  readonly event: BarEvent;
  readonly x: number;
  /** True for a stem that goes up from the heads. */
  up: boolean;
  /** The y of the end of the stem. */
  end: number;
}

/**
 * Draws the heads, the accidentals, the dots, and the ledger lines of a chord, and plans its
 * stem.
 *
 * @param pen The pen.
 * @param event The chord.
 * @param x The x of the heads.
 * @returns The chord with its stem.
 */
function drawHeads(pen: Pen, event: BarEvent, x: number): PlacedChord {
  const { c, g } = pen;
  const middle = MIDDLE_STEP[pen.clef];
  const steps = event.heads.map((head) => head.step);
  const low = Math.min(...steps);
  const high = Math.max(...steps);
  const up = (low + high) / 2 < middle;

  c.lineWidth = Math.max(1, 0.12 * g);
  for (let s = middle + 6; s <= high; s += 2) {
    c.fillRect(x - g, stepY(pen, s) - 0.06 * g, 2 * g, Math.max(1, 0.12 * g));
  }
  for (let s = middle - 6; s >= low; s -= 2) {
    c.fillRect(x - g, stepY(pen, s) - 0.06 * g, 2 * g, Math.max(1, 0.12 * g));
  }

  let side = 0;
  for (const [i, head] of event.heads.entries()) {
    const second = i > 0 && head.step - (event.heads[i - 1]?.step ?? -9) === 1 && side === 0;
    side = second ? 1 : 0;
    const hx = x + (side ? (up ? 1.2 : -1.2) * g : 0);
    const y = stepY(pen, head.step);
    c.beginPath();
    if (pen.clef === 'percussion') {
      strokeLine(pen, hx, y, 0.18, [-0.5, -0.45, 0.5, 0.45]);
      strokeLine(pen, hx, y, 0.18, [-0.5, 0.45, 0.5, -0.45]);
    } else if (event.value >= 8) {
      c.lineWidth = 0.22 * g;
      c.ellipse(hx, y, (event.value >= 16 ? 0.7 : 0.6) * g, 0.4 * g, -0.35, 0, 2 * Math.PI);
      c.stroke();
    } else {
      c.ellipse(hx, y, 0.62 * g, 0.45 * g, -0.35, 0, 2 * Math.PI);
      c.fill();
    }
    if (head.accidental) {
      drawAccidental(pen, x - 1.7 * g, y, head.accidental);
    }
    if (event.value === 12 || event.value === 6 || event.value === 3) {
      const onLine = (head.step - middle) % 2 === 0;
      dot(pen, x + 1.3 * g, y - (onLine ? 0.5 * g : 0), 0.18);
    }
  }

  const far = stepY(pen, up ? high : low);
  const end = Math.abs(stepY(pen, middle) - far) > 3.5 * g ? stepY(pen, middle) : far;
  return { event, x, up, end: end + (up ? -3.5 : 3.5) * g };
}

/**
 * Draws the stems, the flags, and the beams of the chords of a bar. The eighths and the
 * sixteenths of one beat share a beam.
 *
 * @param pen The pen.
 * @param chords The chords of the bar.
 * @param beat The length of a beat in grid steps.
 */
function drawStems(pen: Pen, chords: readonly PlacedChord[], beat: number): void {
  const { c, g } = pen;
  const groups: PlacedChord[][] = [];
  for (const chord of chords) {
    const last = groups.at(-1);
    const prev = last?.at(-1);
    const short = chord.event.value <= 3;
    if (
      last &&
      prev &&
      short &&
      prev.event.value <= 3 &&
      prev.event.at + prev.event.value === chord.event.at &&
      Math.floor(prev.event.at / beat) === Math.floor(chord.event.at / beat)
    ) {
      last.push(chord);
    } else {
      groups.push([chord]);
    }
  }

  for (const group of groups) {
    const first = group[0];
    const last = group.at(-1);
    if (!first || !last || first.event.value >= 16) {
      continue;
    }
    const steps = group.flatMap((chord) => chord.event.heads.map((head) => head.step));
    const up =
      group.length > 1
        ? steps.reduce((sum, s) => sum + s, 0) / steps.length < MIDDLE_STEP[pen.clef]
        : first.up;
    const stemX = (chord: PlacedChord): number => chord.x + (up ? 0.56 : -0.56) * g;
    const headY = (chord: PlacedChord): number => {
      const ys = chord.event.heads.map((head) => stepY(pen, head.step));
      return up ? Math.max(...ys) : Math.min(...ys);
    };
    const tipY = (chord: PlacedChord): number => {
      const ys = chord.event.heads.map((head) => stepY(pen, head.step));
      return up ? Math.min(...ys) - 3.5 * g : Math.max(...ys) + 3.5 * g;
    };
    if (group.length === 1) {
      const y0 = headY(first);
      const y1 = first.up === up ? first.end : tipY(first);
      c.fillRect(stemX(first) - 0.06 * g, Math.min(y0, y1), 0.12 * g, Math.abs(y1 - y0));
      const flags = first.event.value <= 1 ? 2 : first.event.value <= 3 ? 1 : 0;
      for (let f = 0; f < flags; f++) {
        const fy = y1 + (up ? 1 : -1) * f * 0.8 * g;
        const dir = up ? 1 : -1;
        strokeLine(pen, stemX(first), fy, 0.25, [0, 0, 0.9, 1.0 * dir, 0.75, 2.1 * dir]);
      }
      continue;
    }
    const tips = group.map(tipY);
    const ends = up ? Math.min(...tips) : Math.max(...tips);
    const x0 = stemX(first);
    const x1 = stemX(last);
    const slope = Math.max(
      -0.12,
      Math.min(0.12, ((tips.at(-1) ?? 0) - (tips[0] ?? 0)) / (x1 - x0)),
    );
    const beamY = (x: number): number => ends + (x - (x0 + x1) / 2) * slope;
    for (const chord of group) {
      const y0 = headY(chord);
      const y1 = beamY(stemX(chord));
      c.fillRect(stemX(chord) - 0.06 * g, Math.min(y0, y1), 0.12 * g, Math.abs(y1 - y0));
    }
    const thick = 0.45 * g;
    const beam = (xa: number, xb: number, level: number): void => {
      const off = (up ? 1 : -1) * level * 0.8 * g;
      c.beginPath();
      c.moveTo(xa, beamY(xa) + off - thick / 2);
      c.lineTo(xb, beamY(xb) + off - thick / 2);
      c.lineTo(xb, beamY(xb) + off + thick / 2);
      c.lineTo(xa, beamY(xa) + off + thick / 2);
      c.fill();
    };
    beam(x0 - 0.06 * g, x1 + 0.06 * g, 0);
    for (const [i, chord] of group.entries()) {
      if (chord.event.value > 1) {
        continue;
      }
      const next = group[i + 1];
      const prev = group[i - 1];
      if (next && next.event.value <= 1) {
        beam(stemX(chord), stemX(next), 1);
      } else if (!(prev && prev.event.value <= 1)) {
        const x = stemX(chord);
        beam(next ? x : x - g, next ? x + g : x, 1);
      }
    }
  }
}

/**
 * Draws the content of one bar of one staff.
 *
 * @param pen The pen.
 * @param bar The bar.
 * @param left The left of the space of the notes.
 * @param right The right of the space of the notes.
 */
function drawBar(pen: Pen, bar: Bar, left: number, right: number): void {
  const { c, g, top } = pen;
  if (bar.rest > 1) {
    const y = top + 2 * g;
    c.fillRect(left + 0.15 * (right - left), y - 0.4 * g, 0.7 * (right - left), 0.8 * g);
    c.fillRect(left + 0.15 * (right - left), y - g, 0.12 * g, 2 * g);
    c.fillRect(left + 0.85 * (right - left) - 0.12 * g, y - g, 0.12 * g, 2 * g);
    c.font = `bold ${2.0 * g}px ${SHEET_PRINT.serif}`;
    c.textAlign = 'center';
    c.textBaseline = 'alphabetic';
    c.fillText(String(bar.rest), (left + right) / 2, top - 0.9 * g);
    return;
  }
  if (bar.events.length === 0) {
    drawRest(pen, (left + right) / 2, 16);
    return;
  }
  const chords: PlacedChord[] = [];
  for (const event of bar.events) {
    const x = left + (event.at / bar.length) * (right - left);
    if (event.heads.length === 0) {
      drawRest(pen, x, event.value);
    } else {
      chords.push(drawHeads(pen, event, x));
    }
  }
  drawStems(pen, chords, bar.beat);
}

/**
 * Draws the staves of one system of parts: the lines, the clefs, the keys, the bars, and the bar
 * lines that join the staves of each part.
 *
 * @param c The context.
 * @param box The box of the system: its left, its right, its top, and the staff gap.
 * @param box.left The left of the staves.
 * @param box.right The right of the staves.
 * @param box.tops The y of the top line of each staff.
 * @param box.g The staff gap.
 * @param staves The staves, each with the key of its part.
 * @param from The index of the first bar of the system in the bars of each staff.
 * @param count The number of bar slots of the system.
 * @param meterFirst True to print the time signature of the first bar.
 */
function drawSystem(
  c: CanvasRenderingContext2D,
  box: { left: number; right: number; tops: readonly number[]; g: number },
  staves: readonly { readonly staff: Staff; readonly fifths: number; readonly join: boolean }[],
  from: number,
  count: number,
  meterFirst: boolean,
): void {
  const { g, left, right } = box;
  const line = Math.max(1, 0.1 * g);
  let head = 0;
  // The last system of a piece ends at its final bar, and a page has no empty system after it.
  const present = Math.min(count, (staves[0]?.staff.bars.length ?? 0) - from);
  if (present <= 0) {
    return;
  }
  const pens = staves.map(({ staff }, s): Pen => ({
    c,
    g,
    top: box.tops[s] ?? 0,
    clef: staff.clef,
  }));
  for (const [s, { staff, fifths }] of staves.entries()) {
    const pen = pens[s];
    if (!pen) {
      continue;
    }
    drawClef(pen, left + 0.3 * g);
    let x = left + 3.4 * g;
    x += drawKey(pen, x, fifths);
    const meter = staff.bars[from]?.meter;
    if (meterFirst && meter) {
      x += drawMeter(pen, x, meter);
    }
    head = Math.max(head, x - left);
  }

  const width = (right - left - head) / count;
  const end = left + head + present * width;
  for (const pen of pens) {
    for (const l of pen.clef === 'percussion' ? [2] : [0, 1, 2, 3, 4]) {
      c.fillRect(left, pen.top + l * g - line / 2, end - left, line);
    }
  }
  const top = pens[0]?.top ?? 0;
  const bottom = (pens.at(-1)?.top ?? 0) + 4 * g;
  c.fillRect(left, top, line, bottom - top);
  for (let b = 0; b < present; b++) {
    const bx = left + head + b * width;
    let inner = bx + 1.6 * g;
    for (const [s, { staff }] of staves.entries()) {
      const bar = staff.bars[from + b];
      const pen = pens[s];
      if (!bar || !pen) {
        continue;
      }
      if (b > 0 && bar.meter) {
        inner = Math.max(inner, bx + drawMeter(pen, bx + 0.3 * g, bar.meter) + 1.2 * g);
      }
    }
    for (const [s, { staff, join }] of staves.entries()) {
      const bar = staff.bars[from + b];
      const pen = pens[s];
      if (!bar || !pen) {
        continue;
      }
      drawBar(pen, bar, inner, bx + width - 1.2 * g);
      const barTop = pen.top;
      const nextTop = pens[s + 1]?.top;
      const barBottom = join && nextTop !== undefined ? nextTop : pen.top + 4 * g;
      const lineTop = pen.clef === 'percussion' ? pen.top + g : barTop;
      const lineBottom = pen.clef === 'percussion' && !join ? pen.top + 3 * g : barBottom;
      c.fillRect(bx + width - line, lineTop, Math.max(1, 0.12 * g), lineBottom - lineTop);
      if (bar.final) {
        c.fillRect(bx + width - 0.5 * g, lineTop, 0.5 * g, lineBottom - lineTop);
        c.fillRect(bx + width - 1.1 * g, lineTop, Math.max(1, 0.12 * g), lineBottom - lineTop);
      }
    }
  }
  const number = staves[0]?.staff.bars[from]?.number;
  if (number !== undefined && number > 1) {
    c.font = `italic ${1.3 * g}px ${SHEET_PRINT.serif}`;
    c.textAlign = 'left';
    c.textBaseline = 'alphabetic';
    c.fillText(String(number), left, top - 1.2 * g);
  }
}

/**
 * Draws the titles at the top of a page.
 *
 * @param c The context.
 * @param page The page.
 * @param titles The title and the subtitle.
 * @param label The name of the part at the left, or ''.
 * @returns The y of the end of the header.
 */
function drawHeader(
  c: CanvasRenderingContext2D,
  page: Page,
  titles: SheetTitles,
  label: string,
): number {
  const { x, y, width, height } = page;
  const margin = width * SHEET_PRINT.margin;
  const unit = Math.min(width, height * 1.4);
  let at = y + height * 0.05;
  c.textAlign = 'center';
  c.textBaseline = 'top';
  const fit = (text: string, size: number, style: string): void => {
    c.font = `${style} ${size}px ${SHEET_PRINT.serif}`;
    const scale = Math.min(1, (width - 2 * margin) / Math.max(1, c.measureText(text).width));
    c.font = `${style} ${size * scale}px ${SHEET_PRINT.serif}`;
    c.fillText(text, x + width / 2, at);
    at += size * scale * 1.25;
  };
  const title = titles.title.trim();
  const subtitle = titles.subtitle.trim();
  if (title) {
    fit(title, unit * 0.05, 'bold');
  }
  if (subtitle) {
    fit(subtitle, unit * 0.03, 'italic');
  }
  if (label) {
    c.font = `${unit * 0.03}px ${SHEET_PRINT.serif}`;
    c.textAlign = 'left';
    c.fillText(label, x + margin, at);
    at += unit * 0.03 * 1.3;
  }
  return at;
}

/**
 * Draws one page of the atlas.
 *
 * @param c The context.
 * @param page The page.
 * @param titles The title and the subtitle.
 */
function drawPage(c: CanvasRenderingContext2D, page: Page, titles: SheetTitles): void {
  const { x, y, width, height, music } = page;
  c.save();
  c.beginPath();
  c.rect(x, y, width, height);
  c.clip();
  const margin = width * SHEET_PRINT.margin;
  const left = x + margin;
  const right = x + width - margin;
  const bottom = y + height * 0.96;

  if (music.kind === 'part') {
    const { part } = music;
    const top = drawHeader(c, page, titles, part.label);
    const staves = part.staves.length;
    const units = staves * 4 + (staves - 1) * 4 + 5;
    const g = (bottom - top) / (music.lines * units);
    for (let l = 0; l < music.lines; l++) {
      const systemTop = top + (l * units + 3.5) * g;
      drawSystem(
        c,
        { left, right, g, tops: part.staves.map((_, s) => systemTop + s * 8 * g) },
        part.staves.map((staff) => ({ staff, fifths: part.fifths, join: staves > 1 })),
        l * SHEET_PRINT.barsPerLine,
        SHEET_PRINT.barsPerLine,
        l === 0,
      );
    }
  } else {
    const top = music.titled ? drawHeader(c, page, titles, '') : y + height * 0.05;
    const staves = music.parts.flatMap((part) =>
      part.staves.map((staff, s) => ({
        staff,
        fifths: part.fifths,
        join: s < part.staves.length - 1,
      })),
    );
    const g = (bottom - top) / (staves.length * 7 + 2);
    const names = width * 0.11;
    c.font = `${1.6 * g}px ${SHEET_PRINT.serif}`;
    c.textAlign = 'right';
    c.textBaseline = 'middle';
    let s = 0;
    for (const [p, part] of music.parts.entries()) {
      const middle = top + (s + part.staves.length / 2) * 7 * g + 1.5 * g;
      c.fillText(music.names[p] ?? '', left + names - g, middle);
      s += part.staves.length;
    }
    drawSystem(
      c,
      { left: left + names, right, g, tops: staves.map((_, i) => top + (i * 7 + 3) * g) },
      staves,
      0,
      SHEET_PRINT.scoreBars,
      true,
    );
  }
  c.restore();
}

/**
 * Gives the music of each sheet of a layout.
 *
 * @param music The music of each sheet, from `buildSheets()`.
 * @param layout The layout, for the cast of the readers.
 * @param score The score.
 * @returns The music of each page.
 */
function pageMusic(music: readonly SheetMusic[], layout: SceneLayout, score: Score): PageMusic[] {
  const engraving = engraveScore(score);
  const playing = score.seats
    .map((seat, index) => ({ seat, index }))
    .filter(({ seat }) => seat.playerCount > 0 && seat.section !== 'sound-only');
  const labelOf = (seatIndex: number, player: number | null): string => {
    const seat = score.seats[seatIndex];
    if (!seat) {
      return '';
    }
    const peers = playing.filter((p) => p.seat.section === seat.section);
    if (player === null) {
      const ordinal = peers.findIndex((p) => p.index === seatIndex);
      return partLabel(seat.section, ordinal, peers.length);
    }
    let ordinal = 0;
    for (const peer of peers) {
      if (peer.index === seatIndex) {
        break;
      }
      ordinal += peer.seat.playerCount;
    }
    const total = peers.reduce((sum, p) => sum + p.seat.playerCount, 0);
    return partLabel(seat.section, ordinal + player, total);
  };
  const score3 = (page: number): PageMusic => {
    const range = {
      from: page * SHEET_PRINT.scoreBars,
      slots: SHEET_PRINT.scoreBars,
      multiRest: false,
    };
    return {
      kind: 'score',
      parts: playing.map(({ index }) => engravePart(engraving, index, [], '', range)),
      names: playing.map(({ seat, index }) => {
        const label = labelOf(index, null);
        const number = /\s(I+|\d+)(?:\s|$)/u.exec(label)?.[1];
        return number ? `${SHORT_NAME[seat.section]} ${number}` : SHORT_NAME[seat.section];
      }),
      titled: page === 0,
    };
  };

  return music.map((sheet): PageMusic => {
    if (sheet.kind === 'score') {
      return score3(sheet.page);
    }
    const casts = sheet.readers.flatMap((r) => {
      const cast = layout.players[r]?.cast;
      return cast ? [cast] : [];
    });
    const first = casts[0];
    const section = first ? score.seats[first.seatIndex]?.section : undefined;
    if (!first || !section) {
      return score3(0);
    }
    const strings = STRING_SECTIONS.has(section);
    const players = strings
      ? []
      : casts.filter((cast) => cast.seatIndex === first.seatIndex).map((cast) => cast.player);
    const grand = section === 'piano' || section === 'harp';
    const lines = grand ? SHEET_PRINT.partLines / 2 : SHEET_PRINT.partLines;
    const label = labelOf(first.seatIndex, strings || casts.length > 1 ? null : first.player);
    const range = { from: 0, slots: lines * SHEET_PRINT.barsPerLine, multiRest: true };
    return {
      kind: 'part',
      part: engravePart(engraving, first.seatIndex, players, label, range),
      lines,
    };
  });
}

/**
 * Places the pages of the sheets in rows of the atlas, at one scale for all of them.
 *
 * @param corners The corners of the sheets.
 * @param music The music of each page.
 * @returns The pages and the height of the atlas.
 */
function packPages(corners: Float32Array, music: readonly PageMusic[]): [Page[], number] {
  const p = SHEET_PRINT;
  const sizes = music.map((_, s) => {
    const at = (k: number, axis: number): number => corners[s * 12 + k * 3 + axis] ?? 0;
    const side = (k: number): number =>
      Math.hypot(at(k, 0) - at(0, 0), at(k, 1) - at(0, 1), at(k, 2) - at(0, 2));
    return [side(1), side(3)] as const;
  });
  let scale = p.pixelsPerMeter;
  for (;;) {
    const pages: Page[] = [];
    let x = 0;
    let y = 0;
    let row = 0;
    for (const [s, [w, h]] of sizes.entries()) {
      const width = Math.ceil(w * scale);
      const height = Math.ceil(h * scale);
      if (x + width + p.gutter > p.atlasWidth) {
        x = 0;
        y += row;
        row = 0;
      }
      const at = music[s];
      if (at) {
        pages.push({ x: x + p.gutter, y: y + p.gutter, width, height, music: at });
      }
      x += width + 2 * p.gutter;
      row = Math.max(row, height + 2 * p.gutter);
    }
    const total = y + row;
    if (total <= p.atlasHeight || scale < 100) {
      return [pages, Math.max(1, total)];
    }
    scale *= Math.sqrt(p.atlasHeight / total) * 0.98;
  }
}

/** The printed music of a layout: its mesh and its atlas, which a change of the titles draws again. */
export class SheetPrint {
  /** The mesh of all the sheets. */
  readonly mesh: Mesh<BufferGeometry, MeshStandardMaterial>;
  readonly #context: CanvasRenderingContext2D;
  readonly #texture: CanvasTexture;
  readonly #pages: readonly Page[];

  /**
   * Makes the print of the pages.
   *
   * @param mesh The mesh of the sheets.
   * @param context The context of the atlas.
   * @param texture The texture of the atlas.
   * @param pages The pages in the atlas.
   */
  constructor(
    mesh: Mesh<BufferGeometry, MeshStandardMaterial>,
    context: CanvasRenderingContext2D,
    texture: CanvasTexture,
    pages: readonly Page[],
  ) {
    this.mesh = mesh;
    this.#context = context;
    this.#texture = texture;
    this.#pages = pages;
  }

  /**
   * Draws all the pages again with new titles.
   *
   * @param titles The title and the subtitle.
   */
  draw(titles: SheetTitles): void {
    const c = this.#context;
    c.fillStyle = SHEET_PRINT.paper;
    c.fillRect(0, 0, c.canvas.width, c.canvas.height);
    c.fillStyle = SHEET_PRINT.ink;
    c.strokeStyle = SHEET_PRINT.ink;
    c.lineCap = 'round';
    c.lineJoin = 'round';
    for (const page of this.#pages) {
      drawPage(c, page, titles);
    }
    this.#texture.needsUpdate = true;
  }
}

/**
 * Creates the mesh of the printed music on the sheets of a layout (design 4.5). Each sheet lies
 * on the white sheet of its stand or on a page of the score, and a polygon offset draws it in
 * front of that face. The material is a copy of the shared material with the atlas, so the
 * light, the pool, and the finish stay. The dispose of the material frees the atlas.
 *
 * @param sheets The sheets, from `buildSheets()` of `models/stage.ts`.
 * @param layout The layout, for the cast of the readers.
 * @param score The score that the sheets print.
 * @param shared The shared material (`createMaterials()`).
 * @param titles The title and the subtitle.
 * @returns The print, or `null` with no sheet or no document.
 */
export function createSheetPrint(
  sheets: SheetSet,
  layout: SceneLayout,
  score: Score,
  shared: MeshStandardMaterial,
  titles: SheetTitles,
): SheetPrint | null {
  const { corners } = sheets;
  const count = corners.length / 12;
  if (count === 0 || typeof document === 'undefined') {
    return null;
  }
  const [pages, height] = packPages(corners, pageMusic(sheets.music, layout, score));
  const canvas = document.createElement('canvas');
  canvas.width = SHEET_PRINT.atlasWidth;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) {
    return null;
  }
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  // The music takes the texture points of the sheets, `uv1`. The finish table reads `uv`.
  texture.channel = 1;
  // The lines fade to gray at a distance with the mip levels, so they make no moiré.
  texture.anisotropy = 4;

  const positions = new Float32Array(count * 18);
  const normals = new Float32Array(count * 18);
  const colors = new Float32Array(count * 18);
  const uv = new Float32Array(count * 12);
  const uv1 = new Float32Array(count * 12);
  const finish = (FINISH_ORDER.indexOf('matte') + 0.5) / FINISH_ORDER.length;
  for (let s = 0; s < count; s++) {
    const at = (k: number, axis: number): number => corners[s * 12 + k * 3 + axis] ?? 0;
    const e1 = [0, 1, 2].map((axis) => at(1, axis) - at(0, axis));
    const e2 = [0, 1, 2].map((axis) => at(3, axis) - at(0, axis));
    const [ax = 0, ay = 0, az = 0] = e1;
    const [bx = 0, by = 0, bz = 0] = e2;
    const nx = ay * bz - az * by;
    const ny = az * bx - ax * bz;
    const nz = ax * by - ay * bx;
    const length = Math.hypot(nx, ny, nz) || 1;
    const page = pages[s];
    const u0 = page ? page.x / canvas.width : 0;
    const u1 = page ? (page.x + page.width) / canvas.width : 1;
    // The texture flips y: v 1 is the top of the canvas.
    const v0 = page ? 1 - (page.y + page.height) / height : 0;
    const v1 = page ? 1 - page.y / height : 1;
    for (const [i, k] of SHEET_TRIANGLES.entries()) {
      const v = s * 6 + i;
      for (let axis = 0; axis < 3; axis++) {
        positions[v * 3 + axis] = at(k, axis);
        colors[v * 3 + axis] = SCENE_COLORS.sheet[axis] ?? 1;
      }
      normals[v * 3] = nx / length;
      normals[v * 3 + 1] = ny / length;
      normals[v * 3 + 2] = nz / length;
      uv[v * 2] = finish;
      uv[v * 2 + 1] = 0.5;
      uv1[v * 2] = u0 + (SHEET_UVS[i * 2] ?? 0) * (u1 - u0);
      uv1[v * 2 + 1] = v0 + (SHEET_UVS[i * 2 + 1] ?? 0) * (v1 - v0);
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new BufferAttribute(normals, 3));
  geometry.setAttribute('color', new BufferAttribute(colors, 3));
  geometry.setAttribute('uv', new BufferAttribute(uv, 2));
  geometry.setAttribute('uv1', new BufferAttribute(uv1, 2));

  const material = shared.clone();
  material.map = texture;
  material.polygonOffset = true;
  material.polygonOffsetFactor = -1;
  material.polygonOffsetUnits = -4;
  material.onBeforeCompile = (shader, renderer) => {
    shared.onBeforeCompile(shader, renderer);
  };
  material.customProgramCacheKey = () => `${shared.customProgramCacheKey()} sheet`;
  material.addEventListener('dispose', () => {
    texture.dispose();
  });
  const mesh = new Mesh(geometry, material);
  mesh.name = 'sheets';
  mesh.receiveShadow = true;
  const print = new SheetPrint(mesh, context, texture, pages);
  print.draw(titles);
  return print;
}
