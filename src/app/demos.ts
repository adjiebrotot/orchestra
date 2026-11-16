import { spokenTime } from './time-text.ts';
import DEMO_LIST from '../../demos/demos.json' with { type: 'json' };

/** A link of the credits dialog (design 2.8). */
export interface CreditLink {
  /** The text of the link. */
  readonly text: string;
  /** The URL. */
  readonly href: string;
}

/** The texts and the length of one demo (design 8.2). */
export interface DemoInfo {
  /** The title of the piece at the top left of the page and in the demo list. */
  readonly title: string;
  readonly composer: string;
  /** The credit line of the credits dialog. '' for none. */
  readonly credit: string;
  /** The links after the credit line, for example the source and the license of a CC BY file. */
  readonly links?: readonly CreditLink[];
  /** The song length in whole seconds. `tools/patch-demos.ts` fills it in. */
  readonly lengthSec: number;
}

/** One entry of `demos/demos.json`. */
interface DemoEntry extends Partial<DemoInfo> {
  /** The file name in `demos/src/` with no `.mid`. */
  readonly id: string;
}

const ENTRIES: readonly DemoEntry[] = DEMO_LIST as readonly DemoEntry[];

/**
 * The hash ids of the demos, in the order of `demos/demos.json`. The first one is the default
 * demo. The list can be empty: then the first screen asks for a MIDI file.
 */
export const DEMO_IDS: readonly string[] = ENTRIES.map((entry) => entry.id);

/** The hash id of one demo: the name of its file in `demos/src/` with no `.mid`. */
export type DemoId = string;

/** The default demo: the first demo of the list, or `null` with no demo. */
export const DEFAULT_DEMO: DemoId | null = DEMO_IDS[0] ?? null;

/** The texts and the length of each demo, from `demos/demos.json`. */
export const DEMOS: Readonly<Record<DemoId, DemoInfo>> = Object.fromEntries(
  ENTRIES.map((entry) => [
    entry.id,
    {
      title: entry.title ?? entry.id,
      composer: entry.composer ?? '',
      credit: entry.credit ?? '',
      ...(entry.links ? { links: entry.links } : {}),
      lengthSec: entry.lengthSec ?? 0,
    },
  ]),
);

/**
 * Gives the `aria-label` of the row of a demo in the demo list (design 2.8): the title, the
 * composer, and the spoken length. A screen reader reads the texts of the row with no pause
 * between them, for example "printemps4:40Lili".
 *
 * @param id The demo.
 * @returns The label, for example "Symphony No. 8, Op. 93: II, Ludwig van Beethoven, 3 minutes 40
 *   seconds".
 */
export function demoRowLabel(id: DemoId): string {
  const demo = DEMOS[id];
  if (!demo) {
    return id;
  }
  const parts = [demo.title, demo.composer, demo.lengthSec > 0 ? spokenTime(demo.lengthSec) : ''];
  return parts.filter((part) => part !== '').join(', ');
}

/**
 * Finds if a text is the hash id of a demo.
 *
 * @param value The text.
 * @returns True for one of {@link DEMO_IDS}.
 */
export function isDemoId(value: string): value is DemoId {
  return DEMO_IDS.some((id) => id === value);
}

/**
 * Gives the URL of the file of a demo in the site (design 8.3).
 *
 * @param id The demo.
 * @param base The base URL of the site, with a slash at the end.
 * @returns The URL of `demos/<id>.mid`.
 */
export function demoUrl(id: DemoId, base: string): string {
  return `${base}demos/${id}.mid`;
}

/**
 * The id of `perf-60.mid`, the file of the frame target (design 9.5, 9.7). Only the dev server
 * shows it, with the section size "One per part". `tools/write-perf-60.ts` writes it into
 * `perf/`, which the build does not copy into `dist/`.
 */
export const PERF_60 = 'perf-60';

/** A file that the stage can show: a demo, or `perf-60.mid` on the dev server. */
export type StageFile = DemoId | typeof PERF_60;

/**
 * Selects the file of the URL hash `#demo=<id>` (design 2.2). Only on the dev server,
 * `#demo=perf-60` gives `perf-60.mid` (9.5).
 *
 * @param hash The hash of the URL, for example `#demo=beethoven-9`, or '' for none.
 * @param devServer True on the dev server.
 * @returns The file of the hash, or the default demo for a missing or unknown id, or `null`
 *   with no demo.
 */
export function fileFromHash(hash: string, devServer: boolean): StageFile | null {
  const value = new URLSearchParams(hash.replace(/^#/u, '')).get('demo') ?? '';
  if (devServer && value === PERF_60) {
    return PERF_60;
  }
  return isDemoId(value) ? value : DEFAULT_DEMO;
}

/**
 * Gives the URL hash of a demo (design 2.2).
 *
 * @param id The demo.
 * @param film True to start the piece in Cinematic mode at the first play.
 * @returns The hash, for example `#demo=beethoven-9` or `#demo=beethoven-9&film=1`.
 */
export function demoHash(id: DemoId, film = false): string {
  return film ? `#demo=${id}&film=1` : `#demo=${id}`;
}

/**
 * Tells if the URL hash asks for Cinematic mode at the first play: `film=1` (design 2.2).
 *
 * @param hash The hash of the URL, for example `#demo=beethoven-9&film=1`, or '' for none.
 * @returns True for `film=1`.
 */
export function filmFromHash(hash: string): boolean {
  return new URLSearchParams(hash.replace(/^#/u, '')).get('film') === '1';
}

/**
 * Gives the texts of a demo, or plain texts from its id when `demos/demos.json` has no entry.
 *
 * @param id The demo.
 * @returns The texts and the length.
 */
export function demoInfo(id: DemoId): DemoInfo {
  return DEMOS[id] ?? { title: id, composer: '', credit: '', lengthSec: 0 };
}
