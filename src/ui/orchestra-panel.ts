import { DEFAULT_ORCHESTRA } from '../app/orchestra-store.ts';
import type { OrchestraSettings } from '../app/orchestra-store.ts';
import { SECTION_NAMES } from '../app/seat-text.ts';
import { MAX_SEATING_ROWS } from '../models/layout-scene.ts';
import type { RowSection } from '../models/layout-scene.ts';
import { MAX_SEAT_COUNT } from '../score/players.ts';
import type { SectionId } from '../score/types.ts';
import { createButton, createElement } from './dom.ts';

/** The actions of the panel "Orchestra". */
export interface OrchestraPanelActions {
  /** A change of the settings. */
  readonly onChange: (settings: OrchestraSettings) => void;
  /** Gives the player count of each section in the current piece. */
  readonly players: () => ReadonlyMap<SectionId, number>;
}

/**
 * The sections whose notes go to fixed players: one player, or one player for each drum part. The
 * panel can only remove them, because a larger count gives players with no notes.
 */
const FIXED_SECTIONS: ReadonlySet<SectionId> = new Set<SectionId>([
  'harp',
  'piano',
  'timpani',
  'percussion',
]);

/** A move of a section in the rows: a step to the left or the right, or a row to the front or back. */
type Move = 'left' | 'right' | 'front' | 'back';

/**
 * Gives the rows after a move of a section. A move to the back of the last row makes a new row,
 * up to {@link MAX_SEATING_ROWS}. A row with no section goes.
 *
 * @param rows The rows.
 * @param section The section.
 * @param move The move.
 * @returns The new rows.
 */
export function moveSection(
  rows: readonly (readonly RowSection[])[],
  section: RowSection,
  move: Move,
): RowSection[][] {
  const next = rows.map((row) => [...row]);
  const r = next.findIndex((row) => row.includes(section));
  const row = next[r];
  if (!row) {
    return next;
  }
  const i = row.indexOf(section);
  if (move === 'left' || move === 'right') {
    const j = move === 'left' ? i - 1 : i + 1;
    const other = row[j];
    if (other) {
      row[j] = section;
      row[i] = other;
    }
    return next;
  }
  const to = move === 'front' ? r - 1 : r + 1;
  if (to < 0 || to >= MAX_SEATING_ROWS) {
    return next;
  }
  row.splice(i, 1);
  if (to === next.length) {
    next.push([]);
  }
  const target = next[to];
  target?.splice(Math.min(i, target.length), 0, section);
  return next.filter((each) => each.length > 0);
}

/**
 * The panel "Orchestra" (design 2.8, 3.8, 4.5): the rows of the sections on the stage, from the
 * front, and the player count of each section. Each change builds the scene again behind the
 * cover of the stage. The music goes on.
 */
export class OrchestraPanel {
  readonly element: HTMLElement;
  readonly #actions: OrchestraPanelActions;
  readonly #body: HTMLElement;
  #settings: OrchestraSettings = DEFAULT_ORCHESTRA;

  /**
   * Creates the panel. It starts hidden.
   *
   * @param actions The actions.
   */
  constructor(actions: OrchestraPanelActions) {
    this.#actions = actions;
    this.element = createElement('section', 'stage-panel orchestra-panel');
    this.element.hidden = true;
    this.element.setAttribute('aria-label', 'Orchestra');
    const head = createElement('div', 'render-head');
    const close = createButton('director-close', 'Close the orchestra panel');
    close.textContent = '×';
    close.addEventListener('click', () => {
      this.setOpen(false);
    });
    head.append(createElement('h3', '', 'Orchestra'), close);
    const hint = createElement(
      'p',
      'render-hint',
      'Move each section to another row or place, and set its players. Row 1 is nearest to the conductor. A removed section still sounds. A change builds the stage again.',
    );
    this.#body = createElement('div', 'stage-body');
    this.element.append(head, hint, this.#body);
  }

  /** True while the panel shows. */
  get open(): boolean {
    return !this.element.hidden;
  }

  /**
   * Shows or hides the panel.
   *
   * @param open True to show it.
   */
  setOpen(open: boolean): void {
    this.element.hidden = !open;
    if (open) {
      this.#render();
    }
  }

  /**
   * Shows the settings.
   *
   * @param settings The settings.
   */
  setSettings(settings: OrchestraSettings): void {
    this.#settings = settings;
    this.refresh();
  }

  /** Writes the controls again, for example after the build of a new piece. */
  refresh(): void {
    if (this.open) {
      this.#render();
    }
  }

  /**
   * Changes the settings, shows them, and tells the app.
   *
   * @param settings The new settings.
   */
  #change(settings: OrchestraSettings): void {
    this.#settings = settings;
    this.#render();
    this.#actions.onChange(settings);
  }

  /** Writes the controls again. */
  #render(): void {
    const scroll = this.#body.scrollTop;
    const players = this.#actions.players();
    const rows = this.#settings.rows;
    const sections = rows.map((row, r) => {
      const section = createElement('div', 'stage-section');
      const title = r === 0 ? 'Row 1, front' : `Row ${r + 1}`;
      section.append(createElement('div', 'stage-section-head', title));
      const list = createElement('div', 'orchestra-list');
      for (const [i, id] of row.entries()) {
        list.append(
          this.#item(id, players.get(id) ?? 0, {
            left: i > 0,
            right: i < row.length - 1,
            front: r > 0,
            back: r < MAX_SEATING_ROWS - 1 && !(r === rows.length - 1 && row.length === 1),
          }),
        );
      }
      section.append(list);
      return section;
    });
    const choir = createElement('div', 'stage-section');
    choir.append(
      createElement('div', 'stage-section-head', 'Choir'),
      createElement('p', 'render-hint', 'The choir stands on the risers behind the last row.'),
    );
    const choirList = createElement('div', 'orchestra-list');
    choirList.append(this.#item('choir', players.get('choir') ?? 0, null));
    choir.append(choirList);
    const reset = createButton('director-button is-danger', '');
    reset.removeAttribute('aria-label');
    reset.textContent = 'Reset to defaults';
    reset.addEventListener('click', () => {
      this.#change(DEFAULT_ORCHESTRA);
    });
    const end = createElement('div', 'stage-section');
    end.append(reset);
    this.#body.replaceChildren(...sections, choir, end);
    this.#body.scrollTop = scroll;
  }

  /**
   * Creates the line of one section: its name, its players in the current piece, its count, and
   * its moves.
   *
   * @param id The section.
   * @param shown The players of the section in the current piece.
   * @param moves The moves that the section can make, or `null` for the choir.
   * @returns The line.
   */
  #item(
    id: RowSection | 'choir',
    shown: number,
    moves: Readonly<Record<Move, boolean>> | null,
  ): HTMLElement {
    const item = createElement('div', 'orchestra-item');
    const wanted = this.#settings.counts[id];
    item.classList.toggle('is-removed', wanted === 0);
    const name = createElement('span', 'orchestra-name', SECTION_NAMES[id]);
    const now = createElement(
      'span',
      'orchestra-now',
      shown > 0 ? `${shown} on stage` : 'not on stage',
    );
    const label = createElement('div', 'orchestra-label');
    label.append(name, now);
    item.append(label, this.#count(id, wanted));
    if (moves) {
      const tools = createElement('div', 'orchestra-moves');
      const buttons: readonly (readonly [Move, string, string])[] = [
        ['left', '‹', 'Move left'],
        ['right', '›', 'Move right'],
        ['front', '˄', 'Move a row to the front'],
        ['back', '˅', 'Move a row to the back'],
      ];
      for (const [move, text, title] of buttons) {
        const button = createButton('stage-chip-button', `${title}: ${SECTION_NAMES[id]}`);
        button.textContent = text;
        button.title = title;
        button.disabled = id === 'choir' || !moves[move];
        button.addEventListener('click', () => {
          if (id !== 'choir') {
            this.#change({ ...this.#settings, rows: moveSection(this.#settings.rows, id, move) });
          }
        });
        tools.append(button);
      }
      item.append(tools);
    }
    return item;
  }

  /**
   * Creates the menu of the player count of a section: automatic, removed, or a count. A section
   * of fixed players can only show or go.
   *
   * @param id The section.
   * @param wanted The count of the settings, or `undefined` for the rules of the app.
   * @returns The menu.
   */
  #count(id: SectionId, wanted: number | undefined): HTMLElement {
    const select = createElement('select');
    select.setAttribute('aria-label', `Players of ${SECTION_NAMES[id]}`);
    const options: [string, string][] = [
      ['auto', 'Auto'],
      ['0', 'Removed'],
    ];
    if (!FIXED_SECTIONS.has(id)) {
      for (let n = 1; n <= MAX_SEAT_COUNT; n++) {
        options.push([String(n), n === 1 ? '1 player' : `${n} players`]);
      }
    }
    const value = wanted === undefined ? 'auto' : String(wanted);
    for (const [key, text] of options) {
      const option = createElement('option', '', text);
      option.value = key;
      option.selected = key === value;
      select.append(option);
    }
    select.addEventListener('change', () => {
      const counts = { ...this.#settings.counts };
      if (select.value === 'auto') {
        delete counts[id];
      } else {
        counts[id] = Number(select.value);
      }
      this.#change({ ...this.#settings, counts });
    });
    return select;
  }
}
