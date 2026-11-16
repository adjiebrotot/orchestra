/** The size and the frame rate of a render. */
export interface RenderFormat {
  readonly width: number;
  readonly height: number;
  readonly fps: number;
}

/** The formats of the render menu. */
export const RENDER_FORMATS: readonly (readonly [string, RenderFormat])[] = [
  ['1080p, 16:9, 30 fps', { width: 1920, height: 1080, fps: 30 }],
  ['1080p, 16:9, 60 fps', { width: 1920, height: 1080, fps: 60 }],
  ['720p, 16:9, 30 fps', { width: 1280, height: 720, fps: 30 }],
  ['Ultrawide 2560 × 1080, 21:9, 30 fps', { width: 2560, height: 1080, fps: 30 }],
];

/** The audio of the page that a render records. */
export interface RenderAudio {
  readonly context: AudioContext;
  /** The node whose output the render records: the end of the output chain, before the volume. */
  readonly tap: AudioNode;
  /**
   * Gives the song time of the sound that the context renders at a context time.
   *
   * @param contextTime The context time, in seconds.
   * @returns The song time, in seconds.
   */
  readonly songTimeAt: (contextTime: number) => number;
}

/**
 * Tells if the browser can render a video: it needs WebCodecs.
 *
 * @returns True with `VideoEncoder` and `AudioEncoder`.
 */
export function canRenderVideo(): boolean {
  return typeof VideoEncoder !== 'undefined' && typeof AudioEncoder !== 'undefined';
}
