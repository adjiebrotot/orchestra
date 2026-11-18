import { createHash } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { writeSmf } from '../src/midi/test-smf.ts';
import type { TestEvent } from '../src/midi/test-smf.ts';

/**
 * Writes `demos/src/ode-to-joy.mid`: an arrangement of the theme of the last movement of the
 * Ninth Symphony of Beethoven (public domain) for this project. The strings play the theme one
 * time, and then the full orchestra plays it again, as in the symphony. The arrangement is new
 * work of this repository, under the license of the repository.
 */

/** The ticks of a quarter note. */
const Q = 480;

/** The microseconds of a quarter note: 108 quarters for each minute. */
const TEMPO = 555_556;

/** The theme as pairs of a key and a length in quarters (D major). */
const THEME: readonly (readonly [number, number])[] = [
  ...[66, 66, 67, 69, 69, 67, 66, 64, 62, 62, 64, 66].map((k) => [k, 1] as const),
  [66, 1.5],
  [64, 0.5],
  [64, 2],
  ...[66, 66, 67, 69, 69, 67, 66, 64, 62, 62, 64, 66].map((k) => [k, 1] as const),
  [64, 1.5],
  [62, 0.5],
  [62, 2],
  [64, 1],
  [64, 1],
  [66, 1],
  [62, 1],
  [64, 1],
  [66, 0.5],
  [67, 0.5],
  [66, 1],
  [62, 1],
  [64, 1],
  [66, 0.5],
  [67, 0.5],
  [66, 1],
  [64, 1],
  [62, 1],
  [64, 1],
  [57, 2],
  ...[66, 66, 67, 69, 69, 67, 66, 64, 62, 62, 64, 66].map((k) => [k, 1] as const),
  [64, 1.5],
  [62, 0.5],
  [62, 2],
];

/** The chord of each half bar of the theme: D for the tonic, A for the dominant. */
const CHORDS = 'DD DA DD DA DD DA DA AD AD AD AA DA DD DA DA AD'.replaceAll(' ', '');

/** The keys of the D major scale from D3 to D6, for the third under the theme. */
const SCALE = [
  50, 52, 54, 55, 57, 59, 61, 62, 64, 66, 67, 69, 71, 73, 74, 76, 78, 79, 81, 83, 85, 86,
];

/** The parts of the arrangement. */
const PART_NAMES = [
  'violin1',
  'violin2',
  'viola',
  'cello',
  'bass',
  'flute',
  'oboe',
  'clarinet',
  'bassoon',
  'horn',
  'trumpet',
  'timpani',
] as const;

/** One part of the arrangement. */
type PartName = (typeof PART_NAMES)[number];

/** One note: the key, the start and the length in ticks, and the velocity. */
type Note = readonly [key: number, start: number, length: number, velocity: number];

/**
 * Gives the key two steps of the scale under a key of the scale.
 *
 * @param key The key.
 * @returns The key of the third under it.
 */
function thirdUnder(key: number): number {
  const index = SCALE.indexOf(key);
  return index >= 2 ? (SCALE[index - 2] ?? key) : key - 3;
}

/**
 * Writes the track of one channel.
 *
 * @param channel The channel.
 * @param program The General MIDI program.
 * @param notes The notes.
 * @returns The events.
 */
function track(channel: number, program: number, notes: readonly Note[]): TestEvent[] {
  const events: { tick: number; off: boolean; bytes: number[] }[] = [];
  for (const [key, start, length, velocity] of notes) {
    events.push({ tick: start, off: false, bytes: [0x90 | channel, key, velocity] });
    events.push({ tick: start + length - 12, off: true, bytes: [0x80 | channel, key, 0] });
  }
  const sorted = events.toSorted((a, b) => a.tick - b.tick || Number(b.off) - Number(a.off));
  return [{ tick: 0, bytes: [0xc0 | channel, program] }, ...sorted];
}

/**
 * Writes the arrangement.
 *
 * @returns The bytes of the Standard MIDI File.
 */
export function odeToJoyBytes(): Uint8Array<ArrayBuffer> {
  const bar = 4 * Q;
  const pass = 16 * bar;
  const parts = {
    violin1: new Array<Note>(),
    violin2: new Array<Note>(),
    viola: new Array<Note>(),
    cello: new Array<Note>(),
    bass: new Array<Note>(),
    flute: new Array<Note>(),
    oboe: new Array<Note>(),
    clarinet: new Array<Note>(),
    bassoon: new Array<Note>(),
    horn: new Array<Note>(),
    trumpet: new Array<Note>(),
    timpani: new Array<Note>(),
  };
  for (const tutti of [false, true]) {
    const at = tutti ? pass : 0;
    const v = tutti ? 100 : 72;
    let tick = at;
    for (const [key, quarters] of THEME) {
      const length = quarters * Q;
      parts.violin1.push([key + (tutti ? 12 : 0), tick, length, v]);
      parts.violin2.push([thirdUnder(key), tick, length, v - 6]);
      if (tutti) {
        parts.flute.push([key + 12, tick, length, v - 4]);
        parts.oboe.push([key, tick, length, v - 6]);
        parts.clarinet.push([thirdUnder(key), tick, length, v - 8]);
        if (tick >= at + 12 * bar) {
          parts.trumpet.push([key, tick, length, v - 6]);
        }
      }
      tick += length;
    }
    for (let half = 0; half < 32; half++) {
      const start = at + half * 2 * Q;
      const dominant = CHORDS[half] === 'A';
      const root = dominant ? 45 : 50;
      parts.cello.push([root, start, 2 * Q, v - 4]);
      parts.bass.push([root - 12, start, 2 * Q, v - 4]);
      for (let beat = 0; beat < 2; beat++) {
        for (let eighth = 0; eighth < 2; eighth++) {
          const key = eighth === 0 ? 57 : dominant ? 61 : 62;
          parts.viola.push([key, start + beat * Q + (eighth * Q) / 2, Q / 2, v - 14]);
        }
      }
      if (tutti) {
        parts.bassoon.push([root, start, 2 * Q, v - 10]);
        parts.horn.push([dominant ? 61 : 62, start, 2 * Q, v - 12]);
        parts.timpani.push([root, start, Q, v - 10]);
      }
    }
  }

  const end = 2 * pass;
  const last = 4 * bar;
  const chord: Readonly<Record<PartName, readonly number[]>> = {
    violin1: [74, 78],
    violin2: [66, 69],
    viola: [57, 62],
    cello: [50],
    bass: [38],
    flute: [86],
    oboe: [78],
    clarinet: [69],
    bassoon: [50],
    horn: [62],
    trumpet: [74],
    timpani: [50],
  };
  for (const part of PART_NAMES) {
    for (const key of chord[part]) {
      parts[part].push([key, end, part === 'timpani' ? bar : last, 104]);
    }
  }

  const name = [...new TextEncoder().encode('Ode to Joy')];
  const conductor: TestEvent[] = [
    { tick: 0, bytes: [0xff, 0x03, name.length, ...name] },
    { tick: 0, bytes: [0xff, 0x51, 3, (TEMPO >> 16) & 0xff, (TEMPO >> 8) & 0xff, TEMPO & 0xff] },
    { tick: 0, bytes: [0xff, 0x58, 4, 4, 2, 24, 8] },
    { tick: 0, bytes: [0xff, 0x59, 2, 2, 0] },
  ];
  return writeSmf({
    ticksPerQuarter: Q,
    tracks: [
      conductor,
      track(0, 40, parts.violin1),
      track(1, 40, parts.violin2),
      track(2, 41, parts.viola),
      track(3, 42, parts.cello),
      track(4, 43, parts.bass),
      track(5, 73, parts.flute),
      track(6, 68, parts.oboe),
      track(7, 71, parts.clarinet),
      track(8, 70, parts.bassoon),
      track(12, 47, parts.timpani),
      track(10, 60, parts.horn),
      track(11, 56, parts.trumpet),
    ],
  });
}

async function main(): Promise<void> {
  const bytes = odeToJoyBytes();
  const path = join(import.meta.dirname, '..', 'demos', 'src', 'ode-to-joy.mid');
  await writeFile(path, bytes);
  const sum = createHash('sha256').update(bytes).digest('hex');
  console.log(`demos/src/ode-to-joy.mid: ${bytes.byteLength} B, sha-256 ${sum}`);
}

if (import.meta.main) {
  await main();
}
