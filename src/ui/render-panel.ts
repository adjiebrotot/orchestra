import { RENDER_FORMATS } from '../app/render-formats.ts';
import type { RenderFormat, RenderOptions } from '../app/render-formats.ts';
import type { RenderTitleLines } from '../app/render-titles.ts';
import { isRecord } from '../scene/backdrop-settings.ts';
import type { Json, JsonRecord } from '../scene/backdrop-settings.ts';
import { createButton, createElement } from './dom.ts';

/** The key of the choices of the panel in the local storage. */
const STORE_KEY = 'orchestra.render-options';

/** The longest title and subtitle, in characters. */
const TITLE_MAX = 120;

/**
 * Reads the stored choices of the panel. The storage can be empty or blocked, so each failure
 * gives the defaults.
 *
 * @returns The choices.
 */
function readOptions(): RenderOptions {
  const defaults: RenderOptions = { bow: true, titles: true };
  try {
    const text = localStorage.getItem(STORE_KEY);
    const data: Json = text ? JSON.parse(text) : null;
    const record: JsonRecord = isRecord(data) ? data : {};
    const bow = record['bow'];
    const titles = record['titles'];
    return {
      bow: bow === true || bow === false ? bow : defaults.bow,
      titles: titles === true || titles === false ? titles : defaults.titles,
    };
  } catch {
    // The browser keeps no data, for example in a private window, or the data is broken.
    return defaults;
  }
}

/**
 * Stores the choices of the panel. A blocked storage keeps them for the page only.
 *
 * @param options The choices.
 */
function storeOptions(options: RenderOptions): void {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(options));
  } catch {
    // The choices stay for this page.
  }
}

/** The actions of the render panel. */
export interface RenderPanelActions {
  /** A click on "Render": start a render of the format with the choices. */
  readonly onStart: (format: RenderFormat, options: RenderOptions) => void;
  /** An edit of the title or the subtitle of the title card. */
  readonly onTitles: (lines: RenderTitleLines) => void;
  /** A click on "Stop" during a render. */
  readonly onCancel: () => void;
}

/**
 * The state of the render that the panel shows. The progress bar has a different look in each
 * state, so a render that works, a render that waits, and a render that failed look different.
 *
 * - `idle`: no render runs.
 * - `busy`: the render works. The bar moves.
 * - `warn`: the render waits for something that can fail. The bar stops and changes its color.
 * - `error`: the render failed. The bar is full, in the color of an error.
 * - `done`: the file is ready.
 */
export type RenderPanelState = 'idle' | 'busy' | 'warn' | 'error' | 'done';

/**
 * The panel of the MP4 render: the format menu and the start button, then the progress of the
 * render, and at the end the download link of the file.
 */
export class RenderPanel {
  readonly element: HTMLElement;
  readonly #format: HTMLSelectElement;
  readonly #start: HTMLButtonElement;
  readonly #stop: HTMLButtonElement;
  readonly #bar: HTMLElement;
  readonly #track: HTMLElement;
  readonly #status: HTMLElement;
  readonly #link: HTMLAnchorElement;
  readonly #bow: HTMLInputElement;
  readonly #titles: HTMLInputElement;
  readonly #title: HTMLInputElement;
  readonly #subtitle: HTMLInputElement;
  #running = false;

  /**
   * Creates the panel. It starts hidden.
   *
   * @param actions The actions.
   */
  constructor(actions: RenderPanelActions) {
    this.element = createElement('section', 'render-panel');
    this.element.hidden = true;
    this.element.setAttribute('aria-label', 'Render MP4');
    const head = createElement('div', 'render-head');
    const close = createButton('director-close', 'Close');
    close.textContent = '×';
    close.addEventListener('click', () => {
      if (!this.#running) {
        this.setOpen(false);
      }
    });
    head.append(createElement('h3', '', 'Render to MP4'), close);
    const text = createElement(
      'p',
      'render-hint',
      'The film plays once from the start with the cinematic camera (your camera path when it is on), and the page records it. Keep this tab visible until the end. The render takes as long as the piece.',
    );
    const stored = readOptions();
    const store = (): void => {
      storeOptions(this.options);
    };
    this.#bow = this.#checkbox(stored.bow, store);
    this.#titles = this.#checkbox(stored.titles, () => {
      store();
      this.#showTitleFields();
    });
    const edit = (): void => {
      actions.onTitles(this.titles);
    };
    this.#title = this.#textField('Title', 'The piece title', edit);
    this.#subtitle = this.#textField('Subtitle', 'The small line above the title', edit);
    const options = createElement('div', 'render-options');
    options.append(
      this.#switch(this.#bow, 'Include the ending: the bow of the conductor'),
      this.#switch(this.#titles, 'Include the titles at the start'),
      this.#field('Title', this.#title),
      this.#field('Subtitle', this.#subtitle),
    );
    this.#showTitleFields();
    this.#format = createElement('select');
    this.#format.setAttribute('aria-label', 'Video format');
    for (const [i, [label]] of RENDER_FORMATS.entries()) {
      const option = createElement('option', '', label);
      option.value = String(i);
      this.#format.append(option);
    }
    this.#start = createButton('director-button is-accent', '');
    this.#start.removeAttribute('aria-label');
    this.#start.textContent = 'Render';
    this.#start.addEventListener('click', () => {
      const format = RENDER_FORMATS[Number(this.#format.value)]?.[1];
      if (format) {
        actions.onStart(format, this.options);
      }
    });
    this.#stop = createButton('director-button is-danger', '');
    this.#stop.removeAttribute('aria-label');
    this.#stop.textContent = 'Stop';
    this.#stop.hidden = true;
    this.#stop.addEventListener('click', () => {
      actions.onCancel();
    });
    const row = createElement('div', 'render-row');
    row.append(this.#format, this.#start, this.#stop);
    const track = createElement('div', 'render-track');
    this.#bar = createElement('div', 'render-fill');
    track.append(this.#bar);
    track.setAttribute('role', 'progressbar');
    track.setAttribute('aria-label', 'Render progress');
    track.setAttribute('aria-valuemin', '0');
    track.setAttribute('aria-valuemax', '100');
    this.#track = track;
    this.#status = createElement('p', 'render-status');
    this.#status.setAttribute('aria-live', 'polite');
    this.element.dataset['state'] = 'idle';
    this.#link = createElement('a', 'director-button is-accent render-link');
    this.#link.hidden = true;
    this.element.append(head, text, row, options, track, this.#status, this.#link);
  }

  /** The choices of the panel. */
  get options(): RenderOptions {
    return { bow: this.#bow.checked, titles: this.#titles.checked };
  }

  /** The lines of the title card in the fields. */
  get titles(): RenderTitleLines {
    return { title: this.#title.value, subtitle: this.#subtitle.value };
  }

  /**
   * Writes the lines of the title card of a new piece into the fields.
   *
   * @param lines The lines.
   */
  setTitles(lines: RenderTitleLines): void {
    this.#title.value = lines.title;
    this.#subtitle.value = lines.subtitle;
  }

  /**
   * Makes a checkbox.
   *
   * @param checked The first state.
   * @param change Called after each change.
   * @returns The checkbox.
   */
  #checkbox(checked: boolean, change: () => void): HTMLInputElement {
    const box = createElement('input');
    box.type = 'checkbox';
    box.checked = checked;
    box.addEventListener('change', change);
    return box;
  }

  /**
   * Makes a text field of the title card. Each key changes the card at once.
   *
   * @param label The name of the field.
   * @param placeholder The text of the empty field.
   * @param change Called after each edit.
   * @returns The field.
   */
  #textField(label: string, placeholder: string, change: () => void): HTMLInputElement {
    const input = createElement('input', 'render-text');
    input.type = 'text';
    input.maxLength = TITLE_MAX;
    input.placeholder = placeholder;
    input.setAttribute('aria-label', label);
    input.addEventListener('input', change);
    return input;
  }

  /**
   * Makes the label of a checkbox.
   *
   * @param box The checkbox.
   * @param text The text.
   * @returns The label.
   */
  #switch(box: HTMLInputElement, text: string): HTMLElement {
    const label = createElement('label', 'director-switch');
    label.append(box, document.createTextNode(text));
    return label;
  }

  /**
   * Makes the row of a text field, with its name.
   *
   * @param name The name.
   * @param input The field.
   * @returns The row.
   */
  #field(name: string, input: HTMLInputElement): HTMLElement {
    const row = createElement('label', 'render-field');
    row.append(createElement('span', '', name), input);
    return row;
  }

  /** Shows the fields of the title card only when the titles are on. */
  #showTitleFields(): void {
    for (const input of [this.#title, this.#subtitle]) {
      const row = input.parentElement;
      if (row) {
        row.hidden = !this.#titles.checked;
      }
    }
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
  }

  /**
   * Shows the state of the render.
   *
   * @param state The state. A render runs in the states `busy` and `warn`.
   * @param progress The part that is done, from 0 to 1. The state `error` shows a full bar.
   * @param status The status line.
   */
  show(state: RenderPanelState, progress: number, status: string): void {
    const running = state === 'busy' || state === 'warn';
    const part = state === 'error' ? 1 : Math.max(0, Math.min(1, progress));
    this.#running = running;
    this.#start.hidden = running;
    this.#stop.hidden = !running;
    this.#format.disabled = running;
    this.#bow.disabled = running;
    this.#titles.disabled = running;
    if (this.element.dataset['state'] !== state) {
      this.element.dataset['state'] = state;
    }
    this.#bar.style.transform = `scaleX(${part})`;
    this.#track.setAttribute('aria-valuenow', String(Math.round(part * 100)));
    if (this.#status.textContent !== status) {
      this.#status.textContent = status;
    }
    if (running) {
      this.#link.hidden = true;
    }
  }

  /**
   * Shows the download link of a finished file, and starts the download.
   *
   * @param file The MP4 file.
   * @param name The file name.
   */
  showFile(file: Blob, name: string): void {
    if (this.#link.href) {
      URL.revokeObjectURL(this.#link.href);
    }
    this.#link.href = URL.createObjectURL(file);
    this.#link.download = name;
    this.#link.textContent = `Download ${name} (${(file.size / 1e6).toFixed(1)} MB)`;
    this.#link.hidden = false;
    this.#link.click();
  }
}
