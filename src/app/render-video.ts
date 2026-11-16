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

/** The time without encoder output after which {@link VideoRender.finish} stops, in milliseconds. */
const STALL_MS = 30_000;

/** The time that a flush can stay open after the last frame of the video, in milliseconds. */
const FLUSH_GRACE_MS = 3000;

/** The longest time of the test of one encoder, in milliseconds. */
const TEST_MS = 5000;

/** The time of video that the encoder can hold without output before the render stops, in seconds. */
const STARVED_SEC = 10;

/** The time without audio after which the render stops its wait for the last audio, in milliseconds. */
const AUDIO_WAIT_MS = 3000;

/** The frames of audio in one packet of each audio codec, for a chunk that has no duration. */
const PACKET_FRAMES = { aac: 1024, opus: 960 } as const;

/**
 * The video codecs in the order of preference, the name of each one for the muxer, and its name
 * for the status line of its test.
 */
const VIDEO_CODECS = [
  ['avc1.640033', 'avc', 'H.264 High'],
  ['avc1.4d0033', 'avc', 'H.264 Main'],
  ['avc1.42003e', 'avc', 'H.264 Baseline'],
  ['vp09.00.51.08', 'vp9', 'VP9'],
  ['av01.0.12M.08', 'av1', 'AV1'],
] as const;

/** The audio codecs in the order of preference, and the name of each one for the muxer. */
const AUDIO_CODECS = [
  ['mp4a.40.2', 'aac'],
  ['opus', 'opus'],
] as const;

/** The name of a video codec for the muxer. */
type VideoKind = (typeof VIDEO_CODECS)[number][1];

/** The name of an audio codec for the muxer. */
type AudioKind = (typeof AUDIO_CODECS)[number][1];

/** The names of the codecs for the status line. */
const CODEC_NAMES = { avc: 'H.264', vp9: 'VP9', av1: 'AV1', aac: 'AAC', opus: 'Opus' } as const;

/** The step of a render: it records the piece, the encoders end their work, the file builds. */
export type RenderStage = 'recording' | 'encoding' | 'building';

/** The contexts that have the processor of the tap. */
const tapContexts = new WeakSet<BaseAudioContext>();

/**
 * Finds the first item of a list that passes a test.
 *
 * @param list The items.
 * @param test Tells if an item is good. An error counts as "no".
 * @returns The first good item, or `null`.
 */
async function firstSupported<T>(
  list: readonly T[],
  test: (item: T) => Promise<boolean>,
): Promise<T | null> {
  for (const item of list) {
    if (await test(item).catch(() => false)) {
      return item;
    }
  }
  return null;
}

/**
 * Waits for a promise, but not longer than a time limit.
 *
 * @param work The promise.
 * @param limitMs The time limit, in milliseconds.
 * @returns True if the promise resolves in the time limit. False at the limit or at an error.
 */
async function within(work: Promise<unknown>, limitMs: number): Promise<boolean> {
  let timer = 0;
  const limit = new Promise<boolean>((resolve) => {
    timer = window.setTimeout(() => {
      resolve(false);
    }, limitMs);
  });
  const done = work.then(
    () => true,
    () => false,
  );
  const result = await Promise.race([done, limit]);
  window.clearTimeout(timer);
  return result;
}

/**
 * Gives the configuration of a video encoder.
 *
 * @param codec The codec string.
 * @param kind The name of the codec for the muxer.
 * @param hardwareAcceleration The preference between a hardware and a software encoder.
 * @param format The size and the frame rate.
 * @returns The configuration.
 */
function videoConfig(
  codec: string,
  kind: VideoKind,
  hardwareAcceleration: HardwareAcceleration,
  format: RenderFormat,
): VideoEncoderConfig {
  const { width, height, fps } = format;
  const config: VideoEncoderConfig = {
    codec,
    width,
    height,
    bitrate: Math.round(width * height * fps * 0.1),
    framerate: fps,
    latencyMode: 'quality',
    hardwareAcceleration,
  };
  if (kind === 'avc') {
    config.avc = { format: 'avc' };
  }
  return config;
}

/**
 * Gives a video chunk to a muxer. Some browsers give chunks without a duration, and the muxer
 * refuses such a chunk, so the chunk then gets the duration of one frame.
 *
 * @param muxer The muxer.
 * @param chunk The chunk of the encoder.
 * @param meta The metadata of the chunk.
 * @param frameUs The duration of one frame, in microseconds.
 */
function addVideo(
  muxer: Muxer<ArrayBufferTarget>,
  chunk: EncodedVideoChunk,
  meta: EncodedVideoChunkMetadata | undefined,
  frameUs: number,
): void {
  const data = new Uint8Array(chunk.byteLength);
  chunk.copyTo(data);
  muxer.addVideoChunkRaw(data, chunk.type, chunk.timestamp, chunk.duration ?? frameUs, meta);
}

/**
 * Gives an audio chunk to a muxer. A chunk without a duration gets the duration of one packet.
 *
 * @param muxer The muxer.
 * @param chunk The chunk of the encoder.
 * @param meta The metadata of the chunk.
 * @param packetUs The duration of one packet, in microseconds.
 */
function addAudio(
  muxer: Muxer<ArrayBufferTarget>,
  chunk: EncodedAudioChunk,
  meta: EncodedAudioChunkMetadata | undefined,
  packetUs: number,
): void {
  const data = new Uint8Array(chunk.byteLength);
  chunk.copyTo(data);
  muxer.addAudioChunkRaw(data, chunk.type, chunk.timestamp, chunk.duration ?? packetUs, meta);
}

/**
 * Gives stereo samples as the audio data of an encoder.
 *
 * @param left The left channel.
 * @param right The right channel.
 * @param sampleRate The sample rate, in hertz.
 * @param startFrame The number of the first frame, from the start of the audio.
 * @returns The audio data. The caller closes it.
 */
function audioDataOf(
  left: Float32Array,
  right: Float32Array,
  sampleRate: number,
  startFrame: number,
): AudioData {
  const frames = left.length;
  const data = new Float32Array(frames * 2);
  data.set(left, 0);
  data.set(right, frames);
  return new AudioData({
    format: 'f32-planar',
    sampleRate,
    numberOfFrames: frames,
    numberOfChannels: 2,
    timestamp: Math.round((startFrame / sampleRate) * 1e6),
    data,
  });
}

/**
 * Tests a video encoder: it encodes some frames into a small MP4 file. A configuration that the
 * browser accepts can still give no chunks, or chunks that the muxer refuses. The render then
 * records the full piece for no file, so the test finds such an encoder before the render.
 *
 * @param config The configuration of the encoder.
 * @param kind The name of the codec for the muxer.
 * @param format The size and the frame rate.
 * @returns True if the encoder gives a file.
 */
async function testVideo(
  config: VideoEncoderConfig,
  kind: VideoKind,
  format: RenderFormat,
): Promise<boolean> {
  if ((await VideoEncoder.isConfigSupported(config)).supported !== true) {
    return false;
  }
  const { width, height, fps } = format;
  const frameUs = Math.round(1e6 / fps);
  const muxer = new Muxer({
    target: new ArrayBufferTarget(),
    video: { codec: kind, width, height, frameRate: fps },
    fastStart: 'in-memory',
    firstTimestampBehavior: 'offset',
  });
  let chunks = 0;
  let failed = false;
  const encoder = new VideoEncoder({
    output: (chunk, meta) => {
      try {
        addVideo(muxer, chunk, meta, frameUs);
        chunks++;
      } catch {
        failed = true;
      }
    },
    error: () => {
      failed = true;
    },
  });
  try {
    encoder.configure(config);
    const canvas = new OffscreenCanvas(width, height);
    const context = canvas.getContext('2d');
    if (!context) {
      return false;
    }
    for (let i = 0; i < 4; i++) {
      context.fillStyle = i % 2 === 0 ? '#234' : '#987';
      context.fillRect(0, 0, width, height);
      const frame = new VideoFrame(canvas, { timestamp: i * frameUs, duration: frameUs });
      encoder.encode(frame, { keyFrame: i === 0 });
      frame.close();
    }
    if (!(await within(encoder.flush(), TEST_MS)) || failed || chunks === 0) {
      return false;
    }
    muxer.finalize();
    return muxer.target.buffer.byteLength > 0;
  } finally {
    if (encoder.state !== 'closed') {
      encoder.close();
    }
  }
}

/**
 * Tests an audio encoder: it encodes a short silence into a small MP4 file.
 *
 * @param config The configuration of the encoder.
 * @param kind The name of the codec for the muxer.
 * @returns True if the encoder gives a file.
 */
async function testAudio(config: AudioEncoderConfig, kind: AudioKind): Promise<boolean> {
  if ((await AudioEncoder.isConfigSupported(config)).supported !== true) {
    return false;
  }
  const { sampleRate } = config;
  const packetUs = (PACKET_FRAMES[kind] / sampleRate) * 1e6;
  const muxer = new Muxer({
    target: new ArrayBufferTarget(),
    audio: { codec: kind, numberOfChannels: 2, sampleRate },
    fastStart: 'in-memory',
    firstTimestampBehavior: 'offset',
  });
  let chunks = 0;
  let failed = false;
  const encoder = new AudioEncoder({
    output: (chunk, meta) => {
      try {
        addAudio(muxer, chunk, meta, packetUs);
        chunks++;
      } catch {
        failed = true;
      }
    },
    error: () => {
      failed = true;
    },
  });
  try {
    encoder.configure(config);
    const silence = new Float32Array(Math.round(sampleRate / 4));
    const audio = audioDataOf(silence, silence, sampleRate, 0);
    encoder.encode(audio);
    audio.close();
    if (!(await within(encoder.flush(), TEST_MS)) || failed || chunks === 0) {
      return false;
    }
    muxer.finalize();
    return muxer.target.buffer.byteLength > 0;
  } finally {
    if (encoder.state !== 'closed') {
      encoder.close();
    }
  }
}

/**
 * Records the canvas of the stage and the audio output into an MP4 file while the piece plays. The
 * app calls {@link VideoRender.frame} after each frame that it renders. The video takes its time
 * from the song time of each frame, and the audio from the song time of its samples, so the two
 * stay in sync at each speed of the device.
 *
 * The render never waits without a limit: an encoder that gives no output, an audio that gives no
 * samples, and a muxer that refuses a chunk each stop the render with an error.
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
  #stage: RenderStage = 'recording';
  #cancelled = false;
  /** The song time of the next frame to keep, in seconds. */
  #nextFrameSec = 0;
  #frames = 0;
  /** The video chunks that the muxer holds. */
  #videoChunks = 0;
  /** The frames that the video encoder got after its last chunk. */
  #framesSinceChunk = 0;
  /** The wall time of the last output of an encoder, in milliseconds. */
  #lastOutputMs = 0;
  /** The wall time of the last samples of the tap, in milliseconds. */
  #lastAudioMs = 0;
  /** The wall time at which the video got its last frame, in milliseconds, or 0 before it. */
  #videoEndMs = 0;
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

  /** The error of an encoder, of the muxer, or of a watch of the render, or `null`. */
  get error(): Error | null {
    return this.#error;
  }

  /** The step of the render. */
  get stage(): RenderStage {
    return this.#stage;
  }

  /** True after {@link VideoRender.cancel}. */
  get cancelled(): boolean {
    return this.#cancelled;
  }

  /** The part of the recording that is done, from 0 to 1. */
  get progress(): number {
    return Math.min(1, Math.min(this.#lastFrameSec, this.#audioEndSec) / this.#endSec);
  }

  /** The frames that the video encoder got. */
  get framesIn(): number {
    return this.#frames;
  }

  /** The frames that the video encoder gave to the file. */
  get framesOut(): number {
    return this.#videoChunks;
  }

  /** The part of the frames that the video encoder gave to the file, from 0 to 1. */
  get written(): number {
    return this.#frames === 0 ? 1 : Math.min(1, this.#videoChunks / this.#frames);
  }

  /** The time of video that the encoder holds and did not give to the file, in seconds. */
  get behindSec(): number {
    return (this.#frames - this.#videoChunks) / this.#format.fps;
  }

  /** The time since the last output of an encoder, in milliseconds. */
  get quietMs(): number {
    return performance.now() - this.#lastOutputMs;
  }

  /** The time without encoder output after which the last step stops, in milliseconds. */
  get quietLimitMs(): number {
    return STALL_MS;
  }

  /**
   * True when the recording is complete: the video and the audio reach the end time. When the
   * video is at its end and the audio gives no more samples, the recording is also complete, and
   * the file has a shorter audio.
   */
  get done(): boolean {
    if (this.#videoEndMs === 0) {
      return false;
    }
    if (this.#audioEndSec >= this.#endSec) {
      return true;
    }
    const now = performance.now();
    const quiet = now - Math.max(this.#lastAudioMs, this.#videoEndMs);
    if (quiet < AUDIO_WAIT_MS) {
      return false;
    }
    if (this.#audioFrames === 0) {
      this.#error ??= new Error('The audio output gave no samples.');
      return false;
    }
    return true;
  }

  /**
   * Sets up the encoders, the muxer, and the audio tap. Each encoder must pass a test before the
   * render uses it: a hardware encoder that fails gives way to a software encoder, and a codec
   * that fails gives way to the next codec.
   *
   * @param report Shows a status line during the tests.
   * @throws Error if the browser can encode no video codec or no audio codec of the list.
   */
  async start(report: (status: string) => void): Promise<void> {
    const format = this.#format;
    const { width, height, fps } = format;
    const context = this.#audio.context;
    this.#sampleRate = context.sampleRate;
    const videoTests = VIDEO_CODECS.flatMap(([codec, kind, name]) =>
      (['no-preference', 'prefer-software'] as const).map((hardware) => ({
        kind,
        name: hardware === 'prefer-software' ? `${name}, software` : name,
        config: videoConfig(codec, kind, hardware, format),
      })),
    );
    const video = await firstSupported(videoTests, async (test) => {
      const step = `${videoTests.indexOf(test) + 1} of ${videoTests.length}`;
      report(`Testing the video encoder: ${test.name} (test ${step})…`);
      return await testVideo(test.config, test.kind, format);
    });
    const audio = await firstSupported(
      AUDIO_CODECS.map(([codec, kind]) => ({
        kind,
        config: { codec, sampleRate: this.#sampleRate, numberOfChannels: 2, bitrate: 192_000 },
      })),
      async ({ kind, config }) => {
        report(`Testing the audio encoder: ${CODEC_NAMES[kind]}…`);
        return await testAudio(config, kind);
      },
    );
    if (!video || !audio) {
      throw new Error(
        `This browser cannot encode the ${video ? 'audio' : 'video'} of an MP4 file. Try a current Chrome, Edge, or Safari.`,
      );
    }
    report('Starting the encoders…');
    this.codecs = `${CODEC_NAMES[video.kind]} + ${CODEC_NAMES[audio.kind]}`;
    const muxer = new Muxer({
      target: new ArrayBufferTarget(),
      video: { codec: video.kind, width, height, frameRate: fps },
      audio: { codec: audio.kind, numberOfChannels: 2, sampleRate: this.#sampleRate },
      fastStart: 'in-memory',
      firstTimestampBehavior: 'offset',
    });
    this.#muxer = muxer;
    const fail = (error: Error): void => {
      this.#error ??= error;
    };
    // An error in an output callback goes only to the console, so each callback keeps the error
    // of the muxer: the render then stops with its message.
    const frameUs = 1e6 / fps;
    const packetUs = (PACKET_FRAMES[audio.kind] / this.#sampleRate) * 1e6;
    this.#lastOutputMs = performance.now();
    this.#video = new VideoEncoder({
      output: (chunk, meta) => {
        this.#lastOutputMs = performance.now();
        this.#framesSinceChunk = 0;
        try {
          addVideo(muxer, chunk, meta, frameUs);
          this.#videoChunks++;
        } catch (error) {
          fail(error instanceof Error ? error : new Error(String(error)));
        }
      },
      error: fail,
    });
    this.#video.configure(video.config);
    this.#encoderAudio = new AudioEncoder({
      output: (chunk, meta) => {
        this.#lastOutputMs = performance.now();
        try {
          addAudio(muxer, chunk, meta, packetUs);
        } catch (error) {
          fail(error instanceof Error ? error : new Error(String(error)));
        }
      },
      error: fail,
    });
    this.#encoderAudio.configure(audio.config);
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
      this.#lastAudioMs = performance.now();
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
    // An encoder that gets frames and gives no chunk for a long time does not work.
    if (this.#framesSinceChunk > STARVED_SEC * this.#format.fps) {
      this.#error = new Error(
        `The video encoder gave no output for ${STARVED_SEC} seconds of video.`,
      );
      return;
    }
    // The first frame starts the file at the song time 0.
    const time = this.#frames === 0 ? 0 : Math.max(songSec, this.#lastFrameSec + 0.001);
    const frame = new VideoFrame(this.#canvas, {
      timestamp: Math.round(time * 1e6),
      duration: Math.round(1e6 / this.#format.fps),
    });
    const keyFrame = this.#frames % (this.#format.fps * 2) === 0;
    encoder.encode(frame, { keyFrame });
    frame.close();
    this.#frames++;
    this.#framesSinceChunk++;
    this.#lastFrameSec = time;
    if (this.#videoEndMs === 0 && time >= this.#endSec - 1 / this.#format.fps) {
      this.#videoEndMs = performance.now();
    }
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
    if (!encoder || encoder.state !== 'configured' || frames === 0) {
      return;
    }
    const audio = audioDataOf(left, right ?? left, this.#sampleRate, this.#audioFrames);
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

  /** Closes the two encoders. */
  #closeEncoders(): void {
    for (const encoder of [this.#video, this.#encoderAudio]) {
      if (encoder && encoder.state !== 'closed') {
        encoder.close();
      }
    }
  }

  /**
   * Waits until the encoders give all their chunks. It stops when an encoder fails, when the
   * render is cancelled, or when no encoder gives a chunk for {@link STALL_MS}.
   *
   * @throws Error if an encoder failed or stopped, or after a cancel.
   */
  async #flush(): Promise<void> {
    this.#lastOutputMs = performance.now();
    let timer = 0;
    const stopped = new Promise<void>((resolve, reject) => {
      timer = window.setInterval(() => {
        if (this.#videoChunks >= this.#frames && this.quietMs > FLUSH_GRACE_MS) {
          // The file has all the frames, and the flush gives no answer: the render goes on.
          resolve();
        } else if (this.#cancelled) {
          reject(new Error('The render stopped.'));
        } else if (this.#error) {
          reject(this.#error);
        } else if (this.quietMs > STALL_MS) {
          reject(
            new Error(
              `The video encoder gave no output for ${STALL_MS / 1000} seconds, with ${this.#frames - this.#videoChunks} frames left.`,
            ),
          );
        }
      }, 250);
    });
    try {
      await Promise.race([
        Promise.all([this.#video?.flush(), this.#encoderAudio?.flush()]),
        stopped,
      ]);
    } finally {
      window.clearInterval(timer);
    }
  }

  /**
   * Ends the render and gives the file. {@link VideoRender.stage}, {@link VideoRender.written},
   * and {@link VideoRender.quietMs} give the progress.
   *
   * @returns The MP4 file.
   * @throws Error if an encoder failed or stopped, or after a cancel.
   */
  async finish(): Promise<Blob> {
    this.#stopTap();
    this.#stage = 'encoding';
    try {
      await this.#flush();
    } finally {
      this.#closeEncoders();
    }
    if (this.#cancelled) {
      throw new Error('The render stopped.');
    }
    if (this.#error) {
      throw this.#error;
    }
    const muxer = this.#muxer;
    if (!muxer) {
      throw new Error('The render did not start.');
    }
    if (this.#videoChunks === 0) {
      throw new Error('The video encoder gave no frames.');
    }
    // The muxer builds the file in one long task. The page shows the step before it starts.
    this.#stage = 'building';
    await new Promise<void>((resolve) => {
      window.setTimeout(resolve, 60);
    });
    muxer.finalize();
    return new Blob([muxer.target.buffer], { type: 'video/mp4' });
  }

  /** Stops the render and drops the file. A {@link VideoRender.finish} that runs then fails. */
  cancel(): void {
    this.#cancelled = true;
    this.#stopTap();
    this.#closeEncoders();
    this.#muxer = null;
  }
}
