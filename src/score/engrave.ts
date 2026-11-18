import type { PlayerNote, Score, SectionId } from './types.ts';

/**
 * The printed music of the sheets (design 4.5, sheet music): the notes of a part as bars of
 * written music. The rules follow the parts of a real orchestra: one key for the whole score,
 * the clef of each instrument, the written pitch of a transposing instrument, accidentals that
 * hold to the end of the bar, and a multi-bar rest for a run of empty bars.
 */
export const ENGRAVE = {
  /** The steps of the grid in a whole note: the shortest written value is a sixteenth. */
  grid: 16,
  /** The written values of a note, in grid steps, from the longest. Dotted values included. */
  noteValues: [16, 12, 8, 6, 4, 3, 2, 1],
  /** The written values of a rest, in grid steps, from the longest. */
  restValues: [16, 8, 4, 2, 1],
  /** The fewest empty bars that print as one multi-bar rest. */
  multiRestBars: 2,
  /** The key of the split of a grand staff: this key and above go to the upper staff. */
  grandSplit: 60,
} as const;

/** The clef of a staff. A percussion staff has one line, and all heads sit on it. */
export type Clef = 'treble' | 'bass' | 'alto' | 'percussion';

/**
 * The step of the middle line of each clef, on the diatonic scale of {@link staffStep}: B4 for
 * the treble clef, D3 for the bass clef, and C4 for the alto clef.
 */
export const MIDDLE_STEP: Readonly<Record<Clef, number>> = {
  treble: 41,
  bass: 29,
  alto: 35,
  percussion: 41,
};

/** An accidental in front of a note head. */
export type Accidental = 'sharp' | 'flat' | 'natural';

/** One note head of a chord. */
export interface Head {
  /** The diatonic step: 7 for each octave, 35 for middle C ({@link staffStep}). */
  readonly step: number;
  /** The printed accidental, or `null` when the key or the bar gives it. */
  readonly accidental: Accidental | null;
}

/** A chord or a rest in a bar. */
export interface BarEvent {
  /** The start in grid steps from the start of the bar. */
  readonly at: number;
  /** The written value in grid steps: one of {@link ENGRAVE}.noteValues or restValues. */
  readonly value: number;
  /** The heads of a chord, low to high, or empty for a rest. */
  readonly heads: readonly Head[];
}

/** One bar of one staff. */
export interface Bar {
  /** The number of the bar in the piece, from 1. */
  readonly number: number;
  /** The length of the bar in grid steps. */
  readonly length: number;
  /** The length of one beat in grid steps, for the beams: a dotted quarter in 6/8. */
  readonly beat: number;
  /** The time signature, when the bar starts a new one or a page. */
  readonly meter: readonly [numerator: number, denominator: number] | null;
  /** The chords and the rests in time order. An empty list is a whole-bar rest. */
  readonly events: readonly BarEvent[];
  /** The number of bars of a multi-bar rest, or 1. */
  readonly rest: number;
  /** True for the last bar of the piece, which ends with a final bar line. */
  readonly final: boolean;
}

/** One staff of a part, with its bars. */
export interface Staff {
  readonly clef: Clef;
  readonly bars: readonly Bar[];
}

/** The written music of one part: one staff, or two for the grand staff of a keyboard. */
export interface Part {
  /** The name of the part, for example "Clarinet in B♭". */
  readonly label: string;
  /** The key signature: sharps above 0, flats below 0. */
  readonly fifths: number;
  /** The staves of one system. Each staff has the same bars. */
  readonly staves: readonly Staff[];
}

/** The bars and the key of a score, for each part of it. */
export interface Engraving {
  /** The bars of the piece. */
  readonly bars: readonly BarSpan[];
  /** The key signature of the concert pitch. */
  readonly fifths: number;
  readonly score: Score;
}

/** One bar of the piece in song time. */
interface BarSpan {
  readonly startSec: number;
  readonly endSec: number;
  readonly numerator: number;
  readonly denominator: number;
}

/** The choice of the bars of a part. */
export interface BarRange {
  /** The index of the first bar, from 0. */
  readonly from: number;
  /** The number of bar slots. A multi-bar rest takes one slot. */
  readonly slots: number;
  /** True to print a run of empty bars as one multi-bar rest. */
  readonly multiRest: boolean;
}

/** The written pitch of a transposing instrument: the shift in keys and in fifths. */
interface Transposition {
  readonly keys: number;
  readonly fifths: number;
  readonly suffix: string;
}

/** The transposing instruments of the orchestra. The double bass sounds an octave lower. */
const TRANSPOSE: Readonly<Partial<Record<SectionId, Transposition>>> = {
  clarinet: { keys: 2, fifths: 2, suffix: ' in B♭' },
  horn: { keys: 7, fifths: 1, suffix: ' in F' },
  trumpet: { keys: 2, fifths: 2, suffix: ' in B♭' },
  contrabass: { keys: 12, fifths: 0, suffix: '' },
};

/** The name of the part of each section. */
const SECTION_NAME: Readonly<Record<SectionId, string>> = {
  violin: 'Violin',
  viola: 'Viola',
  cello: 'Violoncello',
  contrabass: 'Contrabass',
  harp: 'Harp',
  piano: 'Piano',
  flute: 'Flute',
  oboe: 'Oboe',
  clarinet: 'Clarinet',
  bassoon: 'Bassoon',
  horn: 'Horn',
  trumpet: 'Trumpet',
  trombone: 'Trombone',
  tuba: 'Tuba',
  timpani: 'Timpani',
  percussion: 'Percussion',
  choir: 'Choir',
  'sound-only': 'Part',
};

/** The sections that read the bass clef. */
const BASS_SECTIONS: ReadonlySet<SectionId> = new Set([
  'cello',
  'contrabass',
  'bassoon',
  'trombone',
  'tuba',
  'timpani',
]);

/** The sections that read a grand staff. */
const GRAND_SECTIONS: ReadonlySet<SectionId> = new Set(['piano', 'harp']);

/** The Krumhansl-Kessler profile of a major key, from the tonic. */
const MAJOR_PROFILE = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];

/** The Krumhansl-Kessler profile of a minor key, from the tonic. */
const MINOR_PROFILE = [6.33, 2.68, 3.52, 5.38, 2.6, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];

/** The pitch class of each letter, from C. */
const LETTER_CLASS = [0, 2, 4, 5, 7, 9, 11] as const;

/** The order of the sharps of a key signature, as letter indices: F C G D A E B. */
const SHARP_ORDER = [3, 0, 4, 1, 5, 2, 6] as const;

/**
 * Calculates the correlation of two lists of 12 numbers.
 *
 * @param a The first list.
 * @param b The second list, read from `shift`.
 * @param shift The rotation of `b`.
 * @returns The correlation, from -1 to 1.
 */
function correlation(a: readonly number[], b: readonly number[], shift: number): number {
  const mean = (list: readonly number[]): number => list.reduce((sum, v) => sum + v, 0) / 12;
  const ma = mean(a);
  const mb = mean(b);
  let top = 0;
  let da = 0;
  let db = 0;
  for (let i = 0; i < 12; i++) {
    const x = (a[i] ?? 0) - ma;
    const y = (b[(i - shift + 12) % 12] ?? 0) - mb;
    top += x * y;
    da += x * x;
    db += y * y;
  }
  return da > 0 && db > 0 ? top / Math.sqrt(da * db) : 0;
}

/**
 * Gives the key signature of a tonic in major: from 6 flats to 6 sharps.
 *
 * @param tonic The pitch class of the tonic of the major key.
 * @returns The fifths.
 */
function majorFifths(tonic: number): number {
  const fifths = (tonic * 7) % 12;
  return fifths > 6 ? fifths - 12 : fifths;
}

/**
 * Finds the key of the pitched notes of a score with the profiles of Krumhansl and Kessler. A
 * minor key gets the signature of its relative major.
 *
 * @param score The score.
 * @returns The key signature: sharps above 0, flats below 0.
 */
function scoreKey(score: Score): number {
  const weights = Array.from({ length: 12 }, () => 0);
  for (const note of score.notes) {
    if (score.seats[note.seatIndex]?.section !== 'percussion') {
      weights[note.pitch % 12] = (weights[note.pitch % 12] ?? 0) + note.endSec - note.startSec;
    }
  }
  let best = { fit: -Infinity, fifths: 0 };
  for (let tonic = 0; tonic < 12; tonic++) {
    const major = correlation(weights, MAJOR_PROFILE, tonic);
    if (major > best.fit) {
      best = { fit: major, fifths: majorFifths(tonic) };
    }
    const minor = correlation(weights, MINOR_PROFILE, tonic);
    if (minor > best.fit) {
      best = { fit: minor, fifths: majorFifths((tonic + 3) % 12) };
    }
  }
  return best.fifths;
}

/**
 * Gives the bars of a score from its downbeats and its time signatures.
 *
 * @param score The score.
 * @returns The bars in time order.
 */
function scoreBars(score: Score): BarSpan[] {
  const starts = score.beats.filter((beat) => beat.indexInBar === 0).map((beat) => beat.timeSec);
  if (starts.length === 0 || (starts[0] ?? 0) > 0.001) {
    starts.unshift(0);
  }
  const bars: BarSpan[] = [];
  let meter = 0;
  for (const [i, startSec] of starts.entries()) {
    while ((score.meters[meter + 1]?.timeSec ?? Infinity) <= startSec + 0.001) {
      meter++;
    }
    const at = score.meters[meter];
    const next = starts[i + 1] ?? Math.max(score.durationSec, startSec + 0.001);
    bars.push({
      startSec,
      endSec: next,
      numerator: at?.numerator ?? 4,
      denominator: at?.denominator ?? 4,
    });
  }
  return bars;
}

/**
 * Prepares the printed music of a score: its bars and its key.
 *
 * @param score The score.
 * @returns The engraving, for {@link engravePart}.
 */
export function engraveScore(score: Score): Engraving {
  return { bars: scoreBars(score), fifths: scoreKey(score), score };
}

/**
 * Gives the key alteration of each letter in a key signature.
 *
 * @param fifths The key signature.
 * @returns The alteration of each letter from C: 1, 0, or -1.
 */
function keyAlters(fifths: number): number[] {
  const alters = Array.from({ length: 7 }, () => 0);
  for (let i = 0; i < Math.abs(fifths); i++) {
    const letter = fifths > 0 ? SHARP_ORDER[i] : SHARP_ORDER[6 - i];
    if (letter !== undefined) {
      alters[letter] = Math.sign(fifths);
    }
  }
  return alters;
}

/**
 * Gives the letter and the alteration of a key in a key signature: the letter of the key when the
 * key has it, else a natural, else a sharp in a sharp key and a flat in a flat key.
 *
 * @param pitch The key, 0 to 127.
 * @param fifths The key signature.
 * @param alters The alterations of the key signature ({@link keyAlters}).
 * @returns The letter index from C and the alteration.
 */
function spell(pitch: number, fifths: number, alters: readonly number[]): [number, number] {
  const pc = pitch % 12;
  const inKey = LETTER_CLASS.findIndex((c, l) => (c + (alters[l] ?? 0) + 12) % 12 === pc);
  if (inKey >= 0) {
    return [inKey, alters[inKey] ?? 0];
  }
  const natural = LETTER_CLASS.findIndex((c) => c === pc);
  if (natural >= 0) {
    return [natural, 0];
  }
  const flat = fifths < 0 || (fifths === 0 && (pc === 3 || pc === 10));
  const alter = flat ? -1 : 1;
  return [LETTER_CLASS.findIndex((c) => c === (pc - alter + 12) % 12), alter];
}

/**
 * Gives the diatonic step of a letter in the octave of a key: 7 for each octave, with C4 at 35.
 *
 * @param pitch The key, 0 to 127.
 * @param letter The letter index from C.
 * @param alter The alteration of the letter.
 * @returns The step.
 */
export function staffStep(pitch: number, letter: number, alter: number): number {
  return letter + 7 * Math.floor((pitch - alter) / 12);
}

/**
 * Gives the name of the part of a seat: the section name, with a number when the section has
 * more than one part, and the key of a transposing instrument.
 *
 * @param section The section.
 * @param ordinal The index of the part in its section, from 0.
 * @param total The number of parts of the section.
 * @returns The name.
 */
export function partLabel(section: SectionId, ordinal: number, total: number): string {
  const name = SECTION_NAME[section];
  const suffix = TRANSPOSE[section]?.suffix ?? '';
  if (total <= 1) {
    return name + suffix;
  }
  const number = section === 'violin' ? ['I', 'II', 'III', 'IV'][ordinal] : undefined;
  return `${name} ${number ?? String(ordinal + 1)}${suffix}`;
}

/**
 * Gives the clef of a part from its section, or from the middle of its keys for a choir.
 *
 * @param section The section.
 * @param notes The notes of the part.
 * @returns The clef.
 */
function clefOf(section: SectionId, notes: readonly PlayerNote[]): Clef {
  if (section === 'percussion') {
    return 'percussion';
  }
  if (section === 'viola') {
    return 'alto';
  }
  if (BASS_SECTIONS.has(section)) {
    return 'bass';
  }
  if (section === 'choir' || section === 'sound-only') {
    const pitches = notes.map((note) => note.pitch).toSorted((a, b) => a - b);
    return (pitches[pitches.length >> 1] ?? 72) < 57 ? 'bass' : 'treble';
  }
  return 'treble';
}

/** A note on the grid of its bar, before the chords form. */
interface GridNote {
  readonly bar: number;
  readonly at: number;
  readonly end: number;
  readonly pitch: number;
}

/**
 * Finds the bar of a time and its grid step in the bar.
 *
 * @param bars The bars.
 * @param timeSec The song time.
 * @returns The bar index and the step, rounded to the grid.
 */
function gridPlace(bars: readonly BarSpan[], timeSec: number): [number, number] {
  let low = 0;
  let high = bars.length - 1;
  while (low < high) {
    const middle = (low + high + 1) >> 1;
    if ((bars[middle]?.startSec ?? 0) <= timeSec) {
      low = middle;
    } else {
      high = middle - 1;
    }
  }
  const bar = bars[low];
  if (!bar) {
    return [0, 0];
  }
  const length = barLength(bar);
  const share = (timeSec - bar.startSec) / Math.max(bar.endSec - bar.startSec, 1e-6);
  const at = Math.round(share * length);
  return at >= length && low + 1 < bars.length ? [low + 1, 0] : [low, Math.min(at, length)];
}

/**
 * Gives the length of a bar in grid steps.
 *
 * @param bar The bar.
 * @returns The length.
 */
function barLength(bar: BarSpan): number {
  return Math.max(1, Math.round((bar.numerator * ENGRAVE.grid) / bar.denominator));
}

/**
 * Fills a gap of a bar with rests, each on a grid place that its value divides.
 *
 * @param from The start of the gap in grid steps.
 * @param to The end of the gap.
 * @returns The rests.
 */
function rests(from: number, to: number): BarEvent[] {
  const list: BarEvent[] = [];
  let at = from;
  while (at < to) {
    const value = ENGRAVE.restValues.find((v) => at % v === 0 && at + v <= to) ?? 1;
    list.push({ at, value, heads: [] });
    at += value;
  }
  return list;
}

/**
 * Writes the chords and the rests of one bar of one staff, with the accidentals of the bar.
 *
 * @param notes The notes that start in the bar.
 * @param length The length of the bar in grid steps.
 * @param fifths The written key signature.
 * @param percussion True for a staff of one line: no accidental.
 * @returns The events, or an empty list for an empty bar.
 */
function barEvents(
  notes: readonly GridNote[],
  length: number,
  fifths: number,
  percussion: boolean,
): BarEvent[] {
  if (notes.length === 0) {
    return [];
  }
  const alters = keyAlters(fifths);
  const held = new Map<number, number>();
  const onsets = [...new Set(notes.map((note) => note.at))].toSorted((a, b) => a - b);
  const events: BarEvent[] = [];
  let free = 0;
  for (const [i, at] of onsets.entries()) {
    if (at < free) {
      continue;
    }
    const chord = notes.filter((note) => note.at === at);
    const next = onsets[i + 1] ?? length;
    const end = Math.min(next, length, Math.max(...chord.map((note) => note.end)));
    const value = ENGRAVE.noteValues.find((v) => v <= Math.max(end - at, 1)) ?? 1;
    events.push(...rests(free, at));
    const pitches = [...new Set(chord.map((note) => note.pitch))].toSorted((a, b) => a - b);
    const heads = pitches.map((pitch): Head => {
      if (percussion) {
        return { step: MIDDLE_STEP.percussion, accidental: null };
      }
      const [letter, alter] = spell(pitch, fifths, alters);
      const step = staffStep(pitch, letter, alter);
      const before = held.get(step) ?? alters[letter] ?? 0;
      held.set(step, alter);
      if (before === alter) {
        return { step, accidental: null };
      }
      const accidental = alter > 0 ? 'sharp' : alter < 0 ? 'flat' : 'natural';
      return { step, accidental };
    });
    events.push({ at, value, heads });
    free = at + value;
  }
  events.push(...rests(free, length));
  return events;
}

/**
 * Writes the part of a group of players as bars of printed music (design 4.5, sheet music).
 *
 * @param engraving The bars and the key of the score ({@link engraveScore}).
 * @param seatIndex The seat of the part.
 * @param players The players of the seat whose notes the part prints. Empty for all.
 * @param label The name of the part ({@link partLabel}).
 * @param range The bars to print.
 * @returns The part.
 */
export function engravePart(
  engraving: Engraving,
  seatIndex: number,
  players: readonly number[],
  label: string,
  range: BarRange,
): Part {
  const { bars, score } = engraving;
  const section = score.seats[seatIndex]?.section ?? 'sound-only';
  const shift = TRANSPOSE[section] ?? { keys: 0, fifths: 0, suffix: '' };
  let fifths = engraving.fifths + shift.fifths;
  fifths = fifths > 6 ? fifths - 12 : fifths;
  const notes = score.notes.filter(
    (note) =>
      note.seatIndex === seatIndex && (players.length === 0 || players.includes(note.player)),
  );
  const grand = GRAND_SECTIONS.has(section);
  const clefs: Clef[] = grand ? ['treble', 'bass'] : [clefOf(section, notes)];
  const percussion = clefs[0] === 'percussion';
  if (percussion || section === 'timpani') {
    fifths = 0;
  }

  const byBar = clefs.map(() => new Map<number, GridNote[]>());
  for (const note of notes) {
    const [bar, at] = gridPlace(bars, note.startSec);
    if (bar < range.from) {
      continue;
    }
    const [endBar, endAt] = gridPlace(bars, note.endSec);
    const span = bars[bar];
    const end = endBar > bar && span ? barLength(span) : Math.max(endAt, at + 1);
    const staff = grand && note.pitch < ENGRAVE.grandSplit ? 1 : 0;
    const list = byBar[staff]?.get(bar) ?? [];
    list.push({ bar, at, end, pitch: note.pitch + shift.keys });
    byBar[staff]?.set(bar, list);
  }

  const staves = clefs.map((clef) => ({ clef, bars: new Array<Bar>() }));
  const before = bars[range.from - 1];
  // A page that starts after the first bar prints the time signature only where it changes.
  let meter: string | null = before ? `${before.numerator}/${before.denominator}` : null;
  for (let index = range.from; index < bars.length;) {
    if ((staves[0]?.bars.length ?? 0) >= range.slots) {
      break;
    }
    const span = bars[index];
    if (!span) {
      break;
    }
    const length = barLength(span);
    const key = `${span.numerator}/${span.denominator}`;
    let run = 1;
    const empty = (i: number): boolean => byBar.every((map) => !map.get(i));
    if (range.multiRest && empty(index)) {
      while (
        index + run < bars.length &&
        empty(index + run) &&
        bars[index + run]?.numerator === span.numerator &&
        bars[index + run]?.denominator === span.denominator
      ) {
        run++;
      }
      if (run < ENGRAVE.multiRestBars) {
        run = 1;
      }
    }
    const compound = span.numerator % 3 === 0 && span.numerator > 3 && span.denominator >= 8;
    for (const [s, staff] of staves.entries()) {
      staff.bars.push({
        number: index + 1,
        length,
        beat: compound ? 6 : Math.max(1, ENGRAVE.grid / span.denominator),
        meter: key === meter ? null : [span.numerator, span.denominator],
        events:
          run > 1
            ? []
            : barEvents(byBar[s]?.get(index) ?? [], length, fifths, staff.clef === 'percussion'),
        rest: run,
        final: index + run >= bars.length,
      });
    }
    meter = key;
    index += run;
  }
  return { label, fifths, staves };
}
