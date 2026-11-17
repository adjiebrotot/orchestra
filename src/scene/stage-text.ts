import { CanvasTexture, LinearMipmapLinearFilter, NoColorSpace, Vector3 } from 'three';
import type { Texture } from 'three';

import type { StageTextSettings, StageTextTone } from './backdrop-settings.ts';
import { noBakeTexture } from './stage-bake.ts';

/**
 * The stage text (design 4.5, stage text): one line of text in the wood of the stage, near the
 * conductor, as the logo of the stage top. The stage shader reads the coverage of the letters from
 * a canvas texture, and changes the tone of the wood under them, so that the grain and the planks
 * show through.
 */
export const STAGE_TEXT = {
  /** The height of the canvas of the letters, in pixels. */
  canvasHeight: 160,
  /** The size of the font, as a part of the canvas height. */
  fontShare: 0.74,
  /** The space at each end of the line, as a part of the canvas height. */
  padShare: 0.3,
  /** The space between two letters, as a part of the font size. */
  letterSpacing: 0.08,
  /** The widest canvas, in pixels. */
  maxWidth: 4096,
  /**
   * The factor of the height of the letters on the floor for each size (design 4.5, stage text).
   * The floor in front of the podium is about 0.26 m deep on each stage, so on the large stage of
   * a large orchestra, the camera stands far away and the letters of `fit` read small. A larger
   * line keeps its front edge at the lip and grows to the back, past the sides of the podium. The
   * podium covers the middle of a tall line. The front of the stage is as tall as the skirt, so
   * its letters keep the size `fit`.
   */
  sizes: { fit: 1, large: 1.6, larger: 2.4, largest: 3.2 },
  fonts: {
    serif: "600 {px}px 'Palatino Linotype', Palatino, 'Book Antiqua', Georgia, 'Noto Serif', serif",
    sans: "600 {px}px system-ui, -apple-system, 'Segoe UI', Roboto, Arial, sans-serif",
  } satisfies Readonly<Record<StageTextSettings['font'], string>>,
  /**
   * The factor of the wood color under the letters, for each tone, on the planks of the floor.
   * The pale inlay is the wood of the letter of the logo, and the dark stain is the disc of the
   * logo, a little darker.
   */
  floorTint: {
    light: [1.42, 1.36, 1.26],
    dark: [0.5, 0.47, 0.45],
    gold: [1.75, 1.38, 0.62],
  } satisfies Readonly<Record<StageTextTone, readonly [number, number, number]>>,
  /**
   * The factor of the wood color under the letters on the front of the stage. The skirt is a dark
   * wood, about half the plank color, so a letter needs a larger factor to read as the same pale
   * wood.
   */
  frontTint: {
    light: [3.0, 2.8, 2.4],
    dark: [0.45, 0.42, 0.4],
    gold: [3.2, 2.4, 0.95],
  } satisfies Readonly<Record<StageTextTone, readonly [number, number, number]>>,
} as const;

/** The uniforms of the stage text, which the stage material shares with {@link StageText}. */
export interface StageTextUniforms {
  /** The coverage of the letters in the red channel, or one white texel with no text. */
  readonly uStageText: { value: Texture };
  /**
   * x: the width of the text over its height. y: the place: 0 for no text, 1 on the floor in front
   * of the podium, 2 on the front of the stage. z: the factor of the height on the floor
   * (`STAGE_TEXT.sizes`).
   */
  readonly uStageTextMode: { value: Vector3 };
  /** The factor of the wood color under the letters. */
  readonly uStageTextTint: { value: Vector3 };
}

/**
 * Creates the uniforms of a stage with no text.
 *
 * @returns New uniforms.
 */
export function noStageTextUniforms(): StageTextUniforms {
  return {
    uStageText: { value: noBakeTexture() },
    uStageTextMode: { value: new Vector3(1, 0, 1) },
    uStageTextTint: { value: new Vector3(1, 1, 1) },
  };
}

/**
 * Draws one line of text on a canvas: white letters on black, with space at each end.
 *
 * @param text The text.
 * @param font The typeface.
 * @returns The canvas, or `null` with no 2D context.
 */
function drawStageText(text: string, font: StageTextSettings['font']): HTMLCanvasElement | null {
  const k = STAGE_TEXT;
  const height = k.canvasHeight;
  const px = Math.round(height * k.fontShare);
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  if (!context) {
    return null;
  }
  const style = k.fonts[font].replace('{px}', String(px));
  context.font = style;
  context.letterSpacing = `${(k.letterSpacing * px).toFixed(1)}px`;
  const pad = height * k.padShare;
  const measured = context.measureText(text).width;
  canvas.width = Math.min(k.maxWidth, Math.max(height, Math.ceil(measured + 2 * pad)));
  canvas.height = height;
  // A new size clears the context, with its font.
  context.font = style;
  context.letterSpacing = `${(k.letterSpacing * px).toFixed(1)}px`;
  context.fillStyle = '#000';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = '#fff';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  const scale = Math.min(1, (canvas.width - 2 * pad) / Math.max(1, measured));
  context.translate(canvas.width / 2, height / 2);
  context.scale(scale, 1);
  context.fillText(text, 0, 0);
  return canvas;
}

/**
 * The stage text of the app (design 4.5, stage text): it draws the letters of the settings into
 * the texture that the stage material reads.
 */
export class StageText {
  readonly #uniforms: StageTextUniforms;
  #texture: CanvasTexture | null = null;
  #key = '';

  /**
   * Creates the stage text.
   *
   * @param uniforms The uniforms of the stage material.
   */
  constructor(uniforms: StageTextUniforms) {
    this.#uniforms = uniforms;
  }

  /**
   * Shows the text of new settings. A setting that does not change the letters does not draw them
   * again.
   *
   * @param settings The settings.
   */
  set(settings: StageTextSettings): void {
    const text = settings.text.trim();
    const uniforms = this.#uniforms;
    if (!settings.on || text === '') {
      uniforms.uStageTextMode.value.y = 0;
      return;
    }
    const key = `${settings.font}\n${text}`;
    if (key !== this.#key || !this.#texture) {
      const canvas = drawStageText(text, settings.font);
      if (!canvas) {
        uniforms.uStageTextMode.value.y = 0;
        return;
      }
      this.#texture?.dispose();
      const texture = new CanvasTexture(canvas);
      texture.colorSpace = NoColorSpace;
      texture.minFilter = LinearMipmapLinearFilter;
      texture.anisotropy = 8;
      this.#texture = texture;
      this.#key = key;
      uniforms.uStageText.value = texture;
      uniforms.uStageTextMode.value.x = canvas.width / canvas.height;
    }
    uniforms.uStageTextMode.value.y = settings.place === 'floor' ? 1 : 2;
    uniforms.uStageTextMode.value.z = STAGE_TEXT.sizes[settings.size];
    const tint = (settings.place === 'floor' ? STAGE_TEXT.floorTint : STAGE_TEXT.frontTint)[
      settings.tone
    ];
    uniforms.uStageTextTint.value.set(tint[0], tint[1], tint[2]);
  }
}
