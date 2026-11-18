import type { Group } from 'three';

import { Backdrop } from '../scene/backdrop.ts';
import { isVideoId } from '../scene/backdrop-settings.ts';
import type { BackdropSettings, ScreenCue } from '../scene/backdrop-settings.ts';
import { FLAG_ASPECT, drawFlag, flagName } from '../scene/country-flags.ts';
import type { PropDressing } from '../scene/prop-dressing.ts';
import { StageText } from '../scene/stage-text.ts';
import type { StageStyleId } from '../scene/stage-style.ts';
import type { StageTextUniforms } from '../scene/stage-text.ts';
import type { ScreenImage } from '../ui/director.ts';
import { StagePanel } from '../ui/stage-panel.ts';
import type { PanelImage } from '../ui/stage-panel.ts';
import {
  VIDEO_MAX_BYTES,
  canvasBlob,
  decodeImage,
  decodeVideo,
  deleteImage,
  loadBackdropSettings,
  loadImages,
  saveBackdropSettings,
  saveImage,
} from './backdrop-store.ts';

/** The longest side of the picture of an image in the panel, in pixels. */
const THUMB_SIDE = 96;

/** The longest side of a country flag on a prop, in pixels. */
const PROP_FLAG_SIDE = 640;

/** An image or a video of the user in memory. */
interface Upload {
  readonly name: string;
  /** The image, or one frame of a video. */
  readonly canvas: HTMLCanvasElement;
  /** The URL of the small picture of the panel. */
  readonly thumb: string;
  /** The video, or `null` for an image. */
  readonly video: HTMLVideoElement | null;
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
  readonly #onStyle: (style: StageStyleId) => void;
  readonly #onProps: (dressing: PropDressing) => void;
  #settings: BackdropSettings;
  #stageSide = 0;

  /**
   * Creates the dressing with the stored settings, and starts to read the stored images.
   *
   * @param onScreenImages Gets the images of the screen, or an empty list when the screen does
   *   not show, for the row "Screen" of the camera director.
   * @param stageText The uniforms of the stage text of the stage material (design 4.5, stage
   *   text).
   * @param onStyle Gets the stage style of the settings at the start and after each change, for
   *   the colors of the stage lights (design 4.5, stage style).
   * @param onProps Gets the stand banner and the folder logo at the start and after each change
   *   (design 4.5, stand banner and folder logo).
   */
  constructor(
    onScreenImages: (images: readonly ScreenImage[]) => void,
    stageText: StageTextUniforms,
    onStyle: (style: StageStyleId) => void,
    onProps: (dressing: PropDressing) => void,
  ) {
    this.#onScreenImages = onScreenImages;
    this.#onStyle = onStyle;
    this.#onProps = onProps;
    this.#settings = loadBackdropSettings();
    onStyle(this.#settings.style);
    this.#stageText = new StageText(stageText);
    this.#stageText.set(this.#settings.text);
    this.#backdrop = new Backdrop({
      canvasOf: (id) => this.#uploads.get(id)?.canvas ?? null,
      videoOf: (id) => this.#uploads.get(id)?.video ?? null,
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
      uploads: () => [...this.#uploads.keys()].flatMap((id) => this.#describe(id) ?? []),
    });
    this.panel.setSettings(this.#settings);
    this.#tellProps();
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
    const dressing = ['style', 'standing', 'hanging', 'flags', 'screen'] as const;
    if (settings.style !== old.style) {
      this.#onStyle(settings.style);
    }
    if (dressing.some((key) => settings[key] !== old[key])) {
      this.#backdrop.build(this.#stageSide, settings);
      this.#tellScreen();
    }
    if (settings.stand !== old.stand || settings.folder !== old.folder) {
      this.#tellProps();
    }
  }

  /** Tells the stage the stand banner and the folder logo, with their images. */
  #tellProps(): void {
    const { stand, folder } = this.#settings;
    const standImage = stand.images[0];
    const folderImage = folder.images[0];
    const logo = folder.on && folderImage ? this.#propCanvas(folderImage) : null;
    this.#onProps({
      stand: stand.on
        ? {
            target: stand.target,
            cloth: stand.cloth,
            fringe: stand.fringe,
            image: standImage ? this.#propCanvas(standImage) : null,
          }
        : null,
      folder: logo ? { covers: folder.covers, image: logo } : null,
    });
  }

  /**
   * Gives the canvas of an image for a prop: a country flag, drawn flat, or an image of the user.
   *
   * @param id The image id.
   * @returns The canvas, or `null` for an image that is not there or a video.
   */
  #propCanvas(id: string): HTMLCanvasElement | null {
    const code = /^flag:([a-z]{2})$/u.exec(id)?.[1];
    if (code) {
      return drawFlag(code, PROP_FLAG_SIDE, Math.round(PROP_FLAG_SIDE * FLAG_ASPECT), false);
    }
    const upload = this.#uploads.get(id);
    return upload && !upload.video ? upload.canvas : null;
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
      return { id, name: flagName(code), thumb, video: false };
    }
    const upload = this.#uploads.get(id);
    return upload ? { id, name: upload.name, thumb: upload.thumb, video: !!upload.video } : null;
  }

  /** Reads the stored images and videos, then builds the dressing again with them. */
  async #readImages(): Promise<void> {
    const images = await loadImages();
    const uploads = await Promise.all(
      // A broken image or video stays out of the list.
      images.map((image) => this.#decode(image.id, image.name, image.blob).catch(() => null)),
    );
    for (const [i, image] of images.entries()) {
      const upload = uploads[i];
      if (upload) {
        this.#uploads.set(image.id, upload);
      }
    }
    if (this.#uploads.size > 0) {
      this.#backdrop.rebuild();
      this.#tellScreen();
      this.#tellProps();
      this.panel.refresh();
    }
  }

  /**
   * Opens an image or a video file of the user.
   *
   * @param id The id: a `vid:` id opens a video.
   * @param name The name.
   * @param blob The file.
   * @returns The upload.
   */
  async #decode(id: string, name: string, blob: Blob): Promise<Upload> {
    if (isVideoId(id)) {
      const { video, poster } = await decodeVideo(blob);
      return { name, canvas: poster, thumb: thumbOf(poster), video };
    }
    const canvas = await decodeImage(blob);
    return { name, canvas, thumb: thumbOf(canvas), video: null };
  }

  /**
   * Reads, stores, and adds image and video files of the user. A file that the browser cannot
   * read stays out.
   *
   * @param files The files.
   * @returns The ids of the new images and videos.
   */
  async #upload(files: readonly File[]): Promise<string[]> {
    const kept = files.filter(
      (file) =>
        file.type.startsWith('image/') ||
        (file.type.startsWith('video/') && file.size <= VIDEO_MAX_BYTES),
    );
    const named = kept.map((file) => ({
      file,
      id: `${file.type.startsWith('video/') ? 'vid' : 'img'}:${crypto.randomUUID()}`,
      name: file.name.replace(/\.[^.]+$/u, '') || 'Image',
    }));
    const uploads = await Promise.all(
      named.map(({ file, id, name }) => this.#decode(id, name, file).catch(() => null)),
    );
    const ids: string[] = [];
    const saves: Promise<void>[] = [];
    for (const [i, { file, id, name }] of named.entries()) {
      const upload = uploads[i];
      if (!upload) {
        continue;
      }
      this.#uploads.set(id, upload);
      ids.push(id);
      // The browser can keep no data, for example in a private window: the file then stays for
      // the visit. A video keeps its own file, and an image a PNG file of its canvas.
      const blob = upload.video ? Promise.resolve<Blob>(file) : canvasBlob(upload.canvas);
      saves.push(blob.then((data) => saveImage({ id, name, blob: data })).catch(() => undefined));
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
    const video = this.#uploads.get(id)?.video;
    this.#uploads.delete(id);
    this.#backdrop.forget(id);
    if (video) {
      video.pause();
      URL.revokeObjectURL(video.src);
    }
    const s = this.#settings;
    const without = (images: readonly string[]): readonly string[] =>
      images.filter((image) => image !== id);
    this.#apply({
      ...s,
      standing: { ...s.standing, images: without(s.standing.images) },
      hanging: { ...s.hanging, images: without(s.hanging.images) },
      flags: { ...s.flags, images: without(s.flags.images) },
      screen: { ...s.screen, images: without(s.screen.images) },
      stand: { ...s.stand, images: without(s.stand.images) },
      folder: { ...s.folder, images: without(s.folder.images) },
    });
    this.panel.setSettings(this.#settings);
    await deleteImage(id);
  }
}
