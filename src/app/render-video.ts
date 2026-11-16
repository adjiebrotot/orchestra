import { ArrayBufferTarget, Muxer } from 'mp4-muxer';

import type { RenderAudio, RenderFormat } from './render-formats.ts';

/** The name of the processor of the audio tap. */
const TAP_NAME = 'orchestra-render-tap';

/** The frames of audio in one message of the tap. */
const TAP_FRAMES = 4096;

/** The code of the processor of the audio tap: it posts the stereo samples of its input. */
const TAP_CODE = `
class RenderTap extends AudioWorkletProcessor {
  constructor() {
    super();
    this.on = true;
    this.l = new Float32Array(${TAP_FRAMES});
    this.r = new Float32Array(${TAP_FRAMES});
    this.n = 0;
    this.t = 0;
    this.port.onmessage = () => { this.on = false; };
  }
  process(inputs) {
    if (!this.on) return false;
    const input = inputs[0] || [];
    const frames = input[0] ? input[0].length : 128;
    if (this.n === 0) this.t = currentTime;
    for (let i = 0; i < frames; i++) {
      this.l[this.n + i] = input[0] ? input[0][i] : 0;
      this.r[this.n + i] = input[1] ? input[1][i] : (input[0] ? input[0][i] : 0);
    }
    this.n += frames;
    if (this.n + 128 > ${TAP_FRAMES}) {
      this.port.postMessage({ t: this.t, l: this.l.slice(0, this.n), r: this.r.slice(0, this.n) });
      this.n = 0;
    }
    return true;
  }
}
registerProcessor('${TAP_NAME}', RenderTap);
`;

/** The contexts that have the processor of the tap. */
const tapContexts = new WeakSet<BaseAudioContext>();

/**
 * Finds the first codec of a list that the browser can encode.
 *
 * @param list The codec strings, and what to tell the muxer for each one.
 * @param test Tells if the browser encodes a codec string.
 * @returns The first codec that the browser encodes, or `null`.
 */
async function firstSupported<T>(
  list: readonly (readonly [string, T])[],
  test: (codec: string) => Promise<boolean>,
): Promise<readonly [string, T] | null> {
  for (const item of list) {
    if (await test(item[0]).catch(() => false)) {
      return item;
    }
  }
  return null;
}

/**
 * Records the canvas of the stage and the audio output into an MP4 file while the piece plays. The
 * app calls {@link VideoRender.frame} after each frame that it renders. The video takes its time
 * from the song time of each frame, and the audio from the song time of its samples, so the two
 * stay in sync at each speed of the device.
 */
export class VideoRender {
  readonly #canvas: HTMLCanvasElement;
  readonly #audio: RenderAudio;
  readonly #format: RenderFormat;
  readonly #endSec: number;
  #muxer: Muxer<ArrayBufferTarget> | null = null;
  #video: VideoEncoder | null = null;
  #encoderAudio: AudioEncoder | null = null;
  #tap: AudioWorkletNode | null = null;
  #sink: GainNode | null = null;
  #error: Error | null = null;
  /** The song time of the next frame to keep, in seconds. */
  #nextFrameSec = 0;
  #frames = 0;
  /** The song time of the last frame that the video holds, in seconds. */
  #lastFrameSec = -1;
  /** The audio frames that the file holds, from the song time 0. */
  #audioFrames = 0;
  #audioStarted = false;
  #sampleRate = 48000;
  /** The song time of the end of the audio, in seconds. */
  #audioEndSec = 0;
  /** A short summary of the codecs, for the status line. */
  codecs = '';

  /**
   * Creates the render. {@link VideoRender.start} starts it.
   *
   * @param canvas The canvas of the stage, at the size of the format.
   * @param audio The audio of the page.
   * @param format The size and the frame rate.
   * @param endSec The song time at which the render ends: the song length and a tail.
   */
  constructor(canvas: HTMLCanvasElement, audio: RenderAudio, format: RenderFormat, endSec: number) {
    this.#canvas = canvas;
    this.#audio = audio;
    this.#format = format;
    this.#endSec = endSec;
  }

  /** The error of an encoder, or `null`. */
  get error(): Error | null {
    return this.#error;
  }

  /** The part of the render that is done, from 0 to 1. */
  get progress(): number {
    return Math.min(1, Math.min(this.#lastFrameSec, this.#audioEndSec) / this.#endSec);
  }

  /** True when the video and the audio reach the end time. */
  get done(): boolean {
    return (
      this.#lastFrameSec >= this.#endSec - 1 / this.#format.fps && this.#audioEndSec >= this.#endSec
    );
  }

  /**
   * Sets up the encoders, the muxer, and the audio tap.
   *
   * @throws Error if the browser can encode no video codec or no audio codec of the list.
   */
  async start(): Promise<void> {
    const { width, height, fps } = this.#format;
    const context = this.#audio.context;
    this.#sampleRate = context.sampleRate;
    const bitrate = Math.round(width * height * fps * 0.1);
    const video = await firstSupported(
      [
        ['avc1.640033', 'avc'],
        ['avc1.4d0033', 'avc'],
        ['avc1.42003e', 'avc'],
        ['vp09.00.51.08', 'vp9'],
        ['av01.0.12M.08', 'av1'],
      ] as const,
      async (codec) =>
        (await VideoEncoder.isConfigSupported({ codec, width, height, bitrate, framerate: fps }))
          .supported === true,
    );
    const audio = await firstSupported(
      [
        ['mp4a.40.2', 'aac'],
        ['opus', 'opus'],
      ] as const,
      async (codec) =>
        (
          await AudioEncoder.isConfigSupported({
            codec,
            sampleRate: this.#sampleRate,
            numberOfChannels: 2,
            bitrate: 192_000,
          })
        ).supported === true,
    );
    if (!video || !audio) {
      throw new Error(
        'This browser cannot encode MP4 video. Try a current Chrome, Edge, or Safari.',
      );
    }
    this.codecs = `${video[1].toUpperCase()} + ${audio[1].toUpperCase()}`;
    const muxer = new Muxer({
      target: new ArrayBufferTarget(),
      video: { codec: video[1], width, height, frameRate: fps },
      audio: { codec: audio[1], numberOfChannels: 2, sampleRate: this.#sampleRate },
      fastStart: 'in-memory',
      firstTimestampBehavior: 'offset',
    });
    this.#muxer = muxer;
    const fail = (error: Error): void => {
      this.#error ??= error;
    };
    this.#video = new VideoEncoder({
      output: (chunk, meta) => {
        muxer.addVideoChunk(chunk, meta);
      },
      error: fail,
    });
    this.#video.configure({
      codec: video[0],
      width,
      height,
      bitrate,
      framerate: fps,
      latencyMode: 'quality',
      ...(video[1] === 'avc' ? { avc: { format: 'avc' as const } } : {}),
    });
    this.#encoderAudio = new AudioEncoder({
      output: (chunk, meta) => {
        muxer.addAudioChunk(chunk, meta);
      },
      error: fail,
    });
    this.#encoderAudio.configure({
      codec: audio[0],
      sampleRate: this.#sampleRate,
      numberOfChannels: 2,
      bitrate: 192_000,
    });
    if (!tapContexts.has(context)) {
      const url = URL.createObjectURL(new Blob([TAP_CODE], { type: 'text/javascript' }));
      try {
        await context.audioWorklet.addModule(url);
      } finally {
        URL.revokeObjectURL(url);
      }
      tapContexts.add(context);
    }
    const tap = new AudioWorkletNode(context, TAP_NAME, {
      numberOfInputs: 1,
      numberOfOutputs: 1,
      outputChannelCount: [2],
      channelCount: 2,
      channelCountMode: 'explicit',
    });
    tap.port.onmessage = (event: MessageEvent<{ t: number; l: Float32Array; r: Float32Array }>) => {
      this.#addAudio(event.data.t, event.data.l, event.data.r);
    };
    const sink = context.createGain();
    sink.gain.value = 0;
    this.#audio.tap.connect(tap);
    tap.connect(sink);
    sink.connect(context.destination);
    this.#tap = tap;
    this.#sink = sink;
  }

  /**
   * Keeps the frame of the canvas when its song time reaches the next frame of the format.
   *
   * @param songSec The song time of the frame that the canvas shows.
   */
  frame(songSec: number): void {
    const encoder = this.#video;
    if (!encoder || this.#error || songSec < this.#nextFrameSec - 0.25 / this.#format.fps) {
      return;
    }
    if (this.#lastFrameSec >= this.#endSec) {
      return;
    }
    // The first frame starts the file at the song time 0.
    const time = this.#frames === 0 ? 0 : Math.max(songSec, this.#lastFrameSec + 0.001);
    const frame = new VideoFrame(this.#canvas, { timestamp: Math.round(time * 1e6) });
    const keyFrame = this.#frames % (this.#format.fps * 2) === 0;
    encoder.encode(frame, { keyFrame });
    frame.close();
    this.#frames++;
    this.#lastFrameSec = time;
    const step = 1 / this.#format.fps;
    this.#nextFrameSec = (Math.floor(time / step + 1e-6) + 1) * step;
  }

  /**
   * Adds the samples of one message of the tap. The audio of the file starts at the song time 0:
   * samples before it go, and a gap before the first sample gets silence.
   *
   * @param contextTime The context time of the first sample.
   * @param left The left channel.
   * @param right The right channel.
   */
  #addAudio(contextTime: number, left: Float32Array, right: Float32Array): void {
    const encoder = this.#encoderAudio;
    if (!encoder || this.#error || this.#audioEndSec >= this.#endSec) {
      return;
    }
    const rate = this.#sampleRate;
    let l = left;
    let r = right;
    if (!this.#audioStarted) {
      const songSec = this.#audio.songTimeAt(contextTime);
      const endSec = songSec + l.length / rate;
      if (endSec <= 0 || this.#frames === 0) {
        return;
      }
      this.#audioStarted = true;
      if (songSec < 0) {
        const skip = Math.min(l.length, Math.round(-songSec * rate));
        l = l.subarray(skip);
        r = r.subarray(skip);
      } else if (songSec > 0) {
        this.#encodeAudio(new Float32Array(Math.round(songSec * rate)), null);
      }
    }
    this.#encodeAudio(l, r);
  }

  /**
   * Encodes stereo samples after the samples before them.
   *
   * @param left The left channel.
   * @param right The right channel, or `null` for the same samples as the left one.
   */
  #encodeAudio(left: Float32Array, right: Float32Array | null): void {
    const encoder = this.#encoderAudio;
    const frames = left.length;
    if (!encoder || frames === 0) {
      return;
    }
    const data = new Float32Array(frames * 2);
    data.set(left, 0);
    data.set(right ?? left, frames);
    const audio = new AudioData({
      format: 'f32-planar',
      sampleRate: this.#sampleRate,
      numberOfFrames: frames,
      numberOfChannels: 2,
      timestamp: Math.round((this.#audioFrames / this.#sampleRate) * 1e6),
      data,
    });
    encoder.encode(audio);
    audio.close();
    this.#audioFrames += frames;
    this.#audioEndSec = this.#audioFrames / this.#sampleRate;
  }

  /** Disconnects the audio tap. */
  #stopTap(): void {
    this.#tap?.port.postMessage('stop');
    this.#tap?.disconnect();
    this.#sink?.disconnect();
    try {
      this.#audio.tap.disconnect(this.#tap ?? this.#audio.context.destination);
    } catch {
      // The tap was not connected.
    }
    this.#tap = null;
    this.#sink = null;
  }

  /**
   * Ends the render and gives the file.
   *
   * @returns The MP4 file.
   * @throws Error if an encoder failed.
   */
  async finish(): Promise<Blob> {
    this.#stopTap();
    await this.#video?.flush();
    await this.#encoderAudio?.flush();
    this.#video?.close();
    this.#encoderAudio?.close();
    if (this.#error) {
      throw this.#error;
    }
    const muxer = this.#muxer;
    if (!muxer) {
      throw new Error('The render did not start.');
    }
    muxer.finalize();
    return new Blob([muxer.target.buffer], { type: 'video/mp4' });
  }

  /** Stops the render and drops the file. */
  cancel(): void {
    this.#stopTap();
    for (const encoder of [this.#video, this.#encoderAudio]) {
      if (encoder && encoder.state !== 'closed') {
        encoder.close();
      }
    }
    this.#muxer = null;
  }
}
