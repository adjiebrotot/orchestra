# Orchestra

A WebGL MIDI player in which an orchestra of 3D animals plays your music on a small stage, with a
camera director and an MP4 render.

Live site: <https://orchestra.adjiebrotots.com/>

Orchestra is based on [Pawchestra](https://github.com/qiao/pawchestra) by Xueqiao (Joe) Xu. See
[License](#license) below.

## What this fork adds

- **Logo inlay on the stage floor.** The circled A of adjiebrotots.com is set into the planks as a
  darker stained disc with a pale-wood letter, so the wood grain shows through
  (`src/scene/stage.ts`, `logoCover()`).
- **No Pawchestra logo in the header**, and no built-in songs: add your own (below).
- **Camera director.** Click **Camera director** at the top of the stage. The panel shows a
  timeline with the notes of each instrument (from the MIDI file) and the time. Click a row at a
  time to point the camera at that instrument from there, or use **+ Cue at playhead**. For each
  cue, choose:
  - **Camera focus:** Automatic (the built-in film), Whole stage, High view, Conductor, or any
    instrument.
  - **Motion:** Static, Push in, Pull out, Orbit left, Orbit right, Crane up, Crane down.
  - **Into shot:** a smooth move from the previous shot, or a hard cut.

  Each cue holds until the next cue. Before the first cue, the built-in film plays. **Preview**
  plays the piece with the cinematic camera. The cues of each piece stay in your browser, and
  **Export** / **Import** save and load them as JSON (`src/shots/directed.ts`,
  `src/ui/director.ts`).
- **Stage design.** Click **Stage design** at the top of the stage to dress the back of the stage.
  Each object has a switch, and each starts with country flags:
  - **Standing banners** and **Hanging banners:** the number (the row stays symmetrical), the
    shape (pointed, swallowtail, straight, curved point, or rounded), the aspect ratio (it follows
    the image by default), and the images.
  - **Flags:** the number of flagpole groups, and the flags of each group.
  - **Screen:** an LED screen or a cloth with a projection, and its images. In the Camera director,
    click the **Screen** row at a time (or use **+ Screen cue at playhead**) to change the screen
    image there, with a fade or a cut.

  Upload your own images, or pick a built-in country flag. The settings and the images stay in your
  browser (`src/scene/backdrop.ts`, `src/ui/stage-panel.ts`).
- **Render MP4.** Click **Render MP4**, choose a format (1080p at 30 or 60 fps, 720p, or
  ultrawide 21:9), and click **Render**. The piece plays once from the start with the cinematic camera (your
  camera path when it is on), and the page encodes the canvas and the audio with WebCodecs into an
  MP4 file (H.264 or VP9/AV1 video, AAC or Opus audio, whichever the browser can encode). Keep the
  tab visible: the render runs in real time. The file downloads at the end
  (`src/app/render-video.ts`). Before the render starts, the page tests each encoder with a small
  file, and it uses a software encoder or the next codec when a test fails. The progress bar
  shows the state of the render: stripes that move while it works, a warning with a time limit
  while it waits for the playback or for an encoder, and an error with its cause when it fails.

## Add your songs

Put MIDI files in `demos/src/` and list them in `demos/demos.json`. With no songs, the start page
asks for a MIDI file (open one, or drop one on the page). [`demos/README.md`](demos/README.md)
gives the details.

## Run locally

Needs Node.js 24 and pnpm 10.

```bash
pnpm install
```

```bash
pnpm dev
```

Open `http://localhost:5173`. `pnpm build` writes the static site to `dist/`.

## Deploy (GitHub Pages)

`.github/workflows/pages.yml` builds the site and publishes it on each push to `main` (or by hand
from the Actions tab).

1. In the repository settings, open **Pages** and set **Source** to **GitHub Actions**.
2. Set the custom domain to `orchestra.adjiebrotots.com` (`public/CNAME` holds it too), and turn
   on **Enforce HTTPS** when GitHub offers it.
3. At the DNS host of adjiebrotots.com, add a `CNAME` record `orchestra` → `adjiebrotot.github.io`.

## Controls

| Key or gesture | Action |
|---|---|
| `Space` | Play or pause |
| `Left` / `Right` | Seek 5 seconds backward or forward |
| `Up` / `Down` | Turn the volume up or down |
| `Home` | Return to start |
| `C` | Toggle the cinematic camera |
| `M` | Toggle mute |
| `F` | Toggle full screen |
| `Escape` | Close drawer or dialog |
| Drag (> 4 px) | Orbit 3D camera |
| Scroll / Pinch | Zoom in or out |

## Technology

[Three.js](https://threejs.org/) (WebGL2), TypeScript, [Vite](https://vite.dev/),
[spessasynth_core](https://github.com/spessasus/spessasynth_core) (SoundFont synth in an
AudioWorklet), and [mp4-muxer](https://github.com/Vanilagy/mp4-muxer) for the MP4 file. The site
is static and uses no analytics. The architecture and the design docs of Pawchestra are in
`docs/`.

## License

- **Code:** the [Apache License 2.0](LICENSE). See [`NOTICE`](NOTICE).
- **Animal models:** the files in `assets/models/` and `src/models/bodies/` are under
  [CC BY-NC 4.0](assets/models/LICENSE): no commercial use.
- **Your output:** per the Pawchestra README, you own the videos, images, and audio that you make
  with the app, including for commercial use.
- **Third-party files:** the SoundFont, the hall reverb, and the font keep their own licenses. The
  build writes them all into `third-party-licenses.txt`, and the credits dialog of the app links
  it.
