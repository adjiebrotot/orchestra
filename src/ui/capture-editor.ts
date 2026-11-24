import {
  CAPTURE_ASPECTS,
  CAPTURE_QUALITY,
  CAPTURE_SHORT_SIDES,
  CAPTURE_TYPES,
  applyStyle,
  boxHolds,
  captureFileName,
  captureSize,
  drawCapture,
  newCaptureSticker,
  newCaptureText,
} from '../app/capture-image.ts';
import type {
  CaptureBox,
  CaptureItem,
  CaptureSize,
  CaptureSticker,
  CaptureText,
} from '../app/capture-image.ts';
import { STICKER_CUTS } from '../app/capture-stickers.ts';
import { CAPTURE_STYLES, stylePreset } from '../app/capture-text-styles.ts';
import type { CaptureFont } from '../app/capture-text-styles.ts';
import type { RenderTitleFonts, RenderTitleLines } from '../app/render-titles.ts';
import { isRecord } from '../scene/backdrop-settings.ts';
import type { Json, JsonRecord } from '../scene/backdrop-settings.ts';
import { COUNTRY_FLAGS, flagName, loadFlagArt } from '../scene/country-flags.ts';
import { createCombobox } from './combobox.ts';
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

/** A field with its label. */
interface LabeledInput {
  /** The label, which holds the field. */
  readonly label: HTMLElement;
  readonly input: HTMLInputElement;
}

/** A color field with its label and its name, which a change of style rewrites. */
interface ColorField extends LabeledInput {
  readonly name: HTMLElement;
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
 * aspect and the resolution of the image, the title card, a shade, and texts in many styles and flag stickers that a drag on the
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
  /**
   * The texts and the stickers over the image, from the back to the front. They stay for the
   * session, so the next capture keeps them.
   */
  readonly #items: CaptureItem[] = [];
  /** The editor of each part, in the order of {@link CaptureEditor.#items}. */
  readonly #editors: HTMLElement[] = [];
  /** The box of each part in the last drawing, in pixels of the image. */
  #boxes: CaptureBox[] = [];
  /** The part that the user edits or drags, or -1. */
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

    this.#aspect = this.#menu(
      'Aspect',
      CAPTURE_ASPECTS.map((aspect) => aspect.label),
      stored.aspect,
    );
    this.#shortSide = this.#menu(
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
      this.#addItem(newCaptureText(this.#nextStyle()));
    });
    const title = createButton('director-button', '');
    title.textContent = 'Add piece title';
    title.addEventListener('click', () => {
      const text = newCaptureText('metal', this.#lines.title || 'Your title');
      text.y = 0.2;
      text.size = 0.11;
      this.#addItem(text);
    });
    const flags = createCombobox(
      'Add a flag sticker…',
      [
        {
          label: 'Country flags',
          options: COUNTRY_FLAGS.map(([code, name, keywords]) => ({
            value: code,
            text: name,
            keywords,
          })),
        },
      ],
      (code) => {
        this.#addItem(newCaptureSticker(code));
        loadFlagArt([code])
          .then(() => {
            this.#requestDraw();
          })
          .catch(() => undefined);
      },
    );
    const textsHead = createElement('div', 'capture-texts-head');
    textsHead.append(createElement('h3', '', 'Texts and stickers'), add, title);
    const texts = createElement('div', 'capture-group');
    texts.append(
      textsHead,
      flags.element,
      createElement(
        'p',
        'render-hint',
        'Drag a text or a sticker on the image to move it. Each text has a style.',
      ),
      this.#list,
    );

    const tools = createElement('div', 'capture-tools');
    tools.append(size, look, texts);
    const layout = createElement('div', 'capture-layout');
    layout.append(view, tools);

    this.#type = this.#menu(
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
    context.clearRect(0, 0, this.#preview.width, this.#preview.height);
    this.#boxes = this.#draw(context, this.#still);
    const box = this.#boxes[this.#selected];
    if (box) {
      const unit = Math.min(this.#preview.width, this.#preview.height);
      const pad = unit * 0.012;
      context.save();
      context.lineWidth = Math.max(1, unit / 400);
      context.setLineDash([unit * 0.015, unit * 0.01]);
      context.strokeStyle = '#e7b45a';
      context.translate(box.x, box.y);
      context.rotate(box.angle);
      context.strokeRect(
        -box.width / 2 - pad,
        -box.height / 2 - pad,
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
  #draw(context: CanvasRenderingContext2D, still: HTMLCanvasElement): CaptureBox[] {
    return drawCapture(context, {
      still,
      titleCard: this.#titleCard.checked ? this.#lines : null,
      shade: Number(this.#shade.value),
      items: this.#items,
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
   * Gives the style of the next new text: the first style that no text uses, so each new text
   * looks different.
   *
   * @returns The style.
   */
  #nextStyle(): CaptureText['style'] {
    const used = new Set(this.#items.flatMap((item) => (item.kind === 'text' ? [item.style] : [])));
    const free = CAPTURE_STYLES.find((preset) => !used.has(preset.style));
    return (free ?? CAPTURE_STYLES[used.size % CAPTURE_STYLES.length] ?? stylePreset('classic'))
      .style;
  }

  /**
   * Adds a text or a sticker and its editor, and selects it.
   *
   * @param item The text or the sticker.
   */
  #addItem(item: CaptureItem): void {
    this.#items.push(item);
    const editor = item.kind === 'text' ? this.#textItem(item) : this.#stickerItem(item);
    this.#editors.push(editor);
    this.#list.append(editor);
    this.#selected = -1;
    this.#select(this.#items.length - 1);
    editor.querySelector('textarea')?.select();
    this.#requestDraw();
  }

  /**
   * Removes a text or a sticker and its editor.
   *
   * @param item The text or the sticker.
   */
  #removeItem(item: CaptureItem): void {
    const index = this.#items.indexOf(item);
    if (index < 0) {
      return;
    }
    this.#items.splice(index, 1);
    this.#editors.splice(index, 1)[0]?.remove();
    this.#select(-1);
    this.#requestDraw();
  }

  /**
   * Moves a text or a sticker to the front of the image, and its editor to the end of the list.
   *
   * @param item The text or the sticker.
   */
  #toFront(item: CaptureItem): void {
    const index = this.#items.indexOf(item);
    const editor = this.#editors[index];
    if (index < 0 || !editor) {
      return;
    }
    this.#items.splice(index, 1);
    this.#editors.splice(index, 1);
    this.#items.push(item);
    this.#editors.push(editor);
    this.#list.append(editor);
    this.#selected = -1;
    this.#select(this.#items.length - 1);
  }

  /**
   * Selects a text or a sticker: its editor shows as selected, and the preview frames it.
   *
   * @param index The index of the part, or -1 for none.
   */
  #select(index: number): void {
    if (index === this.#selected) {
      return;
    }
    this.#selected = index;
    for (const [i, editor] of this.#editors.entries()) {
      editor.classList.toggle('is-selected', i === index);
    }
    this.#requestDraw();
  }

  /**
   * Makes the controls that a text and a sticker share: the size, the tilt, the menu "Move to",
   * and the buttons "To front" and "Remove".
   *
   * @param item The text or the sticker. The controls change it in place.
   * @param sizes The smallest and the largest size.
   * @returns The rows of the controls.
   */
  #commonControls(item: CaptureItem, sizes: readonly [number, number]): HTMLElement[] {
    const change = (): void => {
      this.#requestDraw();
    };
    const size = this.#range('Size', sizes[0], sizes[1], 0.005, item.size, (value) => {
      item.size = value;
      change();
    });
    const tilt = this.#range('Tilt', -45, 45, 1, item.turn, (value) => {
      item.turn = value;
      change();
    });

    const place = this.#menu('Move to', ['Move to…', ...PLACES.map(([label]) => label)], 0);
    place.addEventListener('change', () => {
      const target = PLACES[Number(place.value) - 1];
      if (target) {
        [, item.x, item.y] = target;
        change();
      }
      place.value = '0';
    });
    const front = createButton('director-button', 'Bring to the front');
    front.textContent = 'To front';
    front.addEventListener('click', () => {
      this.#toFront(item);
    });
    const remove = createButton('director-button is-danger', 'Remove');
    remove.textContent = 'Remove';
    remove.addEventListener('click', () => {
      this.#removeItem(item);
    });
    const row = createElement('div', 'capture-text-row');
    row.append(place, front, remove);
    return [this.#row('Size', size), this.#row('Tilt', tilt), row];
  }

  /**
   * Makes the editor of a text: the text, the style, the two colors, the font, bold, capitals,
   * the button "Shuffle", and the shared controls.
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
      this.#select(this.#items.indexOf(text));
    });

    const area = createElement('textarea', 'render-text capture-text-input');
    area.rows = 2;
    area.value = text.text;
    area.setAttribute('aria-label', 'Text');
    area.addEventListener('input', () => {
      text.text = area.value;
      change();
    });

    const styleIndex = (): number =>
      Math.max(
        0,
        CAPTURE_STYLES.findIndex((preset) => preset.style === text.style),
      );
    const style = this.#menu(
      'Style',
      CAPTURE_STYLES.map((preset) => preset.label),
      styleIndex(),
    );
    const color = this.#color('Color', text.color, (value) => {
      text.color = value;
      change();
    });
    const accent = this.#color(stylePreset(text.style).accentRole, text.accent, (value) => {
      text.accent = value;
      change();
    });
    const font = this.#menu('Font', ['Sans', 'Serif'], text.font === 'serif' ? 1 : 0);
    font.addEventListener('change', () => {
      const fonts: readonly CaptureFont[] = ['sans', 'serif'];
      text.font = fonts[Number(font.value)] ?? 'sans';
      change();
    });
    const bold = this.#toggle('Bold', text.bold, (on) => {
      text.bold = on;
      change();
    });
    const upper = this.#toggle('Capitals', text.upper, (on) => {
      text.upper = on;
      change();
    });

    const sync = (): void => {
      style.value = String(styleIndex());
      color.input.value = text.color;
      accent.input.value = text.accent;
      accent.name.textContent = stylePreset(text.style).accentRole;
      font.value = text.font === 'serif' ? '1' : '0';
      bold.input.checked = text.bold;
      upper.input.checked = text.upper;
      change();
    };
    style.addEventListener('change', () => {
      applyStyle(text, CAPTURE_STYLES[Number(style.value)]?.style ?? 'classic');
      sync();
    });
    const shuffle = createButton('director-button', 'Try another style');
    shuffle.textContent = 'Shuffle';
    shuffle.addEventListener('click', () => {
      const others = CAPTURE_STYLES.filter((preset) => preset.style !== text.style);
      const next = others[Math.floor(Math.random() * others.length)];
      if (next) {
        applyStyle(text, next.style);
        sync();
      }
    });

    const styleRow = createElement('div', 'capture-text-row');
    styleRow.append(style, shuffle);
    const colorRow = createElement('div', 'capture-text-row');
    colorRow.append(color.label, accent.label, font, bold.label, upper.label);
    item.append(area, styleRow, colorRow, ...this.#commonControls(text, [0.02, 0.3]));
    return item;
  }

  /**
   * Makes the editor of a flag sticker: the name of the flag, the cut, the border, and the shared
   * controls.
   *
   * @param sticker The sticker. The controls change it in place.
   * @returns The editor.
   */
  #stickerItem(sticker: CaptureSticker): HTMLElement {
    const item = createElement('div', 'capture-text-item');
    const change = (): void => {
      this.#requestDraw();
    };
    item.tabIndex = -1;
    item.addEventListener('focusin', () => {
      this.#select(this.#items.indexOf(sticker));
    });
    item.addEventListener('pointerdown', () => {
      this.#select(this.#items.indexOf(sticker));
    });

    const cut = this.#menu(
      'Cut',
      STICKER_CUTS.map(([, label]) => label),
      Math.max(
        0,
        STICKER_CUTS.findIndex(([id]) => id === sticker.cut),
      ),
    );
    cut.addEventListener('change', () => {
      sticker.cut = STICKER_CUTS[Number(cut.value)]?.[0] ?? 'rect';
      change();
    });
    const border = this.#toggle('White border', sticker.border, (on) => {
      sticker.border = on;
      change();
    });
    const row = createElement('div', 'capture-text-row');
    row.append(cut, border.label);
    item.append(
      createElement('strong', 'capture-sticker-name', `Flag sticker: ${flagName(sticker.code)}`),
      row,
      ...this.#commonControls(sticker, [0.05, 0.6]),
    );
    return item;
  }

  /**
   * Makes a slider.
   *
   * @param label The accessible name.
   * @param min The smallest value.
   * @param max The largest value.
   * @param step The step.
   * @param value The first value.
   * @param change Called with the new value after each change.
   * @returns The slider.
   */
  #range(
    label: string,
    min: number,
    max: number,
    step: number,
    value: number,
    change: (value: number) => void,
  ): HTMLInputElement {
    const input = createElement('input');
    input.type = 'range';
    input.min = String(min);
    input.max = String(max);
    input.step = String(step);
    input.value = String(value);
    input.setAttribute('aria-label', label);
    input.addEventListener('input', () => {
      change(Number(input.value));
    });
    return input;
  }

  /**
   * Makes a color field with its name.
   *
   * @param name The name.
   * @param value The first color, as `#rrggbb`.
   * @param change Called with the new color after each change.
   * @returns The label, its name, and the field.
   */
  #color(name: string, value: string, change: (value: string) => void): ColorField {
    const input = createElement('input', 'capture-color');
    input.type = 'color';
    input.value = value;
    input.addEventListener('input', () => {
      change(input.value);
    });
    const text = createElement('span', '', name);
    const label = createElement('label', 'capture-color-field');
    label.append(input, text);
    return { label, name: text, input };
  }

  /**
   * Makes a menu.
   *
   * @param label The accessible name.
   * @param options The names of the options. The value of each option is its index.
   * @param value The index of the chosen option.
   * @returns The menu.
   */
  #menu(label: string, options: readonly string[], value: number): HTMLSelectElement {
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
   * @returns The label with the checkbox, and the checkbox.
   */
  #toggle(text: string, checked: boolean, change: (on: boolean) => void): LabeledInput {
    const box = createElement('input');
    box.type = 'checkbox';
    box.checked = checked;
    box.addEventListener('change', () => {
      change(box.checked);
    });
    const label = createElement('label', 'director-switch');
    label.append(box, document.createTextNode(text));
    return { label, input: box };
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
   * Starts the drag of the part under a press on the preview, and selects it. A press on no part
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
      if (box && boxHolds(box, px, py, pad)) {
        index = i;
      }
    }
    this.#select(index);
    if (index >= 0) {
      event.preventDefault();
      this.#preview.setPointerCapture(event.pointerId);
      this.#drag = { index, x, y };
    }
  }

  /**
   * Moves the dragged part with the pointer. Its middle stays inside the image.
   *
   * @param event The event.
   */
  #movePreview(event: PointerEvent): void {
    const drag = this.#drag;
    const item = drag ? this.#items[drag.index] : undefined;
    if (!drag || !item) {
      return;
    }
    const [x, y] = this.#pointOf(event);
    item.x = Math.min(1, Math.max(0, item.x + x - drag.x));
    item.y = Math.min(1, Math.max(0, item.y + y - drag.y));
    drag.x = x;
    drag.y = y;
    this.#requestDraw();
  }
}
