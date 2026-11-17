/** The size and the frame rate of a render. */
export interface RenderFormat {
  readonly width: number;
  readonly height: number;
  readonly fps: number;
  /**
   * True to keep the 21:9 frame of Cinematic mode, with black bars in a narrower video. False to
   * fill the video: the shots keep their width and show more above and below (design 2.5, render).
   */
  readonly bars: boolean;
}

/** The formats of the render menu. */
export const RENDER_FORMATS: readonly (readonly [string, RenderFormat])[] = [
  ['1080p, 16:9 full frame, 30 fps', { width: 1920, height: 1080, fps: 30, bars: false }],
  ['1080p, 16:9 full frame, 60 fps', { width: 1920, height: 1080, fps: 60, bars: false }],
  ['720p, 16:9 full frame, 30 fps', { width: 1280, height: 720, fps: 30, bars: false }],
  ['1080p, 16:9 with 21:9 bars, 30 fps', { width: 1920, height: 1080, fps: 30, bars: true }],
  ['1080p, 16:9 with 21:9 bars, 60 fps', { width: 1920, height: 1080, fps: 60, bars: true }],
  ['720p, 16:9 with 21:9 bars, 30 fps', { width: 1280, height: 720, fps: 30, bars: true }],
  ['Ultrawide 2560 × 1080, 21:9, 30 fps', { width: 2560, height: 1080, fps: 30, bars: true }],
  // The vertical formats of Reels and Shorts, and of the feed of Instagram (design 2.5, render).
  [
    'Vertical 1080 × 1920, 9:16 (Reels, Shorts), 30 fps',
    { width: 1080, height: 1920, fps: 30, bars: false },
  ],
  [
    'Vertical 1080 × 1920, 9:16 (Reels, Shorts), 60 fps',
    { width: 1080, height: 1920, fps: 60, bars: false },
  ],
  ['Vertical 720 × 1280, 9:16, 30 fps', { width: 720, height: 1280, fps: 30, bars: false }],
  [
    'Vertical 1080 × 1350, 4:5 (Instagram feed), 30 fps',
    { width: 1080, height: 1350, fps: 30, bars: false },
  ],
];

/** The choices of a render beside its format (design 2.5, render). */
export interface RenderOptions {
  /**
   * True to record the bow of the conductor after the last chord (design 5.4): the video ends
   * after the bear faces the orchestra again. False ends it a short time after the last chord.
   */
  readonly bow: boolean;
  /** True to draw the title card of the piece into the start of the video (design 2.8). */
  readonly titles: boolean;
}

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
