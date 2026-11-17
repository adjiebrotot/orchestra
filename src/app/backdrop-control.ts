import type { Group } from 'three';

import { Backdrop } from '../scene/backdrop.ts';
import type { BackdropSettings, ScreenCue } from '../scene/backdrop-settings.ts';
import { FLAG_ASPECT, drawFlag, flagName } from '../scene/country-flags.ts';
import { StageText } from '../scene/stage-text.ts';
import type { StageTextUniforms } from '../scene/stage-text.ts';
import type { ScreenImage } from '../ui/director.ts';
import { StagePanel } from '../ui/stage-panel.ts';
import type { PanelImage } from '../ui/stage-panel.ts';
import {
  canvasBlob,
  decodeImage,
  deleteImage,
  loadBackdropSettings,
  loadImages,
  saveBackdropSettings,
  saveImage,
} from './backdrop-store.ts';

/** The longest side of the picture of an image in the panel, in pixels. */
const THUMB_SIDE = 96;

/** An image of the user in memory. */
interface Upload {
  readonly name: string;
  readonly canvas: HTMLCanvasElement;
  /** The URL of the small picture of the panel. */
  readonly thumb: string;
}

/**
 * Makes the URL of a small picture of a canvas.
 *
 * @param canvas The canvas.
 * @returns The URL.
 */
function thumbOf(canvas: HTMLCanvasElement): string {
  const scale = Math.min(1, THUMB_SIDE / Math.max(canvas.width, canvas.height));
  const small = document.createElement('canvas');
  small.width = Math.max(1, Math.round(canvas.width * scale));
  small.height = Math.max(1, Math.round(canvas.height * scale));
  small.getContext('2d')?.drawImage(canvas, 0, 0, small.width, small.height);
  return small.toDataURL('image/png');
}

/**
 * The stage dressing of the app (design 4.5, backdrop): the 3D objects behind the stage, the
 * panel "Stage design", and the storage of the settings and the images of the user. The camera
 * director gives the screen cues of each piece.
 */
export class BackdropControl {
  readonly panel: StagePanel;
  readonly #backdrop: Backdrop;
  readonly #stageText: StageText;
  readonly #uploads = new Map<string, Upload>();
  readonly #flagThumbs = new Map<string, string>();
  readonly #onScreenImages: (images: readonly ScreenImage[]) => void;
  #settings: BackdropSettings;
  #stageSide = 0;

  /**
   * Creates the dressing with the stored settings, and starts to read the stored images.
   *
   * @param onScreenImages Gets the images of the screen, or an empty list when the screen does
   *   not show, for the row "Screen" of the camera director.
   * @param stageText The uniforms of the stage text of the stage material (design 4.5, stage
   *   text).
   */
  constructor(
    onScreenImages: (images: readonly ScreenImage[]) => void,
    stageText: StageTextUniforms,
  ) {
    this.#onScreenImages = onScreenImages;
    this.#settings = loadBackdropSettings();
    this.#stageText = new StageText(stageText);
    this.#stageText.set(this.#settings.text);
    this.#backdrop = new Backdrop({
      canvasOf: (id) => this.#uploads.get(id)?.canvas ?? null,
    });
    this.panel = new StagePanel({
      onChange: (settings) => {
        this.#apply(settings);
      },
      onUpload: (files) => this.#upload(files),
      onDelete: (id) => {
        this.#delete(id).catch(reportError);
      },
      describe: (id) => this.#describe(id),
      uploads: () =>
        [...this.#uploads].map(([id, upload]) => ({ id, name: upload.name, thumb: upload.thumb })),
    });
    this.panel.setSettings(this.#settings);
    this.#readImages().catch(reportError);
  }

  /** The group of the 3D objects, for the scene. */
  get group(): Group {
    return this.#backdrop.group;
  }

  /**
   * Builds the dressing for a new stage.
   *
   * @param stageSide The stage side `S`, in meters.
   */
  setStage(stageSide: number): void {
    this.#stageSide = stageSide;
    this.#backdrop.build(stageSide, this.#settings);
    this.#tellScreen();
  }

  /**
   * Sets the screen cues of the current piece.
   *
   * @param cues The cues, sorted by time.
   */
  setScreenCues(cues: readonly ScreenCue[]): void {
    this.#backdrop.setScreenCues(cues);
  }

  /**
   * Moves the dressing to a frame.
   *
   * @param songSec The song time.
   * @param timeSec The time of the moving effects (`effectTime()`).
   */
  frame(songSec: number, timeSec: number): void {
    this.#backdrop.frame(songSec, timeSec);
  }

  /**
   * Applies, saves, and shows new settings.
   *
   * @param settings The settings.
   */
  #apply(settings: BackdropSettings): void {
    const old = this.#settings;
    this.#settings = settings;
    saveBackdropSettings(settings);
    this.#stageText.set(settings.text);
    // A change of the stage text alone builds no object again, so each key of the text is fast.
    const dressing = ['standing', 'hanging', 'flags', 'screen'] as const;
    if (dressing.some((key) => settings[key] !== old[key])) {
      this.#backdrop.build(this.#stageSide, settings);
      this.#tellScreen();
    }
  }

  /** Tells the camera director the images of the screen. */
  #tellScreen(): void {
    const screen = this.#settings.screen;
    this.#onScreenImages(
      screen.on
        ? screen.images.map((id) => ({ id, name: this.#describe(id)?.name ?? 'Missing image' }))
        : [],
    );
  }

  /**
   * Gives the name and the picture of an image.
   *
   * @param id The image id.
   * @returns The image, or `null` for an image that is not there.
   */
  #describe(id: string): PanelImage | null {
    const code = /^flag:([a-z]{2})$/u.exec(id)?.[1];
    if (code) {
      let thumb = this.#flagThumbs.get(code);
      if (!thumb) {
        thumb = thumbOf(drawFlag(code, THUMB_SIDE, THUMB_SIDE * FLAG_ASPECT, false));
        this.#flagThumbs.set(code, thumb);
      }
      return { id, name: flagName(code), thumb };
    }
    const upload = this.#uploads.get(id);
    return upload ? { id, name: upload.name, thumb: upload.thumb } : null;
  }

  /** Reads the stored images, then builds the dressing again with them. */
  async #readImages(): Promise<void> {
    const images = await loadImages();
    const canvases = await Promise.all(
      // A broken image stays out of the list.
      images.map((image) => decodeImage(image.blob).catch(() => null)),
    );
    for (const [i, image] of images.entries()) {
      const canvas = canvases[i];
      if (canvas) {
        this.#uploads.set(image.id, { name: image.name, canvas, thumb: thumbOf(canvas) });
      }
    }
    if (this.#uploads.size > 0) {
      this.#backdrop.rebuild();
      this.#tellScreen();
      this.panel.refresh();
    }
  }

  /**
   * Reads, stores, and adds image files of the user.
   *
   * @param files The files.
   * @returns The ids of the new images.
   */
  async #upload(files: readonly File[]): Promise<string[]> {
    const images = files.filter((file) => file.type.startsWith('image/'));
    const canvases = await Promise.all(images.map((file) => decodeImage(file)));
    const ids: string[] = [];
    const saves: Promise<void>[] = [];
    for (const [i, file] of images.entries()) {
      const canvas = canvases[i];
      if (!canvas) {
        continue;
      }
      const id = `img:${crypto.randomUUID()}`;
      const name = file.name.replace(/\.[^.]+$/u, '') || 'Image';
      this.#uploads.set(id, { name, canvas, thumb: thumbOf(canvas) });
      ids.push(id);
      // The browser can keep no data, for example in a private window: the image then stays for
      // the visit.
      saves.push(
        canvasBlob(canvas)
          .then((blob) => saveImage({ id, name, blob }))
          .catch(() => undefined),
      );
    }
    await Promise.all(saves);
    return ids;
  }

  /**
   * Deletes an image of the user, and removes it from each list.
   *
   * @param id The image id.
   */
  async #delete(id: string): Promise<void> {
    this.#uploads.delete(id);
    this.#backdrop.forget(id);
    const s = this.#settings;
    const without = (images: readonly string[]): readonly string[] =>
      images.filter((image) => image !== id);
    this.#apply({
      standing: { ...s.standing, images: without(s.standing.images) },
      hanging: { ...s.hanging, images: without(s.hanging.images) },
      flags: { ...s.flags, images: without(s.flags.images) },
      screen: { ...s.screen, images: without(s.screen.images) },
      text: s.text,
    });
    this.panel.setSettings(this.#settings);
    await deleteImage(id);
  }
}
