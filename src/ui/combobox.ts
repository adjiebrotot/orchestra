import { createElement } from './dom.ts';

/** An option of a combobox. */
export interface ComboOption {
  /** The value that the combobox gives when the user picks the option. */
  readonly value: string;
  /** The text of the option. */
  readonly text: string;
  /** More words that the search finds, or '' for none. */
  readonly keywords: string;
}

/** A group of options of a combobox, with a heading. */
export interface ComboGroup {
  /** The heading of the group. */
  readonly label: string;
  /** The options. */
  readonly options: readonly ComboOption[];
}

/** A combobox: a text field that filters a list of options as the user types. */
export interface Combobox {
  /** The root element. */
  readonly element: HTMLElement;
  /** The text field. Set `disabled` on it to turn the combobox off. */
  readonly input: HTMLInputElement;
}

/** The number of the next combobox, for the ids of its list and its options. */
let nextId = 0;

/**
 * Makes a text lower case and removes its accents, for the search.
 *
 * @param text A text.
 * @returns The folded text.
 */
function fold(text: string): string {
  return text.normalize('NFD').replaceAll(/\p{M}/gu, '').toLowerCase();
}

/**
 * Creates a combobox with the ARIA combobox pattern: the list opens below the field, the arrow
 * keys move the active option, Enter picks it, and Escape closes the list.
 *
 * @param label The accessible name and the placeholder of the field.
 * @param groups The groups of options, in the order of the list.
 * @param onPick Called with the value of the option that the user picks.
 * @returns The combobox.
 */
export function createCombobox(
  label: string,
  groups: readonly ComboGroup[],
  onPick: (value: string) => void,
): Combobox {
  const id = `combobox-${nextId++}`;
  const element = createElement('div', 'combobox');
  const input = createElement('input', 'combobox-input');
  input.type = 'text';
  input.placeholder = label;
  input.autocomplete = 'off';
  input.spellcheck = false;
  input.setAttribute('role', 'combobox');
  input.setAttribute('aria-label', label);
  input.setAttribute('aria-autocomplete', 'list');
  input.setAttribute('aria-expanded', 'false');
  input.setAttribute('aria-controls', `${id}-list`);
  const list = createElement('div', 'combobox-list');
  list.id = `${id}-list`;
  list.setAttribute('role', 'listbox');
  list.setAttribute('aria-label', label);
  list.hidden = true;
  element.append(input, list);

  let shown: { readonly option: ComboOption; readonly row: HTMLElement }[] = [];
  let active = -1;

  const setActive = (index: number): void => {
    shown[active]?.row.classList.remove('is-active');
    active = index;
    const item = shown[active];
    if (item) {
      item.row.classList.add('is-active');
      item.row.scrollIntoView({ block: 'nearest' });
      input.setAttribute('aria-activedescendant', item.row.id);
    } else {
      input.removeAttribute('aria-activedescendant');
    }
  };

  const close = (): void => {
    list.hidden = true;
    input.setAttribute('aria-expanded', 'false');
    setActive(-1);
  };

  const pick = (option: ComboOption): void => {
    input.value = '';
    close();
    onPick(option.value);
  };

  const open = (): void => {
    const words = fold(input.value).split(/\s+/u).filter(Boolean);
    list.replaceChildren();
    shown = [];
    active = -1;
    for (const group of groups) {
      const matches = group.options.filter((option) => {
        const haystack = fold(`${option.text} ${option.keywords}`);
        return words.every((word) => haystack.includes(word));
      });
      if (matches.length === 0) {
        continue;
      }
      list.append(createElement('div', 'combobox-group', group.label));
      for (const option of matches) {
        const row = createElement('div', 'combobox-option', option.text);
        row.id = `${id}-option-${shown.length}`;
        row.setAttribute('role', 'option');
        row.addEventListener('pointerdown', (event) => {
          // Keeps the focus in the field, so that the blur does not close the list first.
          event.preventDefault();
        });
        row.addEventListener('click', () => {
          pick(option);
        });
        list.append(row);
        shown.push({ option, row });
      }
    }
    if (shown.length === 0) {
      list.append(createElement('div', 'combobox-empty', 'No match'));
    }
    list.hidden = false;
    input.setAttribute('aria-expanded', 'true');
    if (words.length > 0) {
      setActive(0);
    }
  };

  input.addEventListener('focus', open);
  input.addEventListener('click', open);
  input.addEventListener('input', open);
  input.addEventListener('blur', close);
  input.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (list.hidden) {
        open();
      }
      const step = event.key === 'ArrowDown' ? 1 : -1;
      if (shown.length > 0) {
        const count = shown.length;
        setActive(active < 0 ? (step > 0 ? 0 : count - 1) : (active + step + count) % count);
      }
    } else if (event.key === 'Enter') {
      const item = shown[active];
      if (item && !list.hidden) {
        event.preventDefault();
        pick(item.option);
      }
    } else if (event.key === 'Escape' && !list.hidden) {
      event.preventDefault();
      event.stopPropagation();
      input.value = '';
      close();
    }
  });
  return { element, input };
}
