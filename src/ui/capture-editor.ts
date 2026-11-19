import {
  CAPTURE_ASPECTS,
  CAPTURE_QUALITY,
  CAPTURE_SHORT_SIDES,
  CAPTURE_TYPES,
  captureFileName,
  captureSize,
  drawCapture,
  newCaptureText,
} from '../app/capture-image.ts';
import type { CaptureFont, CaptureSize, CaptureText } from '../app/capture-image.ts';
import type { RenderTitleFonts, RenderTitleLines } from '../app/render-titles.ts';
import { isRecord } from '../scene/backdrop-settings.ts';
import type { Json, JsonRecord } from '../scene/backdrop-settings.ts';
import type { FrameBox } from '../scene/letterbox.ts';
import { createButton, createElement } from './dom.ts';
import { ModalDialog } from './modal-dialog.ts';

/** The key of the choices of the editor in the local storage. */
const STORE_KEY = 'orchestra.capture-options';

/** The places of the menu "Move to", as the middle of the text in parts of the image. */
const PLACES: readonly (readonly [string, number, number])[] = [
  ['Top left', 0.25, 0.15],
  ['Top', 0.5, 0.15],
  ['Top right', 0.75, 0.15],
  ['Left', 0.25, 0.5],
  ['Middle', 0.5, 0.5],
  ['Right', 0.75, 0.5],
  ['Bottom left', 0.25, 0.85],
  ['Bottom', 0.5, 0.85],
  ['Bottom right', 0.75, 0.85],
];

/** The choices of the editor that the page stores. */
interface CaptureOptions {
  /** The index of the aspect in `CAPTURE_ASPECTS`. */
  readonly aspect: number;
  /** The length of the short side, from `CAPTURE_SHORT_SIDES`. */
  readonly shortSide: number;
  /** The index of the file type in `CAPTURE_TYPES`. */
  readonly type: number;
  /** The darkness of the shade from the bottom edge, from 0 to 1. */
  readonly shade: number;
  /** True to draw the title card of the piece. */
  readonly titleCard: boolean;
}

/** The choices of a first visit. */
const DEFAULT_OPTIONS: CaptureOptions = {
  aspect: 0,
  shortSide: 720,
  type: 0,
  shade: 0,
  titleCard: false,
};

/**
 * Reads a whole number of a stored record in a range.
 *
 * @param record The record.
 * @param key The key.
 * @param count The end of the range, which it excludes.
 * @param fallback The value of a missing or a wrong number.
 * @returns The number.
 */
function indexOf(record: JsonRecord, key: string, count: number, fallback: number): number {
  const value = record[key];
  return Number.isInteger(value) && Number(value) >= 0 && Number(value) < count
    ? Number(value)
    : fallback;
}

/**
 * Reads the stored choices of the editor. The storage can be empty or blocked, so each failure
 * gives the defaults.
 *
 * @returns The choices.
 */
function readOptions(): CaptureOptions {
  try {
    const text = localStorage.getItem(STORE_KEY);
    const data: Json = text ? JSON.parse(text) : null;
    const record: JsonRecord = isRecord(data) ? data : {};
    const shortSide = record['shortSide'];
    const shade = record['shade'];
    const titleCard = record['titleCard'];
    return {
      aspect: indexOf(record, 'aspect', CAPTURE_ASPECTS.length, DEFAULT_OPTIONS.aspect),
      shortSide: CAPTURE_SHORT_SIDES.includes(Number(shortSide))
        ? Number(shortSide)
        : DEFAULT_OPTIONS.shortSide,
      type: indexOf(record, 'type', CAPTURE_TYPES.length, DEFAULT_OPTIONS.type),
      shade:
        Number.isFinite(shade) && Number(shade) >= 0 && Number(shade) <= 1
          ? Number(shade)
          : DEFAULT_OPTIONS.shade,
      titleCard: titleCard === true || titleCard === false ? titleCard : DEFAULT_OPTIONS.titleCard,
    };
  } catch {
    // The browser keeps no data, for example in a private window, or the data is broken.
    return DEFAULT_OPTIONS;
  }
}

/**
 * Stores the choices of the editor. A blocked storage keeps them for the page only.
 *
 * @param options The choices.
 */
function storeOptions(options: CaptureOptions): void {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(options));
  } catch {
    // The choices stay for this page.
  }
}

/** The actions of the capture editor. */
export interface CaptureEditorActions {
  /**
   * Asks the app for a still of the stage at a size. The app renders it in its next frame.
   *
   * @param size The size of the image, in pixels.
   * @returns The still, on a canvas of that size.
   */
  readonly onStill: (size: CaptureSize) => Promise<HTMLCanvasElement>;
}

/**
 * The editor of a capture (design 2.5, capture): a modal dialog with the still of the stage, the
 * aspect and the resolution of the image, the title card, a shade, and texts that a drag on the
 * image moves. "Save image" writes the image to a file. A change of the aspect or of the
 * resolution renders a new still, so the shot fills the new frame in place of a crop.
 */
export class CaptureEditor {
  readonly #dialog: ModalDialog;
  readonly #actions: CaptureEditorActions;
  readonly #preview: HTMLCanvasElement;
  readonly #status: HTMLElement;
  readonly #aspect: HTMLSelectElement;
  readonly #shortSide: HTMLSelectElement;
  readonly #sizeText: HTMLElement;
  readonly #titleCard: HTMLInputElement;
  readonly #shade: HTMLInputElement;
  readonly #type: HTMLSelectElement;
  readonly #save: HTMLButtonElement;
  readonly #list: HTMLElement;
  /** The texts over the image. They stay for the session, so the next capture keeps them. */
  readonly #texts: CaptureText[] = [];
  /** The editor of each text, in the order of {@link CaptureEditor.#texts}. */
  readonly #items: HTMLElement[] = [];
  /** The box of each text in the last drawing, in pixels of the image. */
  #boxes: FrameBox[] = [];
  /** The text that the user edits or drags, or -1. */
  #selected = -1;
  /** The still of the stage, or `null` while it renders. */
  #still: HTMLCanvasElement | null = null;
  /** The number of the last still that the editor asked, so an older still does not show. */
  #stillId = 0;
  /** The lines of the title card of the piece. */
  #lines: RenderTitleLines = { title: '', subtitle: '' };
  /** The font families of the page. */
  #fonts: RenderTitleFonts = { serif: 'serif', sans: 'sans-serif' };
  /** The frame request of the next drawing, or 0. */
  #drawFrame = 0;
  /** The drag of a text: its index, and the last point of the pointer in parts of the image. */
  #drag: { readonly index: number; x: number; y: number } | null = null;

  /**
   * Creates the closed editor.
   *
   * @param actions The actions.
   */
  constructor(actions: CaptureEditorActions) {
    this.#actions = actions;
    const stored = readOptions();

    this.#preview = createElement('canvas', 'capture-preview');
    this.#preview.setAttribute('role', 'img');
    this.#preview.setAttribute('aria-label', 'The image of the capture');
    this.#preview.addEventListener('pointerdown', (event) => {
      this.#pressPreview(event);
    });
    this.#preview.addEventListener('pointermove', (event) => {
      this.#movePreview(event);
    });
    for (const name of ['pointerup', 'pointercancel'] as const) {
      this.#preview.addEventListener(name, () => {
        this.#drag = null;
      });
    }
    this.#status = createElement('p', 'capture-status');
    this.#status.setAttribute('aria-live', 'polite');
    const view = createElement('div', 'capture-view');
    view.append(this.#preview, this.#status);

    this.#aspect = this.#select(
      'Aspect',
      CAPTURE_ASPECTS.map((aspect) => aspect.label),
      stored.aspect,
    );
    this.#shortSide = this.#select(
      'Resolution',
      CAPTURE_SHORT_SIDES.map((side) => `${side}p`),
      Math.max(0, CAPTURE_SHORT_SIDES.indexOf(stored.shortSide)),
    );
    for (const select of [this.#aspect, this.#shortSide]) {
      select.addEventListener('change', () => {
        this.#store();
        this.#takeStill();
      });
    }
    this.#sizeText = createElement('span', 'capture-size');
    const size = createElement('div', 'capture-group');
    size.append(
      createElement('h3', '', 'Image'),
      this.#row('Aspect', this.#aspect),
      this.#row('Resolution', this.#shortSide),
      this.#sizeText,
    );

    this.#titleCard = createElement('input');
    this.#titleCard.type = 'checkbox';
    this.#titleCard.checked = stored.titleCard;
    this.#shade = createElement('input');
    this.#shade.type = 'range';
    this.#shade.min = '0';
    this.#shade.max = '1';
    this.#shade.step = '0.05';
    this.#shade.value = String(stored.shade);
    this.#shade.setAttribute('aria-label', 'Shade from the bottom');
    for (const input of [this.#titleCard, this.#shade]) {
      input.addEventListener('input', () => {
        this.#store();
        this.#requestDraw();
      });
    }
    const titleLabel = createElement('label', 'director-switch');
    titleLabel.append(this.#titleCard, document.createTextNode('Title card of the piece'));
    const look = createElement('div', 'capture-group');
    look.append(createElement('h3', '', 'Look'), titleLabel, this.#row('Shade', this.#shade));

    this.#list = createElement('div', 'capture-texts');
    const add = createButton('director-button', '');
    add.textContent = 'Add text';
    add.addEventListener('click', () => {
      this.#addText(newCaptureText());
    });
    const textsHead = createElement('div', 'capture-texts-head');
    textsHead.append(createElement('h3', '', 'Texts'), add);
    const texts = createElement('div', 'capture-group');
    texts.append(
      textsHead,
      createElement('p', 'render-hint', 'Drag a text on the image to move it.'),
      this.#list,
    );

    const tools = createElement('div', 'capture-tools');
    tools.append(size, look, texts);
    const layout = createElement('div', 'capture-layout');
    layout.append(view, tools);

    this.#type = this.#select(
      'File type',
      CAPTURE_TYPES.map(([label]) => label),
      stored.type,
    );
    this.#type.addEventListener('change', () => {
      this.#store();
    });
    this.#save = createButton('director-button is-accent', '');
    this.#save.textContent = 'Save image';
    this.#save.addEventListener('click', () => {
      this.#saveImage().catch((error: Error) => {
        this.#status.textContent = `The image was not saved: ${error.message}`;
      });
    });
    const back = createButton('director-button', '');
    back.textContent = 'Back to the stage';
    back.addEventListener('click', () => {
      this.#dialog.close();
    });
    const actionsRow = createElement('div', 'capture-actions');
    actionsRow.append(
      createElement(
        'p',
        'render-hint',
        'To change the moment or the camera, go back to the stage, then press "Capture" again. Your texts stay.',
      ),
      this.#type,
      back,
      this.#save,
    );

    this.#dialog = new ModalDialog('capture-editor', 'Capture', 'Close', layout, actionsRow);
    this.#showSize();
  }

  /** The `<dialog>` element of the editor. */
  get element(): HTMLDialogElement {
    return this.#dialog.element;
  }

  /** True while the editor is open. */
  get open(): boolean {
    return this.#dialog.open;
  }

  /**
   * Opens the editor and asks for a still of the stage.
   *
   * @param opener The control that opens the editor, which gets the focus when it closes.
   * @param lines The lines of the title card of the piece.
   * @param fonts The font families of the page.
   */
  show(opener: HTMLElement, lines: RenderTitleLines, fonts: RenderTitleFonts): void {
    this.#lines = lines;
    this.#fonts = fonts;
    this.#dialog.show(opener);
    this.#takeStill();
    // The bold weights of the texts can load only now, so the image draws again after them.
    const loads = ['400', '800'].flatMap((weight) =>
      [fonts.serif, fonts.sans].map(async (family) =>
        document.fonts.load(`${weight} 40px ${family}`),
      ),
    );
    Promise.allSettled(loads)
      .then(() => {
        this.#requestDraw();
      })
      .catch(() => undefined);
  }

  /** The size of the image of the current choices. */
  get #size(): CaptureSize {
    const aspect = CAPTURE_ASPECTS[Number(this.#aspect.value)] ?? CAPTURE_ASPECTS[0];
    const shortSide = CAPTURE_SHORT_SIDES[Number(this.#shortSide.value)] ?? 720;
    return aspect ? captureSize(aspect, shortSide) : { width: 1280, height: 720 };
  }

  /** Stores the choices of the editor. */
  #store(): void {
    storeOptions({
      aspect: Number(this.#aspect.value),
      shortSide: CAPTURE_SHORT_SIDES[Number(this.#shortSide.value)] ?? DEFAULT_OPTIONS.shortSide,
      type: Number(this.#type.value),
      shade: Number(this.#shade.value),
      titleCard: this.#titleCard.checked,
    });
  }

  /** Writes the size of the image under the menus. */
  #showSize(): void {
    const { width, height } = this.#size;
    this.#sizeText.textContent = `${width} × ${height} pixels`;
  }

  /** Asks the app for a new still at the size of the choices. */
  #takeStill(): void {
    const size = this.#size;
    const id = ++this.#stillId;
    this.#showSize();
    this.#save.disabled = true;
    this.#status.textContent = `Rendering the stage at ${size.width} × ${size.height}…`;
    this.#actions
      .onStill(size)
      .then((still) => {
        if (id !== this.#stillId) {
          return;
        }
        this.#still = still;
        this.#preview.width = still.width;
        this.#preview.height = still.height;
        this.#save.disabled = false;
        this.#status.textContent = '';
        this.#requestDraw();
      })
      .catch((error: Error) => {
        this.#status.textContent = `The stage did not render: ${error.message}`;
      });
  }

  /** Draws the preview in the next frame of the browser, one time for many changes. */
  #requestDraw(): void {
    if (this.#drawFrame !== 0) {
      return;
    }
    this.#drawFrame = requestAnimationFrame(() => {
      this.#drawFrame = 0;
      this.#drawPreview();
    });
  }

  /** Draws the image into the preview, with a frame around the selected text. */
  #drawPreview(): void {
    const context = this.#preview.getContext('2d');
    if (!context || !this.#still) {
      return;
    }
    this.#boxes = this.#draw(context, this.#still);
    const box = this.#boxes[this.#selected];
    if (box) {
      const unit = Math.min(this.#preview.width, this.#preview.height);
      const pad = unit * 0.012;
      context.save();
      context.lineWidth = Math.max(1, unit / 400);
      context.setLineDash([unit * 0.015, unit * 0.01]);
      context.strokeStyle = '#e7b45a';
      context.strokeRect(
        box.x - box.width / 2 - pad,
        box.y - box.height / 2 - pad,
        box.width + 2 * pad,
        box.height + 2 * pad,
      );
      context.restore();
    }
  }

  /**
   * Draws the image of the capture.
   *
   * @param context The context, at the size of the image.
   * @param still The still of the stage.
   * @returns The box of each text.
   */
  #draw(context: CanvasRenderingContext2D, still: HTMLCanvasElement): FrameBox[] {
    return drawCapture(context, {
      still,
      titleCard: this.#titleCard.checked ? this.#lines : null,
      shade: Number(this.#shade.value),
      texts: this.#texts,
      fonts: this.#fonts,
    });
  }

  /** Writes the image to a file of the chosen type, with no frame around the selected text. */
  async #saveImage(): Promise<void> {
    const still = this.#still;
    if (!still) {
      return;
    }
    const canvas = createElement('canvas');
    canvas.width = still.width;
    canvas.height = still.height;
    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('This browser gave no 2D canvas.');
    }
    this.#draw(context, still);
    const [, mime] = CAPTURE_TYPES[Number(this.#type.value)] ?? CAPTURE_TYPES[0];
    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, mime, CAPTURE_QUALITY);
    });
    if (!blob) {
      throw new Error('The browser could not encode the image.');
    }
    // A browser with no encoder of a type gives a PNG file.
    const extension = CAPTURE_TYPES.find(([, type]) => type === blob.type)?.[2] ?? 'png';
    const name = captureFileName(this.#lines.title, still, extension);
    const link = createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = name;
    link.click();
    window.setTimeout(() => {
      URL.revokeObjectURL(link.href);
    }, 10_000);
    this.#status.textContent = `Saved ${name} (${(blob.size / 1e6).toFixed(1)} MB).`;
  }

  /**
   * Adds a text and its editor, and selects it.
   *
   * @param text The text.
   */
  #addText(text: CaptureText): void {
    this.#texts.push(text);
    const item = this.#textItem(text);
    this.#items.push(item);
    this.#list.append(item);
    this.#selectText(this.#texts.length - 1);
    item.querySelector('textarea')?.select();
    this.#requestDraw();
  }

  /**
   * Removes a text and its editor.
   *
   * @param text The text.
   */
  #removeText(text: CaptureText): void {
    const index = this.#texts.indexOf(text);
    if (index < 0) {
      return;
    }
    this.#texts.splice(index, 1);
    this.#items.splice(index, 1)[0]?.remove();
    this.#selectText(-1);
    this.#requestDraw();
  }

  /**
   * Selects a text: its editor shows as selected, and the preview frames it.
   *
   * @param index The index of the text, or -1 for none.
   */
  #selectText(index: number): void {
    if (index === this.#selected) {
      return;
    }
    this.#selected = index;
    for (const [i, item] of this.#items.entries()) {
      item.classList.toggle('is-selected', i === index);
    }
    this.#requestDraw();
  }

  /**
   * Makes the editor of a text: the text, the font, the size, the color, the weight, the outline,
   * the menu "Move to", and the remove button.
   *
   * @param text The text. The controls change it in place.
   * @returns The editor.
   */
  #textItem(text: CaptureText): HTMLElement {
    const item = createElement('div', 'capture-text-item');
    const change = (): void => {
      this.#requestDraw();
    };
    item.addEventListener('focusin', () => {
      this.#selectText(this.#texts.indexOf(text));
    });

    const area = createElement('textarea', 'render-text capture-text-input');
    area.rows = 2;
    area.value = text.text;
    area.setAttribute('aria-label', 'Text');
    area.addEventListener('input', () => {
      text.text = area.value;
      change();
    });

    const font = this.#select('Font', ['Sans', 'Serif'], text.font === 'serif' ? 1 : 0);
    font.addEventListener('change', () => {
      const fonts: readonly CaptureFont[] = ['sans', 'serif'];
      text.font = fonts[Number(font.value)] ?? 'sans';
      change();
    });

    const size = createElement('input');
    size.type = 'range';
    size.min = '0.02';
    size.max = '0.3';
    size.step = '0.005';
    size.value = String(text.size);
    size.setAttribute('aria-label', 'Size');
    size.addEventListener('input', () => {
      text.size = Number(size.value);
      change();
    });

    const color = createElement('input', 'capture-color');
    color.type = 'color';
    color.value = text.color;
    color.setAttribute('aria-label', 'Color');
    color.addEventListener('input', () => {
      text.color = color.value;
      change();
    });

    const bold = this.#toggle('Bold', text.bold, (on) => {
      text.bold = on;
      change();
    });
    const outline = this.#toggle('Outline', text.outline, (on) => {
      text.outline = on;
      change();
    });

    const place = this.#select('Move to', ['Move to…', ...PLACES.map(([label]) => label)], 0);
    place.addEventListener('change', () => {
      const target = PLACES[Number(place.value) - 1];
      if (target) {
        [, text.x, text.y] = target;
        change();
      }
      place.value = '0';
    });

    const remove = createButton('director-button is-danger', 'Remove the text');
    remove.textContent = 'Remove';
    remove.addEventListener('click', () => {
      this.#removeText(text);
    });

    const row = createElement('div', 'capture-text-row');
    row.append(font, color, bold, outline, place, remove);
    item.append(area, this.#row('Size', size), row);
    return item;
  }

  /**
   * Makes a menu.
   *
   * @param label The accessible name.
   * @param options The names of the options. The value of each option is its index.
   * @param value The index of the chosen option.
   * @returns The menu.
   */
  #select(label: string, options: readonly string[], value: number): HTMLSelectElement {
    const select = createElement('select');
    select.setAttribute('aria-label', label);
    for (const [i, text] of options.entries()) {
      const option = createElement('option', '', text);
      option.value = String(i);
      select.append(option);
    }
    select.value = String(value);
    return select;
  }

  /**
   * Makes a checkbox with its label.
   *
   * @param text The label.
   * @param checked The first state.
   * @param change Called with the new state after each change.
   * @returns The label with the checkbox.
   */
  #toggle(text: string, checked: boolean, change: (on: boolean) => void): HTMLElement {
    const box = createElement('input');
    box.type = 'checkbox';
    box.checked = checked;
    box.addEventListener('change', () => {
      change(box.checked);
    });
    const label = createElement('label', 'director-switch');
    label.append(box, document.createTextNode(text));
    return label;
  }

  /**
   * Makes a row with a name and a control.
   *
   * @param name The name.
   * @param control The control.
   * @returns The row.
   */
  #row(name: string, control: HTMLElement): HTMLElement {
    const row = createElement('label', 'render-field');
    row.append(createElement('span', '', name), control);
    return row;
  }

  /**
   * Gives the point of a pointer event in parts of the image.
   *
   * @param event The event.
   * @returns The point, from 0 to 1 on each axis.
   */
  #pointOf(event: PointerEvent): readonly [number, number] {
    const rect = this.#preview.getBoundingClientRect();
    return [(event.clientX - rect.left) / rect.width, (event.clientY - rect.top) / rect.height];
  }

  /**
   * Starts the drag of the text under a press on the preview, and selects it. A press on no text
   * clears the selection.
   *
   * @param event The event.
   */
  #pressPreview(event: PointerEvent): void {
    const [x, y] = this.#pointOf(event);
    const px = x * this.#preview.width;
    const py = y * this.#preview.height;
    const pad = Math.min(this.#preview.width, this.#preview.height) * 0.02;
    let index = -1;
    for (let i = this.#boxes.length - 1; i >= 0 && index < 0; i--) {
      const box = this.#boxes[i];
      if (
        box &&
        Math.abs(px - box.x) <= box.width / 2 + pad &&
        Math.abs(py - box.y) <= box.height / 2 + pad
      ) {
        index = i;
      }
    }
    this.#selectText(index);
    if (index >= 0) {
      event.preventDefault();
      this.#preview.setPointerCapture(event.pointerId);
      this.#drag = { index, x, y };
    }
  }

  /**
   * Moves the dragged text with the pointer. The middle of the text stays inside the image.
   *
   * @param event The event.
   */
  #movePreview(event: PointerEvent): void {
    const drag = this.#drag;
    const text = drag ? this.#texts[drag.index] : undefined;
    if (!drag || !text) {
      return;
    }
    const [x, y] = this.#pointOf(event);
    text.x = Math.min(1, Math.max(0, text.x + x - drag.x));
    text.y = Math.min(1, Math.max(0, text.y + y - drag.y));
    drag.x = x;
    drag.y = y;
    this.#requestDraw();
  }
}
