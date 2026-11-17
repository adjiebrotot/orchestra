import { DEFAULT_SEATING_ROWS, MAX_SEATING_ROWS, ROW_SECTIONS } from '../models/layout-scene.ts';
import type { RowSection, SeatingRows } from '../models/layout-scene.ts';
import { isRecord } from '../scene/backdrop-settings.ts';
import type { Json } from '../scene/backdrop-settings.ts';
import { MAX_SEAT_COUNT } from '../score/players.ts';
import { SECTION_ORDER } from '../score/types.ts';
import type { SectionCounts, SectionId } from '../score/types.ts';

/**
 * The settings of the panel "Orchestra" (design 2.8, 3.8, 4.5): the rows of the sections on the
 * stage, and the player count of each seat of a section.
 */
export interface OrchestraSettings {
  /** The rows of the orchestra, from the front, with their sections from left to right. */
  readonly rows: SeatingRows;
  /** The player count of each seat of a section. A missing section keeps the rules of 3.8. */
  readonly counts: SectionCounts;
}

/** The settings of a new user: the default rows, and the counts of the rules of 3.8. */
export const DEFAULT_ORCHESTRA: OrchestraSettings = { rows: DEFAULT_SEATING_ROWS, counts: {} };

/** The key of the settings in the local storage. */
const ORCHESTRA_KEY = 'orchestra-seating';

/**
 * Tells if a value is a section of the rows.
 *
 * @param value A value of JSON.
 * @returns True for a section of {@link ROW_SECTIONS}.
 */
function isRowSection(value: Json | undefined): value is RowSection {
  return ROW_SECTIONS.some((section) => section === value);
}

/**
 * Reads the settings of the panel from JSON. A bad value takes its default. Each section of the
 * rows shows once, and a missing section joins the last row.
 *
 * @param value A value of JSON.
 * @returns The settings.
 */
export function readOrchestra(value: Json | undefined): OrchestraSettings {
  const data = isRecord(value) ? value : {};
  const seen = new Set<RowSection>();
  const rows = (Array.isArray(data['rows']) ? data['rows'] : DEFAULT_SEATING_ROWS)
    .slice(0, MAX_SEATING_ROWS)
    .map((row: Json) =>
      (Array.isArray(row) ? row : []).filter((section: Json): section is RowSection => {
        const fresh = isRowSection(section) && !seen.has(section);
        if (isRowSection(section)) {
          seen.add(section);
        }
        return fresh;
      }),
    )
    .filter((row) => row.length > 0);
  const missing = ROW_SECTIONS.filter((section) => !seen.has(section));
  if (missing.length > 0) {
    rows.push(missing);
  }
  const counts: Partial<Record<SectionId, number>> = {};
  const stored = isRecord(data['counts']) ? data['counts'] : {};
  for (const section of SECTION_ORDER) {
    const count = stored[section];
    if (section !== 'sound-only' && Number.isFinite(count)) {
      counts[section] = Math.min(MAX_SEAT_COUNT, Math.max(0, Math.round(Number(count))));
    }
  }
  return { rows, counts };
}

/**
 * Reads the settings of the panel from the local storage, or gives the defaults.
 *
 * @returns The settings.
 */
export function loadOrchestra(): OrchestraSettings {
  try {
    const text = window.localStorage.getItem(ORCHESTRA_KEY);
    return readOrchestra(text ? JSON.parse(text) : null);
  } catch {
    // The browser keeps no data, for example in a private window, or the data is broken.
    return DEFAULT_ORCHESTRA;
  }
}

/**
 * Keeps the settings of the panel in the local storage.
 *
 * @param settings The settings.
 */
export function saveOrchestra(settings: OrchestraSettings): void {
  try {
    window.localStorage.setItem(ORCHESTRA_KEY, JSON.stringify(settings));
  } catch {
    // The browser keeps no data. The settings stay for the visit.
  }
}
