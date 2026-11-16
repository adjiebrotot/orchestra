import { RENDER_FORMATS } from '../app/render-formats.ts';
import type { RenderFormat } from '../app/render-formats.ts';
import { createButton, createElement } from './dom.ts';

/** The actions of the render panel. */
export interface RenderPanelActions {
  /** A click on "Render": start a render of the format. */
  readonly onStart: (format: RenderFormat) => void;
  /** A click on "Stop" during a render. */
  readonly onCancel: () => void;
}

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
  readonly #status: HTMLElement;
  readonly #link: HTMLAnchorElement;
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
        actions.onStart(format);
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
    this.#status = createElement('p', 'render-status');
    this.#status.setAttribute('aria-live', 'polite');
    this.#link = createElement('a', 'director-button is-accent render-link');
    this.#link.hidden = true;
    this.element.append(head, text, row, track, this.#status, this.#link);
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
   * @param running True while a render runs.
   * @param progress The part that is done, from 0 to 1.
   * @param status The status line.
   */
  show(running: boolean, progress: number, status: string): void {
    this.#running = running;
    this.#start.hidden = running;
    this.#stop.hidden = !running;
    this.#format.disabled = running;
    this.#bar.style.transform = `scaleX(${Math.max(0, Math.min(1, progress))})`;
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
