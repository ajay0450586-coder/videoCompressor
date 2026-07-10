# Offline Video Compressor (FFmpeg WASM)

A fully **offline / client-side** video compressor built with **Next.js** and **FFmpeg WebAssembly**.

- Upload a video (runs **entirely in your browser**)
- Choose an optimization preset (High / Balanced / Max)
- Download the compressed MP4

No server uploads, no backend storage.

---
## Preview
<image src="./assets/videoCopressor1.png"></image>
<image src="./assets/videoCopressor2.png"></image>

## Demo / Features

- **Offline compression** using `@ffmpeg/ffmpeg` (FFmpeg WASM)
- **Progress + status UI** while encoding
- Quality presets based on **CRF**
- Client-side download as a Blob URL

---

## Tech Stack

- Next.js (React)
- Tailwind CSS
- FFmpeg WASM: `@ffmpeg/ffmpeg`, `@ffmpeg/util`

---

## How it works

1. The app loads the FFmpeg WASM core in the browser.
2. Your selected video is written into FFmpeg’s in-memory filesystem.
3. FFmpeg re-encodes the video to **H.264 (libx264)** with the selected **CRF**.
4. The resulting file is read back from the in-memory filesystem and offered for download.

---

## Presets

The UI exposes these optimization presets:

- **High Quality**: CRF `24`
- **Balanced**: CRF `28` (default)
- **Max Compression**: CRF `32`

Audio is encoded to AAC at `128k` and video uses the `veryfast` preset for faster WASM execution.

---

## Project setup

```bash
cd projects/52.video-compressor
npm install
```

## Run locally

```bash
npm run dev
```

Then open the URL printed in your terminal (typically `http://localhost:3000`).

---

## Build & start

```bash
npm run build
npm start
```

---

## Notes / Limitations

- FFmpeg compression is compute-heavy and may take time on slower devices.
- Supported input is any `video/*`, but output is generated as **MP4 (H.264 + AAC)**.
- Performance depends on codec support and browser/WASM capabilities.

---

## License

Add your preferred license here (or remove this section).
