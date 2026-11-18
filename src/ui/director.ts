import { isScreenCue, screenFrame } from '../scene/backdrop-settings.ts';
import type { Json, ScreenCue } from '../scene/backdrop-settings.ts';
import {
  CONDUCTOR_VIEWS,
  DIRECTOR_MOTIONS,
  focusPart,
  focusSeat,
  isConductorFocus,
  isScenicFocus,
} from '../shots/directed.ts';
import { SCENIC_MOVES } from '../shots/scenic.ts';
import type { DirectorCue, DirectorFocus, DirectorMotion } from '../shots/directed.ts';
import { createButton, createElement } from './dom.ts';

/** One row of the timeline: a seat of the score with its notes. */
export interface DirectorRow {
  /** The index of the seat in `Score.seats`. */
  readonly seatIndex: number;
  /** The name of the seat, for example "Violins 1". */
  readonly name: string;
  /** The color of the notes, as a CSS color. */
  readonly color: string;
  /** True if the seat has players on the stage, so the camera can focus on it. */
  readonly onStage: boolean;
}

/** The piece that the director shows. */
export interface DirectorPiece {
  /** A key that names the piece, for the cues that the browser keeps. */
  readonly key: string;
  readonly durationSec: number;
  readonly rows: readonly DirectorRow[];
  /** The notes: the seat, the start, and the end, in song seconds. */
  readonly notes: readonly {
    readonly seatIndex: number;
    readonly startSec: number;
    readonly endSec: number;
  }[];
}

/** The actions of the director panel. */
export interface DirectorActions {
  /** A change of the cues, or of the switch that uses them. */
  readonly onChange: (cues: readonly DirectorCue[], enabled: boolean) => void;
  /** A click on the ruler or on "Go": seek to a song time. */
  readonly onSeek: (songSec: number) => void;
  /** A click on "Preview": play in Cinematic mode. */
  readonly onPreview: () => void;
  /**
   * A click on "Automatic built-in": gives the cues of the automatic plan of the piece
   * (`automaticCues()`), or an empty list with no piece.
   */
  readonly automaticCues: () => readonly DirectorCue[];
  /** A change of the screen cues (design 4.5, backdrop). */
  readonly onScreenChange: (cues: readonly ScreenCue[]) => void;
}

/** An image that a screen cue can show. */
export interface ScreenImage {
  readonly id: string;
  readonly name: string;
}

/** The cues of a piece that the browser keeps: the camera path and the screen. */
interface StoredCues {
  readonly cues: DirectorCue[];
  readonly enabled: boolean;
  readonly screen: ScreenCue[];
}

/** The width of the names of the rows, in CSS pixels. */
const LABEL_PX = 128;

/** The height of one row of the timeline, in CSS pixels. */
const ROW_PX = 16;

/** The height of the ruler and of the cue track at the top, in CSS pixels. */
const RULER_PX = 22;

/** The zoom steps of the timeline: 0 fits the song to the width, else pixels per second. */
const ZOOMS: readonly (readonly [number, string])[] = [
  [0, 'Fit'],
  [8, '8 px/s'],
  [20, '20 px/s'],
  [50, '50 px/s'],
];

/** The largest width of the canvas, in CSS pixels. */
const MAX_CANVAS_PX = 16000;

/** The prefix of the keys of the cues in the storage of the browser. */
const STORE_PREFIX = 'orchestra-cues:';

/**
 * Gives a song time as minutes, seconds, and tenths.
 *
 * @param sec The time in seconds.
 * @returns For example "1:05.3".
 */
export function cueTime(sec: number): string {
  const t = Math.max(0, sec);
  const m = Math.floor(t / 60);
  const s = t - m * 60;
  return `${m}:${s < 10 ? '0' : ''}${s.toFixed(1)}`;
}

/**
 * Reads a song time that the user typed: "1:05.3", "65.3", or "65".
 *
 * @param text The text.
 * @returns The time in seconds, or `null` for a text that is not a time.
 */
export function parseCueTime(text: string): number | null {
  const match = /^\s*(?:(\d+):)?(\d+(?:\.\d*)?)\s*$/u.exec(text);
  if (!match) {
    return null;
  }
  return Number(match[1] ?? 0) * 60 + Number(match[2]);
}

/**
 * Tells if a value is a cue.
 *
 * @param value A value of JSON.
 * @returns True for a cue.
 */
function isCue(value: unknown): value is DirectorCue {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const cue = value as Record<string, unknown>;
  return (
    typeof cue['timeSec'] === 'number' &&
    typeof cue['focus'] === 'string' &&
    (/^(wide|high|seat:\d+|part:\d+)$/u.test(cue['focus']) ||
      isScenicFocus(cue['focus']) ||
      isConductorFocus(cue['focus'])) &&
    DIRECTOR_MOTIONS.some(([motion]) => motion === cue['motion']) &&
    typeof cue['cut'] === 'boolean'
  );
}

/**
 * Reads the cues of a JSON text: a list of cues, or an object with a list `cues`.
 *
 * @param text The JSON text.
 * @returns The cues, or `null` for a text with no cues.
 */
function readCues(text: string): StoredCues | null {
  try {
    const data: unknown = JSON.parse(text);
    const list: unknown = Array.isArray(data) ? data : (data as { cues?: unknown } | null)?.cues;
    if (!Array.isArray(list)) {
      return null;
    }
    const enabled = Array.isArray(data) ? true : (data as { enabled?: unknown }).enabled !== false;
    // SAFETY: `data` is an object here, because `list` came from its field `cues`.
    const screen: Json = Array.isArray(data) ? [] : ((data as { screen?: Json }).screen ?? []);
    return {
      cues: list.filter(isCue),
      enabled,
      screen: Array.isArray(screen) ? screen.filter(isScreenCue) : [],
    };
  } catch {
    return null;
  }
}

/**
 * The camera director (a panel above the bar): a timeline of the notes of each instrument, with
 * the cues of the camera on it, and a list of the cues. Each cue sets the focus of the camera and
 * its move from its time until the next cue. A click on a row of the timeline adds a cue that
 * focuses on that instrument at that time. The cues of each piece stay in the browser.
 */
export class Director {
  readonly element: HTMLElement;
  readonly #actions: DirectorActions;
  readonly #scroll: HTMLElement;
  readonly #canvas: HTMLCanvasElement;
  readonly #list: HTMLElement;
  readonly #enabled: HTMLInputElement;
  readonly #zoom: HTMLSelectElement;
  readonly #count: HTMLElement;
  #piece: DirectorPiece | null = null;
  #cues: DirectorCue[] = [];
  /** The screen cues of the piece, sorted by time (design 4.5, backdrop). */
  #screenCues: ScreenCue[] = [];
  /** The images of the screen, or an empty list when the screen does not show. */
  #screenImages: readonly ScreenImage[] = [];
  readonly #addScreen: HTMLButtonElement;
  #songSec = 0;
  /** The playhead x of the last drawing, so that a frame draws only after a change. */
  #drawnAt = -1;
  /** The drawing of the timeline with no playhead, for a quick redraw of the playhead. */
  #base: ImageData | null = null;

  /**
   * Creates the panel. It starts hidden.
   *
   * @param actions The actions.
   */
  constructor(actions: DirectorActions) {
    this.#actions = actions;
    this.element = createElement('section', 'director');
    this.element.hidden = true;
    this.element.setAttribute('aria-label', 'Camera director');

    const head = createElement('div', 'director-head');
    const title = createElement('h3', '', 'Camera director');
    const enabledLabel = createElement('label', 'director-switch');
    this.#enabled = createElement('input');
    this.#enabled.type = 'checkbox';
    this.#enabled.checked = true;
    this.#enabled.addEventListener('change', () => {
      this.#changed();
    });
    enabledLabel.append(this.#enabled, document.createTextNode('Use my camera path'));
    this.#count = createElement('span', 'director-count');

    const add = this.#textButton('+ Cue at playhead', () => {
      this.#addCue({ timeSec: this.#songSec, focus: 'wide', motion: 'push-in', cut: false });
    });
    this.#addScreen = this.#textButton('+ Screen cue at playhead', () => {
      this.#addScreenCue(this.#songSec);
    });
    this.#addScreen.hidden = true;
    const automatic = this.#textButton('Automatic built-in', () => {
      this.#useAutomatic();
    });
    automatic.title =
      'Fill the cue list with the camera focus of the built-in film. Its cuts and moves follow the music. Then change the focus of each cue as you like.';
    const preview = this.#textButton('Preview', () => {
      actions.onPreview();
    });
    const exportButton = this.#textButton('Export', () => {
      this.#export();
    });
    const importInput = createElement('input');
    importInput.type = 'file';
    importInput.accept = '.json,application/json';
    importInput.hidden = true;
    importInput.addEventListener('change', () => {
      const file = importInput.files?.[0];
      importInput.value = '';
      file
        ?.text()
        .then((text) => {
          const read = readCues(text);
          if (read) {
            this.#cues = read.cues;
            this.#screenCues = read.screen;
            this.#enabled.checked = read.enabled;
            this.#changed();
            this.#screenChanged();
          }
        })
        .catch(reportError);
    });
    const importButton = this.#textButton('Import', () => {
      importInput.click();
    });
    const clear = this.#textButton('Clear', () => {
      if (
        this.#cues.length + this.#screenCues.length > 0 &&
        window.confirm('Remove all cues of this piece?')
      ) {
        this.#cues = [];
        this.#screenCues = [];
        this.#changed();
        this.#screenChanged();
      }
    });
    this.#zoom = createElement('select', 'director-zoom');
    this.#zoom.setAttribute('aria-label', 'Timeline zoom');
    for (const [value, label] of ZOOMS) {
      const option = createElement('option', '', label);
      option.value = String(value);
      this.#zoom.append(option);
    }
    this.#zoom.addEventListener('change', () => {
      this.#layout();
    });
    const close = createButton('director-close', 'Close the camera director');
    close.textContent = '×';
    close.addEventListener('click', () => {
      this.setOpen(false);
    });
    const tools = createElement('div', 'director-tools');
    tools.append(
      automatic,
      add,
      this.#addScreen,
      preview,
      this.#zoom,
      importButton,
      exportButton,
      clear,
      importInput,
    );
    head.append(title, enabledLabel, this.#count, tools, close);

    const hint = createElement(
      'p',
      'director-hint',
      'Click a row at a time to point the camera at that instrument from there. Click the Screen row to change the screen image there. Click the ruler to seek. Each cue holds until the next cue.',
    );
    this.#scroll = createElement('div', 'director-timeline');
    this.#canvas = createElement('canvas');
    this.#canvas.addEventListener('click', (event) => {
      this.#clickTimeline(event);
    });
    this.#scroll.append(this.#canvas);
    this.#list = createElement('div', 'director-cues');
    this.element.append(head, hint, this.#scroll, this.#list);
    new ResizeObserver(() => {
      if (!this.element.hidden) {
        this.#layout();
      }
    }).observe(this.#scroll);
  }

  /** True while the panel shows. */
  get open(): boolean {
    return !this.element.hidden;
  }

  /** The cues of the current piece, sorted by time. */
  get cues(): readonly DirectorCue[] {
    return this.#cues;
  }

  /** The screen cues of the current piece, sorted by time. */
  get screenCues(): readonly ScreenCue[] {
    return this.#screenCues;
  }

  /**
   * Sets the images of the screen. With images, the timeline shows the row "Screen".
   *
   * @param images The images of the screen, or an empty list when the screen does not show.
   */
  setScreenImages(images: readonly ScreenImage[]): void {
    this.#screenImages = images;
    this.#addScreen.hidden = images.length === 0;
    this.#renderList();
    if (this.open) {
      this.#layout();
    }
  }

  /** True if the cues drive the cinematic camera. */
  get enabled(): boolean {
    return this.#enabled.checked;
  }

  /**
   * Shows or hides the panel.
   *
   * @param open True to show it.
   */
  setOpen(open: boolean): void {
    this.element.hidden = !open;
    document.body.classList.toggle('director-open', open);
    if (open) {
      this.#layout();
    }
  }

  /**
   * Shows a new piece, with the cues that the browser keeps for it.
   *
   * @param piece The piece, or `null` for none.
   */
  setPiece(piece: DirectorPiece | null): void {
    this.#piece = piece;
    this.#cues = [];
    this.#screenCues = [];
    this.#enabled.checked = true;
    if (piece) {
      try {
        const stored = window.localStorage.getItem(STORE_PREFIX + piece.key);
        const read = stored ? readCues(stored) : null;
        if (read) {
          this.#cues = read.cues;
          this.#screenCues = read.screen;
          this.#enabled.checked = read.enabled;
        }
      } catch {
        // The browser keeps no data, for example in a private window.
      }
    }
    this.#sort();
    this.#renderList();
    if (this.open) {
      this.#layout();
    }
  }

  /**
   * Moves the playhead. It draws only while the panel shows.
   *
   * @param songSec The song time, in seconds.
   */
  update(songSec: number): void {
    this.#songSec = songSec;
    if (!this.open || !this.#piece) {
      return;
    }
    const x = Math.round(this.#timeX(songSec));
    if (x !== this.#drawnAt) {
      this.#drawPlayhead(x);
    }
  }

  /**
   * Creates a text button.
   *
   * @param text The text.
   * @param onClick The action.
   * @returns The button.
   */
  #textButton(text: string, onClick: () => void): HTMLButtonElement {
    const button = createButton('director-button', '');
    button.removeAttribute('aria-label');
    button.textContent = text;
    button.addEventListener('click', onClick);
    return button;
  }

  /** Sorts the cues by time. */
  #sort(): void {
    this.#cues.sort((a, b) => a.timeSec - b.timeSec);
    this.#screenCues.sort((a, b) => a.timeSec - b.timeSec);
  }

  /**
   * Adds a screen cue with the next image after the image that shows at its time. A cue at the
   * same time as another screen cue replaces it.
   *
   * @param timeSec The song time.
   */
  #addScreenCue(timeSec: number): void {
    const images = this.#screenImages;
    if (images.length === 0) {
      return;
    }
    const time = Math.round(Math.max(0, timeSec) * 10) / 10;
    const shown = screenFrame(this.#screenCues, images[0]?.id ?? null, time).to;
    const index = images.findIndex((image) => image.id === shown);
    const image = images[(index + 1) % images.length] ?? images[0];
    if (!image) {
      return;
    }
    this.#screenCues = this.#screenCues.filter((c) => Math.abs(c.timeSec - time) >= 0.05);
    this.#screenCues.push({ timeSec: time, image: image.id, cut: false });
    this.#changed();
    this.#screenChanged();
  }

  /** Tells the app of a change of the screen cues. */
  #screenChanged(): void {
    this.#actions.onScreenChange(this.#screenCues);
  }

  /** The height of the row "Screen" of the timeline: one row with the screen, else 0. */
  get #screenRow(): number {
    return this.#screenImages.length > 0 ? ROW_PX : 0;
  }

  /**
   * Adds a cue. A cue at the same time as another cue replaces it.
   *
   * @param cue The cue.
   */
  #addCue(cue: DirectorCue): void {
    const timeSec = Math.round(Math.max(0, cue.timeSec) * 10) / 10;
    this.#cues = this.#cues.filter((c) => Math.abs(c.timeSec - timeSec) >= 0.05);
    this.#cues.push({ ...cue, timeSec });
    this.#changed();
  }

  /**
   * Replaces the cues with the cues of the automatic plan, after a confirmation when cues are
   * there.
   */
  #useAutomatic(): void {
    const cues = this.#actions.automaticCues();
    if (
      cues.length === 0 ||
      (this.#cues.length > 0 &&
        !window.confirm('Replace the cues of this piece with the cues of the built-in film?'))
    ) {
      return;
    }
    this.#cues = [...cues];
    this.#enabled.checked = true;
    this.#changed();
  }

  /** Saves the cues, shows them, and tells the app. */
  #changed(): void {
    this.#sort();
    const piece = this.#piece;
    if (piece) {
      try {
        const key = STORE_PREFIX + piece.key;
        if (this.#cues.length === 0 && this.#screenCues.length === 0) {
          window.localStorage.removeItem(key);
        } else {
          window.localStorage.setItem(
            key,
            JSON.stringify({
              enabled: this.#enabled.checked,
              cues: this.#cues,
              screen: this.#screenCues,
            }),
          );
        }
      } catch {
        // The browser keeps no data, for example in a private window.
      }
    }
    this.#renderList();
    this.#drawTimeline();
    this.#actions.onChange(this.#cues, this.#enabled.checked);
  }

  /** Downloads the cues as a JSON file. */
  #export(): void {
    const data = JSON.stringify(
      { enabled: this.#enabled.checked, cues: this.#cues, screen: this.#screenCues },
      null,
      2,
    );
    const link = createElement('a');
    link.href = URL.createObjectURL(new Blob([data], { type: 'application/json' }));
    link.download = `${(this.#piece?.key ?? 'camera').replace(/[^\w.-]+/gu, '_')}-camera.json`;
    link.click();
    setTimeout(() => {
      URL.revokeObjectURL(link.href);
    }, 1000);
  }

  /**
   * Gives the label of a focus.
   *
   * @param focus The focus.
   * @returns The label.
   */
  #focusLabel(focus: DirectorFocus): string {
    const seat = focusSeat(focus);
    if (seat !== null) {
      const name =
        this.#piece?.rows.find((row) => row.seatIndex === seat)?.name ?? `Seat ${seat + 1}`;
      return focusPart(focus) === null ? name : `${name} part (from behind)`;
    }
    const named = [...SCENIC_MOVES, ...CONDUCTOR_VIEWS].find(([view]) => view === focus);
    if (named) {
      return named[1];
    }
    return focus === 'high' ? 'High view' : 'Whole stage';
  }

  /**
   * Creates the menu of the focus of a cue.
   *
   * @param value The focus of the cue.
   * @returns The menu.
   */
  #focusMenu(value: DirectorFocus): HTMLSelectElement {
    const select = createElement('select');
    select.setAttribute('aria-label', 'Camera focus');
    const add = (focus: DirectorFocus, label: string, group: HTMLElement): void => {
      const option = createElement('option', '', label);
      option.value = focus;
      option.selected = focus === value;
      group.append(option);
    };
    const views = createElement('optgroup');
    views.label = 'Views';
    add('wide', 'Whole stage', views);
    add('high', 'High view', views);
    const conductor = createElement('optgroup');
    conductor.label = 'Conductor';
    for (const [view, label] of CONDUCTOR_VIEWS) {
      add(view, label, conductor);
    }
    const scenic = createElement('optgroup');
    scenic.label = 'Background';
    for (const [move, label] of SCENIC_MOVES) {
      add(move, label, scenic);
    }
    const seats = createElement('optgroup');
    seats.label = 'Instruments';
    for (const row of this.#piece?.rows ?? []) {
      if (row.onStage) {
        add(`seat:${row.seatIndex}`, row.name, seats);
      }
    }
    const parts = createElement('optgroup');
    parts.label = 'Parts from behind';
    for (const row of this.#piece?.rows ?? []) {
      if (row.onStage) {
        add(`part:${row.seatIndex}`, `${row.name} part (from behind)`, parts);
      }
    }
    select.append(views, conductor, scenic, seats, parts);
    return select;
  }

  /** Writes the list of the cues. */
  #renderList(): void {
    this.#list.replaceChildren();
    const screenCount = this.#screenCues.length;
    this.#count.textContent =
      (this.#cues.length === 0
        ? 'No cues: the built-in film plays'
        : `${this.#cues.length} cue${this.#cues.length === 1 ? '' : 's'}`) +
      (screenCount > 0 ? ` · ${screenCount} screen cue${screenCount === 1 ? '' : 's'}` : '');
    this.#renderScreenList();
    if (this.#cues.length === 0) {
      return;
    }
    const table = createElement('div', 'director-table');
    const header = createElement('div', 'director-cue director-cue-head');
    for (const text of ['Time', 'Camera focus', 'Motion', 'Into shot', '', '']) {
      header.append(createElement('span', '', text));
    }
    table.append(header);
    for (const [i, cue] of this.#cues.entries()) {
      const row = createElement('div', 'director-cue');
      const set = (change: Partial<DirectorCue>): void => {
        this.#cues[i] = { ...cue, ...change };
        this.#changed();
      };
      const time = createElement('input');
      time.value = cueTime(cue.timeSec);
      time.setAttribute('aria-label', 'Cue time');
      time.addEventListener('change', () => {
        const sec = parseCueTime(time.value);
        if (sec === null) {
          time.value = cueTime(cue.timeSec);
        } else {
          set({ timeSec: Math.round(sec * 10) / 10 });
        }
      });
      const focus = this.#focusMenu(cue.focus);
      focus.addEventListener('change', () => {
        set({ focus: focus.value as DirectorFocus });
      });
      const motion = createElement('select');
      motion.setAttribute('aria-label', 'Camera motion');
      for (const [value, label] of DIRECTOR_MOTIONS) {
        const option = createElement('option', '', label);
        option.value = value;
        option.selected = value === cue.motion;
        motion.append(option);
      }
      motion.addEventListener('change', () => {
        set({ motion: motion.value as DirectorMotion });
      });
      const cut = createElement('select');
      cut.setAttribute('aria-label', 'Transition');
      for (const [value, label] of [
        ['blend', 'Smooth move'],
        ['cut', 'Hard cut'],
      ] as const) {
        const option = createElement('option', '', label);
        option.value = value;
        option.selected = (value === 'cut') === cue.cut;
        cut.append(option);
      }
      cut.addEventListener('change', () => {
        set({ cut: cut.value === 'cut' });
      });
      const go = this.#textButton('Go', () => {
        this.#actions.onSeek(cue.timeSec);
      });
      const remove = this.#textButton('Delete', () => {
        this.#cues.splice(i, 1);
        this.#changed();
      });
      remove.classList.add('is-danger');
      row.append(time, focus, motion, cut, go, remove);
      table.append(row);
    }
    this.#list.prepend(table);
  }

  /** Writes the list of the screen cues, below the camera cues. */
  #renderScreenList(): void {
    if (this.#screenCues.length === 0 || this.#screenImages.length === 0) {
      return;
    }
    const table = createElement('div', 'director-table');
    const header = createElement('div', 'director-cue director-cue-head');
    for (const text of ['Time', 'Screen image', 'Transition', '', '']) {
      const cell = createElement('span', '', text);
      if (text === 'Screen image') {
        cell.style.gridColumn = 'span 2';
      }
      header.append(cell);
    }
    table.append(header);
    for (const [i, cue] of this.#screenCues.entries()) {
      const row = createElement('div', 'director-cue');
      const set = (change: Partial<ScreenCue>): void => {
        this.#screenCues[i] = { ...cue, ...change };
        this.#changed();
        this.#screenChanged();
      };
      const time = createElement('input');
      time.value = cueTime(cue.timeSec);
      time.setAttribute('aria-label', 'Screen cue time');
      time.addEventListener('change', () => {
        const sec = parseCueTime(time.value);
        if (sec === null) {
          time.value = cueTime(cue.timeSec);
        } else {
          set({ timeSec: Math.round(sec * 10) / 10 });
        }
      });
      const image = createElement('select');
      image.setAttribute('aria-label', 'Screen image');
      const known = this.#screenImages.some((item) => item.id === cue.image);
      for (const item of known
        ? this.#screenImages
        : [...this.#screenImages, { id: cue.image, name: 'Missing image' }]) {
        const option = createElement('option', '', item.name);
        option.value = item.id;
        option.selected = item.id === cue.image;
        image.append(option);
      }
      image.addEventListener('change', () => {
        set({ image: image.value });
      });
      const cut = createElement('select');
      cut.setAttribute('aria-label', 'Screen transition');
      for (const [value, label] of [
        ['fade', 'Fade'],
        ['cut', 'Cut'],
      ] as const) {
        const option = createElement('option', '', label);
        option.value = value;
        option.selected = (value === 'cut') === cue.cut;
        cut.append(option);
      }
      cut.addEventListener('change', () => {
        set({ cut: cut.value === 'cut' });
      });
      const go = this.#textButton('Go', () => {
        this.#actions.onSeek(cue.timeSec);
      });
      const remove = this.#textButton('Delete', () => {
        this.#screenCues.splice(i, 1);
        this.#changed();
        this.#screenChanged();
      });
      remove.classList.add('is-danger');
      image.style.gridColumn = 'span 2';
      row.append(time, image, cut, go, remove);
      table.append(row);
    }
    this.#list.append(table);
  }

  /** The width of the drawing of the song, in CSS pixels. */
  #songWidth(): number {
    const duration = Math.max(1, this.#piece?.durationSec ?? 1);
    const zoom = Number(this.#zoom.value);
    const fit = Math.max(100, this.#scroll.clientWidth - LABEL_PX - 12);
    return zoom > 0 ? Math.min(MAX_CANVAS_PX, Math.max(fit, duration * zoom)) : fit;
  }

  /**
   * Gives the x of a song time on the canvas.
   *
   * @param sec The song time.
   * @returns The x, in CSS pixels.
   */
  #timeX(sec: number): number {
    const duration = Math.max(1, this.#piece?.durationSec ?? 1);
    return LABEL_PX + (Math.min(Math.max(sec, 0), duration) / duration) * this.#songWidth();
  }

  /** Sets the size of the canvas, and draws it. */
  #layout(): void {
    const rows = this.#piece?.rows.length ?? 0;
    const width = LABEL_PX + this.#songWidth() + 8;
    const height = RULER_PX + this.#screenRow + Math.max(1, rows) * ROW_PX + 4;
    const ratio = Math.min(2, window.devicePixelRatio || 1);
    this.#canvas.style.width = `${width}px`;
    this.#canvas.style.height = `${height}px`;
    this.#canvas.width = Math.round(width * ratio);
    this.#canvas.height = Math.round(height * ratio);
    this.#drawTimeline();
  }

  /** Draws the ruler, the rows, the notes, and the cues, then the playhead. */
  #drawTimeline(): void {
    const piece = this.#piece;
    const context = this.#canvas.getContext('2d');
    if (!context || !this.open) {
      return;
    }
    const ratio = this.#canvas.width / Math.max(1, this.#canvas.clientWidth);
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    const width = this.#canvas.clientWidth;
    const height = this.#canvas.clientHeight;
    context.clearRect(0, 0, width, height);
    if (!piece) {
      this.#base = null;
      return;
    }
    const duration = Math.max(1, piece.durationSec);
    const songWidth = this.#songWidth();
    context.font = '11px system-ui, sans-serif';
    context.textBaseline = 'middle';
    // The ruler: a tick every 5 s, or every 10 s or 30 s for a song that is long on screen.
    const pxPerSec = songWidth / duration;
    const step = pxPerSec >= 12 ? 5 : pxPerSec >= 4 ? 10 : pxPerSec >= 1.5 ? 30 : 60;
    context.fillStyle = 'rgba(255, 240, 220, 0.05)';
    context.fillRect(LABEL_PX, 0, songWidth, RULER_PX);
    for (let t = 0; t <= duration; t += step) {
      const x = this.#timeX(t);
      context.fillStyle = 'rgba(255, 240, 220, 0.18)';
      context.fillRect(x, RULER_PX - 6, 1, height);
      context.fillStyle = '#b5aa99';
      context.fillText(cueTime(t).replace(/\.0$/u, ''), x + 3, 8);
    }
    // The row of the screen, with a block for each image from its cue to the next cue.
    const top = RULER_PX + this.#screenRow;
    if (this.#screenRow > 0) {
      this.#drawScreenRow(context, songWidth, duration);
    }
    // The rows and their notes.
    const rowOf = new Map<number, number>();
    for (const [i, row] of piece.rows.entries()) {
      rowOf.set(row.seatIndex, i);
      const y = top + i * ROW_PX;
      if (i % 2 === 0) {
        context.fillStyle = 'rgba(255, 240, 220, 0.035)';
        context.fillRect(0, y, LABEL_PX + songWidth, ROW_PX);
      }
      context.fillStyle = row.onStage ? '#efe8dc' : '#857b6d';
      context.fillText(row.name, 6, y + ROW_PX / 2, LABEL_PX - 10);
    }
    for (const note of piece.notes) {
      const i = rowOf.get(note.seatIndex);
      const row = i === undefined ? undefined : piece.rows[i];
      if (i === undefined || !row) {
        continue;
      }
      const x0 = this.#timeX(note.startSec);
      const x1 = Math.max(x0 + 1, this.#timeX(note.endSec));
      context.fillStyle = row.color;
      context.fillRect(x0, top + i * ROW_PX + 3, x1 - x0, ROW_PX - 6);
    }
    // The cues: a line over all rows, and the name of the focus in the cue track.
    for (const cue of this.#cues) {
      const x = this.#timeX(cue.timeSec);
      context.fillStyle = '#e7b45a';
      context.fillRect(x - 1, RULER_PX - 8, 2, height);
      const seat = focusSeat(cue.focus);
      const i = seat === null ? undefined : rowOf.get(seat);
      if (i !== undefined) {
        context.strokeStyle = '#f0c676';
        context.lineWidth = 2;
        context.strokeRect(x, top + i * ROW_PX + 1, 10, ROW_PX - 2);
      }
      context.fillStyle = '#f0c676';
      context.fillText(this.#focusLabel(cue.focus), x + 4, RULER_PX - 4, 110);
    }
    this.#base = context.getImageData(0, 0, this.#canvas.width, this.#canvas.height);
    this.#drawnAt = -1;
    this.#drawPlayhead(Math.round(this.#timeX(this.#songSec)));
  }

  /**
   * Draws the row "Screen": a block for each image, from its cue to the next cue.
   *
   * @param context The context of the canvas.
   * @param songWidth The width of the song.
   * @param duration The duration of the song.
   */
  #drawScreenRow(context: CanvasRenderingContext2D, songWidth: number, duration: number): void {
    const y = RULER_PX;
    context.fillStyle = 'rgba(126, 182, 230, 0.08)';
    context.fillRect(0, y, LABEL_PX + songWidth, ROW_PX);
    context.fillStyle = '#9cc7ee';
    context.fillText('Screen', 6, y + ROW_PX / 2, LABEL_PX - 10);
    const name = (id: string | null): string =>
      this.#screenImages.find((image) => image.id === id)?.name ?? '';
    const spans: [number, number, string][] = [
      [0, this.#screenCues[0]?.timeSec ?? duration, name(this.#screenImages[0]?.id ?? null)],
    ];
    for (const [i, cue] of this.#screenCues.entries()) {
      spans.push([cue.timeSec, this.#screenCues[i + 1]?.timeSec ?? duration, name(cue.image)]);
    }
    for (const [i, [start, end, label]] of spans.entries()) {
      const x0 = this.#timeX(start);
      const x1 = Math.max(x0 + 1, this.#timeX(end));
      context.fillStyle = i === 0 ? 'rgba(126, 182, 230, 0.16)' : 'rgba(126, 182, 230, 0.32)';
      context.fillRect(x0 + 1, y + 2, x1 - x0 - 2, ROW_PX - 4);
      if (i > 0) {
        context.fillStyle = '#9cc7ee';
        context.fillRect(x0 - 1, y, 2, ROW_PX);
      }
      context.fillStyle = '#e6f1fb';
      context.fillText(label, x0 + 4, y + ROW_PX / 2, Math.max(0, x1 - x0 - 8));
    }
  }

  /**
   * Draws the playhead over the drawing of the timeline.
   *
   * @param x The x of the playhead, in CSS pixels.
   */
  #drawPlayhead(x: number): void {
    const context = this.#canvas.getContext('2d');
    if (!context || !this.#base) {
      return;
    }
    context.putImageData(this.#base, 0, 0);
    context.fillStyle = '#ffffff';
    context.fillRect(x, 0, 1.5, this.#canvas.clientHeight);
    this.#drawnAt = x;
    // Keep the playhead in view during play.
    const left = this.#scroll.scrollLeft;
    const view = this.#scroll.clientWidth;
    if (x < left + LABEL_PX || x > left + view - 20) {
      this.#scroll.scrollLeft = Math.max(0, x - LABEL_PX - 40);
    }
  }

  /**
   * Adds a cue at a click on a row, or seeks at a click on the ruler.
   *
   * @param event The click.
   */
  #clickTimeline(event: MouseEvent): void {
    const piece = this.#piece;
    if (!piece) {
      return;
    }
    const box = this.#canvas.getBoundingClientRect();
    const x = event.clientX - box.left;
    const y = event.clientY - box.top;
    if (x < LABEL_PX) {
      return;
    }
    const sec = ((x - LABEL_PX) / this.#songWidth()) * Math.max(1, piece.durationSec);
    if (y < RULER_PX) {
      this.#actions.onSeek(Math.max(0, sec));
      return;
    }
    if (y < RULER_PX + this.#screenRow) {
      this.#addScreenCue(sec);
      return;
    }
    const row = piece.rows[Math.floor((y - RULER_PX - this.#screenRow) / ROW_PX)];
    if (!row?.onStage) {
      return;
    }
    this.#addCue({
      timeSec: sec,
      focus: `seat:${row.seatIndex}`,
      motion: 'push-in',
      cut: false,
    });
  }
}
