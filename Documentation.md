# Documentation — Offline Video Compressor (FFmpeg WASM)

This document explains the app’s architecture, user flow, and the key parts of the implementation.

---

## 1) Project overview

**Offline Video Compressor** is a **Next.js** app that compresses videos **entirely in the browser** using **FFmpeg WebAssembly**.

Key characteristics:

- No backend video upload/storage.
- FFmpeg WASM runs locally (client-side) in memory.
- Output is generated as **MP4 (H.264 video + AAC audio)**.

---

## 2) User flow

1. **Engine initialization**
   - On first load, the app downloads and loads the FFmpeg WASM core.
   - Until the engine is ready, file selection is disabled.

2. **Select / Drag & drop video**
   - User drags a video onto the drop zone or chooses a file.
   - Only `video/*` types are accepted.

3. **Choose an optimization preset**
   - The UI provides three presets:
     - High Quality → CRF `24`
     - Balanced (default) → CRF `28`
     - Max Compression → CRF `32`

4. **Compress**
   - Clicking “Initialize Encoding” runs FFmpeg in WASM.
   - The UI shows a progress ring and status text.

5. **Download output**
   - After encoding finishes, the app reads the output from FFmpeg’s virtual filesystem,
     creates a Blob URL, and offers a download link.

---

## 3) Implementation details

### 3.1 Main UI component

- File: `app/page.tsx`
- The entire experience is implemented as a client component (`'use client'`).

Important state variables:

- `isFfmpegLoaded`: whether the FFmpeg WASM engine is ready
- `file`: selected input file
- `quality`: selected preset (`high | medium | low`)
- `isCompressing`: compression in progress
- `progress`: progress percentage (0–100)
- `outputUrl`, `outputSize`: download link and size of the compressed result

### 3.2 FFmpeg WASM loading

The function `loadFFmpeg()`:

- Creates an `FFmpeg` instance (memoized via `ffmpegRef`)
- Hooks into:
  - `ffmpeg.on('progress', ...)` to update UI progress
  - `ffmpeg.on('log', ...)` to update status text
- Loads core + wasm from a CDN:
  - `coreURL` points to `ffmpeg-core.js`
  - `wasmURL` points to `ffmpeg-core.wasm`

### 3.3 Compression command

Compression is performed in `compressVideo()` via `ffmpeg.exec([...])`.

High-level steps:

1. Create input/output filenames:
   - `input_<timestamp>.<ext>`
   - `output_<timestamp>.mp4`
2. Write input file bytes into FFmpeg’s in-memory FS:
   - `ffmpeg.writeFile(inputName, await fetchFile(file))`
3. Execute FFmpeg with a preset-driven CRF:

FFmpeg arguments used:

- Video:
  - `-vcodec libx264`
  - `-crf <preset_crf>`
  - `-preset veryfast`
- Audio:
  - `-c:a aac`
  - `-b:a 128k`

4. Read output:

- `ffmpeg.readFile(outputName)`

5. Cleanup:

- `ffmpeg.deleteFile(inputName)`
- `ffmpeg.deleteFile(outputName)`

### 3.4 Download output

- The compressed data is wrapped in a Blob:
  - `new Blob([data], { type: 'video/mp4' })`
- A Blob URL is created:
  - `URL.createObjectURL(blob)`
- The UI provides:
  - `download={compressed_<originalFileName>}`

---

## 4) Preset configuration

Presets are defined in `QUALITY_SETTINGS`:

- **high**
  - `crf: '24'`
  - estimate ratio: `0.7`
- **medium** (default)
  - `crf: '28'`
  - estimate ratio: `0.45`
- **low**
  - `crf: '32'`
  - estimate ratio: `0.2`

These ratios are used only for the “Est. ~size” hint shown in the UI.

---

## 5) Notes & troubleshooting

- **Performance**: FFmpeg WASM encoding can be slow on low-end CPUs.
- **Browser constraints**:
  - Large videos may be memory intensive.
  - Output format is fixed to MP4.
- **Progress**: progress is derived from FFmpeg’s reported progress values; it’s clamped to 0–100.
- **Engine load**: if loading fails, refresh the page and try again.

---

## 6) Suggested improvements (optional)

Potential future enhancements:

- Revoke previous Blob URLs to avoid memory leaks (`URL.revokeObjectURL` on reset)
- Support alternative output codecs/presets
- Add estimated time remaining (ETA) based on progress and historical encode times
- Add validation for video duration / resolution / size
