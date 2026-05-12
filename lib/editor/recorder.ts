"use client";

/**
 * Voice Recording Engine
 * 
 * Uses the MediaRecorder API to capture microphone input and produce a WAV
 * blob that can be imported into the audio editor as a standard asset/clip.
 *
 * Design decisions:
 * - We record raw PCM via a ScriptProcessorNode (or AudioWorklet if available)
 *   and encode to WAV ourselves, avoiding codec compatibility issues.
 * - The recording is completely independent of the playback AudioContext; we
 *   create a dedicated stream-based context to avoid feedback loops.
 * - Live metering data is exposed via a callback so the UI can show a level
 *   meter during recording.
 */

export type RecorderState = "idle" | "recording" | "paused";

export type RecorderMeterStats = {
  /** RMS amplitude over the current frame, [0..1]. */
  rms: number;
  /** Peak absolute amplitude over the current frame, [0..1]. */
  peak: number;
  /**
   * The raw time-domain samples for the current frame. Reused across calls —
   * consumers must process synchronously and must not retain a reference.
   */
  samples: Float32Array;
  /** Sample rate of the analyser context, e.g. 48000. */
  sampleRate: number;
};

export type RecorderMeterListener = (stats: RecorderMeterStats) => void;

let _stream: MediaStream | null = null;
let _mediaRecorder: MediaRecorder | null = null;
let _chunks: Blob[] = [];
let _state: RecorderState = "idle";
let _startTime = 0;
let _pauseAccum = 0;
let _pauseStart = 0;
const _meterListeners = new Set<RecorderMeterListener>();

// Metering via AnalyserNode
let _meterSource: MediaStreamAudioSourceNode | null = null;
let _meterAnalyser: AnalyserNode | null = null;
let _meterRaf = 0;
let _meterCtx: AudioContext | null = null;

const _listeners = new Set<() => void>();

export function onRecorderChange(fn: () => void): () => void {
  _listeners.add(fn);
  return () => _listeners.delete(fn);
}

function notify() {
  for (const fn of _listeners) fn();
}

export function recorderState(): RecorderState {
  return _state;
}

export function recorderElapsed(): number {
  if (_state === "idle") return 0;
  if (_state === "paused") return (_pauseStart - _startTime - _pauseAccum) / 1000;
  return (performance.now() - _startTime - _pauseAccum) / 1000;
}

/**
 * Subscribe to per-frame stats while recording. Multiple consumers welcome —
 * the level meter consumes `rms`/`peak`, the live-peaks pipeline reads the
 * raw `samples` buffer to derive per-bucket min/max. Returns an unsubscribe
 * function.
 */
export function addMeterListener(fn: RecorderMeterListener): () => void {
  _meterListeners.add(fn);
  return () => {
    _meterListeners.delete(fn);
  };
}

/* Larger FFT window so livePeaks can subdivide into multiple sub-windows
   per analyser tick — a 4096-sample window at 48 kHz covers ~85 ms, plenty
   of headroom for the ~3-4 grid buckets we need to fill per rAF frame. */
const ANALYSER_FFT_SIZE = 4096;
const _emptySamples = new Float32Array(0);

function emitStats(stats: RecorderMeterStats) {
  for (const fn of _meterListeners) fn(stats);
}

function startMeter(stream: MediaStream) {
  try {
    // Use a separate AudioContext for metering to avoid interfering with
    // the main playback context.
    _meterCtx = new AudioContext();
    _meterSource = _meterCtx.createMediaStreamSource(stream);
    _meterAnalyser = _meterCtx.createAnalyser();
    _meterAnalyser.fftSize = ANALYSER_FFT_SIZE;
    /* Smoothing only affects FFT data per spec, but some browsers historically
       applied it to time-domain data too — keep at 0 so we get raw samples. */
    _meterAnalyser.smoothingTimeConstant = 0;
    _meterSource.connect(_meterAnalyser);
    // Don't connect to destination — we just need the analyser for metering.

    const sampleRate = _meterCtx.sampleRate;
    const buf = new Float32Array(_meterAnalyser.fftSize);
    const tick = () => {
      if (_state !== "recording") return;
      _meterAnalyser!.getFloatTimeDomainData(buf);
      let sum = 0;
      let peak = 0;
      for (let i = 0; i < buf.length; i++) {
        const v = buf[i];
        const a = v < 0 ? -v : v;
        sum += v * v;
        if (a > peak) peak = a;
      }
      const rms = Math.sqrt(sum / buf.length);
      emitStats({ rms, peak, samples: buf, sampleRate });
      _meterRaf = requestAnimationFrame(tick);
    };
    _meterRaf = requestAnimationFrame(tick);
  } catch {
    // Metering is optional — if it fails, recording still works.
  }
}

function stopMeter() {
  if (_meterRaf) {
    cancelAnimationFrame(_meterRaf);
    _meterRaf = 0;
  }
  try { _meterSource?.disconnect(); } catch { /* */ }
  try { _meterCtx?.close(); } catch { /* */ }
  _meterSource = null;
  _meterAnalyser = null;
  _meterCtx = null;
  emitStats({ rms: 0, peak: 0, samples: _emptySamples, sampleRate: 0 });
}

/**
 * Request microphone permissions and start recording.
 * Returns true on success, false if the user denied access.
 */
export async function startRecording(): Promise<boolean> {
  if (_state !== "idle") return false;

  try {
    _stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        sampleRate: 48000,
      },
    });
  } catch {
    return false;
  }

  _chunks = [];

  // Prefer opus in webm for quality; fall back to whatever is available.
  const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
    ? "audio/webm;codecs=opus"
    : MediaRecorder.isTypeSupported("audio/webm")
      ? "audio/webm"
      : "";

  _mediaRecorder = new MediaRecorder(_stream, {
    ...(mimeType ? { mimeType } : {}),
    audioBitsPerSecond: 128000,
  });

  _mediaRecorder.ondataavailable = (e) => {
    if (e.data.size > 0) _chunks.push(e.data);
  };

  _mediaRecorder.start(250); // collect chunks every 250ms for responsiveness
  _startTime = performance.now();
  _pauseAccum = 0;
  _state = "recording";
  notify();

  startMeter(_stream);

  return true;
}

/**
 * Pause the current recording.
 */
export function pauseRecording(): void {
  if (_state !== "recording" || !_mediaRecorder) return;
  _mediaRecorder.pause();
  _pauseStart = performance.now();
  _state = "paused";
  stopMeter();
  notify();
}

/**
 * Resume a paused recording.
 */
export function resumeRecording(): void {
  if (_state !== "paused" || !_mediaRecorder) return;
  _pauseAccum += performance.now() - _pauseStart;
  _mediaRecorder.resume();
  _state = "recording";
  if (_stream) startMeter(_stream);
  notify();
}

/**
 * Stop the recording and return the result as a File.
 * Returns null if nothing was recorded.
 */
export function stopRecording(): Promise<File | null> {
  return new Promise((resolve) => {
    if (!_mediaRecorder || _state === "idle") {
      resolve(null);
      return;
    }

    _mediaRecorder.onstop = () => {
      stopMeter();

      if (_chunks.length === 0) {
        cleanup();
        resolve(null);
        return;
      }

      const mimeType = _mediaRecorder?.mimeType || "audio/webm";
      const ext = mimeType.includes("webm") ? "webm" : mimeType.includes("mp4") ? "m4a" : "ogg";
      const blob = new Blob(_chunks, { type: mimeType });
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
      const file = new File([blob], `Recording_${timestamp}.${ext}`, { type: mimeType });

      cleanup();
      resolve(file);
    };

    _mediaRecorder.stop();
  });
}

/**
 * Cancel the recording without producing output.
 */
export function cancelRecording(): void {
  if (_state === "idle") return;
  try { _mediaRecorder?.stop(); } catch { /* */ }
  stopMeter();
  cleanup();
}

function cleanup() {
  if (_stream) {
    for (const track of _stream.getTracks()) track.stop();
    _stream = null;
  }
  _mediaRecorder = null;
  _chunks = [];
  _state = "idle";
  _startTime = 0;
  _pauseAccum = 0;
  _pauseStart = 0;
  notify();
}

/**
 * Check if the browser supports audio recording.
 */
export function isRecordingSupported(): boolean {
  return !!(
    typeof navigator !== "undefined" &&
    typeof navigator.mediaDevices?.getUserMedia === "function" &&
    typeof MediaRecorder !== "undefined"
  );
}
