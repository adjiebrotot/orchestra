import {
  ARRANGEMENTS,
  BACKDROP_LIMITS,
  BANNER_ASPECTS,
  BANNER_CUTS,
  DEFAULT_BACKDROP,
  SCREEN_MATERIALS,
  STAGE_TEXT_FONTS,
  STAGE_TEXT_SIZES,
  STAGE_TEXT_PLACES,
  STAGE_TEXT_TONES,
  cleanStageText,
} from '../scene/backdrop-settings.ts';
import type {
  BackdropSettings,
  BannerSettings,
  StageTextSettings,
} from '../scene/backdrop-settings.ts';
import { COUNTRY_FLAGS } from '../scene/country-flags.ts';
import { STAGE_STYLE_OPTIONS } from '../scene/stage-style.ts';
import { createButton, createElement } from './dom.ts';

/** An image that the panel can show: its id, its name, and a small picture. */
export interface PanelImage {
  readonly id: string;
  readonly name: string;
  /** The URL of a small picture of the image. */
  readonly thumb: string;
}

/** The actions of the stage panel. */
export interface StagePanelActions {
  /** A change of the settings. */
  readonly onChange: (settings: BackdropSettings) => void;
  /** New image files of the user. The promise gives their ids. */
  readonly onUpload: (files: readonly File[]) => Promise<string[]>;
  /** A click on "Delete" of an image of the user. */
  readonly onDelete: (id: string) => void;
  /** Gives the name and the picture of an image, or `null` for an image that is not there. */
  readonly describe: (id: string) => PanelImage | null;
  /** Gives the images of the user. */
  readonly uploads: () => readonly PanelImage[];
}

/** The keys of the two rows of banners. */
type BannerKey = 'standing' | 'hanging';

/** The keys of the lists of images. */
type ListKey = BannerKey | 'flags' | 'screen';

/** The most images of each list. */
const LIST_LIMITS: Readonly<Record<ListKey, number>> = {
  standing: BACKDROP_LIMITS.images,
  hanging: BACKDROP_LIMITS.images,
  flags: BACKDROP_LIMITS.flags,
  screen: BACKDROP_LIMITS.images,
};

/**
 * The panel "Stage design" (design 2.8, 4.5): the switches, the counts, the forms, and the
 * images of the standing banners, the hanging banners, the flags, and the screen behind the
 * stage. Each change applies at once and stays in the browser.
 */
export class StagePanel {
  readonly element: HTMLElement;
  readonly #actions: StagePanelActions;
  readonly #body: HTMLElement;
  #settings: BackdropSettings = DEFAULT_BACKDROP;

  /**
   * Creates the panel. It starts hidden.
   *
   * @param actions The actions.
   */
  constructor(actions: StagePanelActions) {
    this.#actions = actions;
    this.element = createElement('section', 'stage-panel');
    this.element.hidden = true;
    this.element.setAttribute('aria-label', 'Stage design');
    const head = createElement('div', 'render-head');
    const close = createButton('director-close', 'Close the stage design');
    close.textContent = '×';
    close.addEventListener('click', () => {
      this.setOpen(false);
    });
    head.append(createElement('h3', '', 'Stage design'), close);
    const hint = createElement(
      'p',
      'render-hint',
      'Dress the back of the stage. Your images stay in this browser. The rows stay symmetrical.',
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
  setSettings(settings: BackdropSettings): void {
    this.#settings = settings;
    if (this.open) {
      this.#render();
    }
  }

  /**
   * Changes the settings, shows them, and tells the app.
   *
   * @param settings The new settings.
   */
  #change(settings: BackdropSettings): void {
    this.#settings = settings;
    this.#render();
    this.#actions.onChange(settings);
  }

  /** Writes the controls again. */
  #render(): void {
    const s = this.#settings;
    const scroll = this.#body.scrollTop;
    this.#body.replaceChildren(
      this.#styleSection(),
      this.#textSection(),
      this.#bannerSection(
        'standing',
        'Standing banners',
        'Banners on poles behind the stage. With the screen on, an even number keeps it clear.',
      ),
      this.#bannerSection(
        'hanging',
        'Hanging banners',
        'Banners that hang from a batten high up. With the screen on, an even number keeps it clear.',
      ),
      this.#section(
        'Flags',
        'Flagpole groups beside the back corners. Each group carries all the flags. A higher limpness lets each flag fall from its staff in deeper folds.',
        s.flags.on,
        (on) => {
          this.#change({ ...this.#settings, flags: { ...s.flags, on } });
        },
        [
          this.#row(
            'Flagpole groups',
            this.#number(s.flags.groups, 1, BACKDROP_LIMITS.groups, (groups) => {
              this.#change({ ...this.#settings, flags: { ...s.flags, groups } });
            }),
          ),
          this.#row(
            'Arrangement',
            this.#select(ARRANGEMENTS, s.flags.arrangement, (arrangement) => {
              this.#change({ ...this.#settings, flags: { ...s.flags, arrangement } });
            }),
          ),
          this.#row(
            'Limpness',
            this.#slider('Limpness of the flags', s.flags.limpness, (limpness) => {
              this.#settings = {
                ...this.#settings,
                flags: { ...this.#settings.flags, limpness },
              };
              this.#actions.onChange(this.#settings);
            }),
          ),
          this.#row('Flags', this.#images('flags')),
        ],
      ),
      this.#section(
        'Screen',
        'A screen above the back row. Change its image over time in the Camera director: click its Screen row.',
        s.screen.on,
        (on) => {
          this.#change({ ...this.#settings, screen: { ...s.screen, on } });
        },
        [
          this.#row(
            'Material',
            this.#select(SCREEN_MATERIALS, s.screen.material, (material) => {
              this.#change({ ...this.#settings, screen: { ...s.screen, material } });
            }),
          ),
          this.#row('Images', this.#images('screen')),
        ],
      ),
      this.#uploadsSection(),
    );
    this.#body.scrollTop = scroll;
  }

  /**
   * Creates the section of the stage style: a menu that sets the look of the poles, the rods,
   * the cloth, and the screen, and the colors of the stage lights (design 4.5, stage style).
   *
   * @returns The section.
   */
  #styleSection(): HTMLElement {
    const section = createElement('div', 'stage-section');
    section.append(
      createElement('div', 'stage-section-head', 'Stage style'),
      createElement(
        'p',
        'render-hint',
        'Sets the look of the banners, the flags, and the screen, and the color of the stage lights.',
      ),
      this.#row(
        'Style',
        this.#select(STAGE_STYLE_OPTIONS, this.#settings.style, (style) => {
          this.#change({ ...this.#settings, style });
        }),
      ),
    );
    return section;
  }

  /**
   * Creates the section of the stage text: one line in the wood of the stage, near the conductor.
   *
   * @returns The section.
   */
  #textSection(): HTMLElement {
    const s = this.#settings;
    const set = s.text;
    const update = (change: Partial<StageTextSettings>): void => {
      this.#change({ ...this.#settings, text: { ...this.#settings.text, ...change } });
    };
    const input = createElement('input', 'stage-text-input');
    input.type = 'text';
    input.maxLength = BACKDROP_LIMITS.text;
    input.placeholder = 'For example: Orchestra of the Woods';
    input.value = set.text;
    input.setAttribute('aria-label', 'Stage text');
    // Each key shows at once. The panel does not write its controls again, so the field keeps the
    // focus and the caret.
    input.addEventListener('input', () => {
      const text = cleanStageText(input.value);
      this.#settings = { ...this.#settings, text: { ...this.#settings.text, text } };
      this.#actions.onChange(this.#settings);
    });
    return this.#section(
      'Stage text',
      'A line of text in the wood of the stage, near the conductor, as the logo of the stage floor. On a large stage, a larger size on the floor reads better from far away.',
      set.on,
      (on) => {
        update({ on });
      },
      [
        this.#row('Text', input),
        this.#row(
          'Place',
          this.#select(STAGE_TEXT_PLACES, set.place, (place) => {
            update({ place });
          }),
        ),
        this.#row(
          'Wood',
          this.#select(STAGE_TEXT_TONES, set.tone, (tone) => {
            update({ tone });
          }),
        ),
        this.#row(
          'Letters',
          this.#select(STAGE_TEXT_FONTS, set.font, (font) => {
            update({ font });
          }),
        ),
        this.#row(
          'Size',
          this.#select(STAGE_TEXT_SIZES, set.size, (size) => {
            update({ size });
          }),
        ),
      ],
    );
  }

  /**
   * Creates the section of a row of banners.
   *
   * @param key The row.
   * @param title The title.
   * @param text The line below the title.
   * @returns The section.
   */
  #bannerSection(key: BannerKey, title: string, text: string): HTMLElement {
    const s = this.#settings;
    const set = s[key];
    const update = (change: Partial<BannerSettings>): void => {
      this.#change({ ...this.#settings, [key]: { ...set, ...change } });
    };
    return this.#section(
      title,
      text,
      set.on,
      (on) => {
        update({ on });
      },
      [
        this.#row(
          'Number',
          this.#number(set.count, 1, BACKDROP_LIMITS[key], (count) => {
            update({ count });
          }),
        ),
        this.#row(
          'Shape',
          this.#select(BANNER_CUTS, set.cut, (cut) => {
            update({ cut });
          }),
        ),
        this.#row(
          'Aspect ratio',
          this.#select(BANNER_ASPECTS, set.aspect, (aspect) => {
            update({ aspect });
          }),
        ),
        this.#row(
          'Arrangement',
          this.#select(ARRANGEMENTS, set.arrangement, (arrangement) => {
            update({ arrangement });
          }),
        ),
        this.#row('Images', this.#images(key)),
      ],
    );
  }

  /**
   * Creates a section with a switch.
   *
   * @param title The title.
   * @param text The line below the title.
   * @param on True if the object shows.
   * @param onToggle The action of the switch.
   * @param rows The rows of the controls.
   * @returns The section.
   */
  #section(
    title: string,
    text: string,
    on: boolean,
    onToggle: (on: boolean) => void,
    rows: readonly HTMLElement[],
  ): HTMLElement {
    const section = createElement('div', 'stage-section');
    const head = createElement('label', 'stage-section-head');
    const toggle = createElement('input');
    toggle.type = 'checkbox';
    toggle.checked = on;
    toggle.addEventListener('change', () => {
      onToggle(toggle.checked);
    });
    head.append(toggle, createElement('span', '', title));
    const line = createElement('p', 'render-hint', text);
    const body = createElement('div', 'stage-rows');
    body.append(...rows);
    body.hidden = !on;
    section.append(head, line, body);
    return section;
  }

  /**
   * Creates a row: a label and a control.
   *
   * @param label The label.
   * @param control The control.
   * @returns The row.
   */
  #row(label: string, control: HTMLElement): HTMLElement {
    const row = createElement('div', 'stage-row');
    row.append(createElement('span', 'stage-label', label), control);
    return row;
  }

  /**
   * Creates a number field.
   *
   * @param value The value.
   * @param min The smallest value.
   * @param max The largest value.
   * @param onSet The action of a new value.
   * @returns The field.
   */
  #number(value: number, min: number, max: number, onSet: (value: number) => void): HTMLElement {
    const box = createElement('div', 'stage-stepper');
    const input = createElement('input');
    input.type = 'number';
    input.min = String(min);
    input.max = String(max);
    input.step = '1';
    input.value = String(value);
    const set = (next: number): void => {
      const clamped = Math.min(max, Math.max(min, Math.round(next)));
      if (Number.isFinite(clamped) && clamped !== value) {
        onSet(clamped);
      } else {
        input.value = String(value);
      }
    };
    input.addEventListener('change', () => {
      set(Number(input.value));
    });
    const less = this.#textButton('−', () => {
      set(value - 1);
    });
    less.setAttribute('aria-label', 'Fewer');
    const more = this.#textButton('+', () => {
      set(value + 1);
    });
    more.setAttribute('aria-label', 'More');
    box.append(less, input, more);
    return box;
  }

  /**
   * Creates a slider of a share from 0 to 1, with its value in percent. Each move applies at
   * once. The panel does not write its controls again, so the drag goes on.
   *
   * @param label The name of the slider, for a screen reader.
   * @param value The share.
   * @param onSet The action of a new share.
   * @returns The slider and its value.
   */
  #slider(label: string, value: number, onSet: (value: number) => void): HTMLElement {
    const box = createElement('div', 'stage-slider');
    const input = createElement('input');
    input.type = 'range';
    input.min = '0';
    input.max = '100';
    input.step = '1';
    input.value = String(Math.round(value * 100));
    input.setAttribute('aria-label', label);
    const text = createElement('span', 'stage-slider-value', `${input.value} %`);
    input.addEventListener('input', () => {
      text.textContent = `${input.value} %`;
      onSet(Number(input.value) / 100);
    });
    box.append(input, text);
    return box;
  }

  /**
   * Creates a menu.
   *
   * @param options The values and their labels.
   * @param value The value.
   * @param onSet The action of a new value.
   * @returns The menu.
   */
  #select<T extends string | number>(
    options: readonly (readonly [T, string])[],
    value: T,
    onSet: (value: T) => void,
  ): HTMLElement {
    const select = createElement('select');
    for (const [i, [option, label]] of options.entries()) {
      const element = createElement('option', '', label);
      element.value = String(i);
      element.selected = option === value;
      select.append(element);
    }
    select.addEventListener('change', () => {
      const option = options[Number(select.value)];
      if (option) {
        onSet(option[0]);
      }
    });
    return select;
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

  /**
   * Gives the images of a list.
   *
   * @param key The list.
   * @returns The ids.
   */
  #list(key: ListKey): readonly string[] {
    return this.#settings[key].images;
  }

  /**
   * Sets the images of a list.
   *
   * @param key The list.
   * @param images The ids.
   */
  #setList(key: ListKey, images: readonly string[]): void {
    const s = this.#settings;
    this.#change({
      ...this.#settings,
      [key]: { ...s[key], images: images.slice(0, LIST_LIMITS[key]) },
    });
  }

  /**
   * Creates the editor of a list of images: a chip for each image, with a move and a remove, then
   * a menu that adds a country flag or an image of the user, and an upload button.
   *
   * @param key The list.
   * @returns The editor.
   */
  #images(key: ListKey): HTMLElement {
    const box = createElement('div', 'stage-images');
    const list = this.#list(key);
    const chips = createElement('div', 'stage-chips');
    for (const [i, id] of list.entries()) {
      const image = this.#actions.describe(id);
      const chip = createElement('div', 'stage-chip');
      const picture = createElement('img');
      picture.alt = '';
      if (image) {
        picture.src = image.thumb;
      }
      const name = createElement('span', 'stage-chip-name', image?.name ?? 'Missing image');
      chip.title = image?.name ?? 'Missing image';
      chip.append(picture, name);
      if (i > 0) {
        const left = createButton('stage-chip-button', 'Move earlier');
        left.textContent = '‹';
        left.addEventListener('click', () => {
          const next = [...list];
          [next[i - 1], next[i]] = [id, list[i - 1] ?? id];
          this.#setList(key, next);
        });
        chip.append(left);
      }
      const remove = createButton('stage-chip-button', `Remove ${image?.name ?? 'the image'}`);
      remove.textContent = '×';
      remove.addEventListener('click', () => {
        this.#setList(
          key,
          list.filter((_, j) => j !== i),
        );
      });
      chip.append(remove);
      chips.append(chip);
    }
    if (list.length === 0) {
      chips.append(createElement('span', 'render-hint', 'No image: add one below.'));
    }

    const tools = createElement('div', 'stage-image-tools');
    const add = createElement('select');
    add.setAttribute('aria-label', 'Add an image');
    const first = createElement('option', '', 'Add a country flag or an image…');
    first.value = '';
    add.append(first);
    const flags = createElement('optgroup');
    flags.label = 'Country flags';
    for (const [code, name] of COUNTRY_FLAGS) {
      const option = createElement('option', '', name);
      option.value = `flag:${code}`;
      flags.append(option);
    }
    add.append(flags);
    const uploads = this.#actions.uploads();
    if (uploads.length > 0) {
      const own = createElement('optgroup');
      own.label = 'Your images';
      for (const image of uploads) {
        const option = createElement('option', '', image.name);
        option.value = image.id;
        own.append(option);
      }
      add.append(own);
    }
    add.addEventListener('change', () => {
      if (add.value) {
        this.#setList(key, [...list, add.value]);
      }
    });
    const file = createElement('input');
    file.type = 'file';
    file.accept = 'image/*';
    file.multiple = true;
    file.hidden = true;
    file.addEventListener('change', () => {
      const files = [...(file.files ?? [])];
      file.value = '';
      if (files.length === 0) {
        return;
      }
      this.#actions
        .onUpload(files)
        .then((ids) => {
          this.#setList(key, [...this.#list(key), ...ids]);
        })
        .catch(reportError);
    });
    const upload = this.#textButton('Upload image…', () => {
      file.click();
    });
    upload.classList.add('is-accent');
    const full = list.length >= LIST_LIMITS[key];
    add.disabled = full;
    upload.disabled = full;
    tools.append(add, upload, file);
    box.append(chips, tools);
    return box;
  }

  /**
   * Creates the section of the images of the user, with a delete for each, and the reset.
   *
   * @returns The section.
   */
  #uploadsSection(): HTMLElement {
    const section = createElement('div', 'stage-section');
    section.append(createElement('div', 'stage-section-head', 'Your images'));
    const uploads = this.#actions.uploads();
    const chips = createElement('div', 'stage-chips');
    for (const image of uploads) {
      const chip = createElement('div', 'stage-chip');
      const picture = createElement('img');
      picture.alt = '';
      picture.src = image.thumb;
      chip.title = image.name;
      const remove = createButton('stage-chip-button', `Delete ${image.name}`);
      remove.textContent = '×';
      remove.addEventListener('click', () => {
        if (window.confirm(`Delete ${image.name} from this browser?`)) {
          this.#actions.onDelete(image.id);
        }
      });
      chip.append(picture, createElement('span', 'stage-chip-name', image.name), remove);
      chips.append(chip);
    }
    if (uploads.length === 0) {
      chips.append(createElement('span', 'render-hint', 'No uploads yet.'));
    }
    const reset = this.#textButton('Reset to defaults', () => {
      if (window.confirm('Reset the stage design to the default flags?')) {
        this.#change(DEFAULT_BACKDROP);
      }
    });
    reset.classList.add('is-danger');
    section.append(chips, reset);
    return section;
  }

  /** Writes the controls again, for example after a new or a deleted image. */
  refresh(): void {
    if (this.open) {
      this.#render();
    }
  }
}
