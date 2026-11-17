import { APP_NAME } from '../app/page-title.ts';
import { createElement, setText } from './dom.ts';

/**
 * Creates the logo line. It shows nothing: the name of the app stays as the heading of the page
 * (`h1`) for a screen reader.
 *
 * @returns The logo element.
 */
function createLogo(): HTMLElement {
  const logo = createElement('div', 'logo');
  const name = createElement('h1', 'name sr-only', APP_NAME);
  logo.append(name);
  return logo;
}

/**
 * The title at the top left (2.8): the logo, then the piece title (`h2`)
 * in a serif (24 px to 36 px) and the composer. It is a polite live region, so that a screen reader
 * reads the current piece when it changes. The logo does not change, so the region does not read
 * it again.
 */
export class Title {
  /** The `header` element of the title. */
  readonly element: HTMLElement;
  /** The logo above the piece title. */
  readonly #logo: HTMLElement;
  /** The piece title. */
  readonly #title: HTMLElement;
  /** The composer line. */
  readonly #composer: HTMLElement;

  /**
   * Creates the title. It keeps the static title of `index.html` and its text (design 2.8, 7.2):
   * the browser paints the title lines of the default demo with the first paint, and does not
   * paint them again. The logo of the app replaces the static logo.
   *
   * @param page The static title of `index.html`, or `null` for a new title with no text.
   */
  constructor(page: HTMLElement | null) {
    this.element = page ?? createElement('header', 'title');
    this.element.setAttribute('aria-live', 'polite');
    this.#logo = createLogo();
    const pageLogo = this.element.querySelector(':scope > .logo');
    if (pageLogo) {
      pageLogo.replaceWith(this.#logo);
    } else {
      this.element.prepend(this.#logo);
    }
    this.#title = this.element.querySelector(':scope > h2') ?? createElement('h2');
    this.#composer = this.element.querySelector(':scope > p') ?? createElement('p');
    if (!this.#title.isConnected || !this.#composer.isConnected) {
      this.element.append(this.#title, this.#composer);
    }
  }

  /**
   * Shows the title of a piece.
   *
   * @param title The piece title.
   * @param composer The composer, or '' for none.
   */
  show(title: string, composer: string): void {
    setText(this.#title, title);
    setText(this.#composer, composer);
    this.#composer.hidden = composer === '';
  }
}
