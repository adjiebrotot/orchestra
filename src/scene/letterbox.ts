import type { WebGLRenderTarget } from 'three';

import { CINEMA_ASPECT } from '../shots/view.ts';

/**
 * A box on the canvas, in CSS pixels: the image of the camera, or the part of the canvas that
 * shows the scene (design 2.5, 4.5). Its aspect can differ from the aspect of the canvas.
 */
export interface FrameBox {
  /** The middle of the box, from the left edge of the canvas. */
  readonly x: number;
  /** The middle of the box, from the top edge of the canvas. */
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** A part of a render target in texture coordinates, from 0 to 1, with y up. */
export interface UvRect {
  readonly left: number;
  readonly bottom: number;
  readonly right: number;
  readonly top: number;
}

/**
 * Gives the frame of Cinematic mode (design 2.5): the largest box of the aspect
 * {@link CINEMA_ASPECT} inside the canvas, at its middle. A canvas narrower than 21:9 gets bars at
 * the top and the bottom, and a wider canvas gets bars at the sides. A full-frame render gives
 * the aspect of its video, so the frame fills the canvas (design 2.5, render).
 *
 * @param width The width of the canvas, in CSS pixels.
 * @param height The height of the canvas, in CSS pixels.
 * @param aspect The aspect of the frame.
 * @returns The box.
 */
export function letterbox(width: number, height: number, aspect = CINEMA_ASPECT): FrameBox {
  if (width / height > aspect) {
    return { x: width / 2, y: height / 2, width: height * aspect, height };
  }
  return { x: width / 2, y: height / 2, width, height: width / aspect };
}

/**
 * Gives the vertical field of view of a shot in a frame that is narrower than 21:9 (design 2.5,
 * render). The frame keeps the horizontal angle of the shot and shows more above and below it, as
 * the open matte of a film. The growth of the tangent of the half angle stops at `grow`
 * (`MATTE_GROW` of `shots/view.ts`), so a close shot in a vertical video keeps the middle of its
 * width, where its subject stands. A frame of 21:9 or wider keeps the field of view.
 *
 * @param fov The vertical field of view of the shot at the aspect {@link CINEMA_ASPECT}, in
 *   degrees.
 * @param aspect The aspect of the frame.
 * @param grow The largest factor of the tangent of the half angle. Infinity keeps the full width.
 * @returns The vertical field of view, in degrees.
 */
export function openMatteFov(fov: number, aspect: number, grow = Number.POSITIVE_INFINITY): number {
  if (aspect >= CINEMA_ASPECT) {
    return fov;
  }
  const half = (fov / 2) * (Math.PI / 180);
  const factor = Math.min(CINEMA_ASPECT / aspect, Math.max(1, grow));
  return 2 * Math.atan(Math.tan(half) * factor) * (180 / Math.PI);
}

/**
 * Mixes two boxes.
 *
 * @param from The box at the share 0.
 * @param to The box at the share 1.
 * @param share The share, from 0 to 1.
 * @returns The box between them.
 */
export function mixBox(from: FrameBox, to: FrameBox, share: number): FrameBox {
  return {
    x: from.x + (to.x - from.x) * share,
    y: from.y + (to.y - from.y) * share,
    width: from.width + (to.width - from.width) * share,
    height: from.height + (to.height - from.height) * share,
  };
}

/**
 * Gives the part of a target that a box of the canvas covers, in texture coordinates. The target
 * has the aspect of the canvas.
 *
 * @param box The box, in CSS pixels.
 * @param width The width of the canvas, in CSS pixels.
 * @param height The height of the canvas, in CSS pixels.
 * @returns The part, with y up.
 */
export function uvRectOf(box: FrameBox, width: number, height: number): UvRect {
  return {
    left: (box.x - box.width / 2) / width,
    right: (box.x + box.width / 2) / width,
    bottom: 1 - (box.y + box.height / 2) / height,
    top: 1 - (box.y - box.height / 2) / height,
  };
}

/**
 * Limits the passes into a target to a part of the canvas (design 2.5): the scissor covers each
 * pixel that the part touches. With no part, the passes write the full target. The target keeps
 * its size, so a move of the bars allocates nothing.
 *
 * @param target The target, with the aspect of the canvas.
 * @param rect The part, or `null` for the full target.
 */
export function cropTarget(target: WebGLRenderTarget, rect: UvRect | null): void {
  if (!rect) {
    target.scissorTest = false;
    return;
  }
  const { width, height } = target;
  const left = Math.max(0, Math.floor(rect.left * width));
  const bottom = Math.max(0, Math.floor(rect.bottom * height));
  const right = Math.min(width, Math.ceil(rect.right * width));
  const top = Math.min(height, Math.ceil(rect.top * height));
  target.scissor.set(left, bottom, Math.max(1, right - left), Math.max(1, top - bottom));
  target.scissorTest = true;
}
