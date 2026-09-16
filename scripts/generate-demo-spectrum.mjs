// Original 128 BPM, eight-bar demo. Generate PCM, then measure its spectrum.
// No third-party music, runtime audio, or random per-bar animation is used.
import { mkdirSync, writeFileSync } from 'node:fs'
import assert from 'node:assert/strict'
const sampleRate = 44100,
  bpm = 128,
  beat = 60 / bpm,
  duration = 32 * beat
const fps = 32,
  bands = 32,
  fftSize = 8192
const samples = new Float64Array(sampleRate * duration)
let seed = 20260916
const noise = () => {
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
  return seed / 2147483648 - 1
}
const roots = [55, 43.6535, 65.4064, 48.9994]
let lastNoise = 0
for (let i = 0; i < samples.length; i++) {
  const t = i / sampleRate,
    b = t / beat,
    bar = Math.floor(b / 4)
  const kickTime = t % beat,
    snareTime = (t + beat) % (beat * 2),
    hatTime = t % (beat / 2)
  const sixteenth = t % (beat / 4),
    root = roots[bar % 4]
  const n = noise(),
    highNoise = (n - lastNoise) / 2
  lastNoise = n
  // Four-on-the-floor kick: pitch falls from 155 Hz to 48 Hz.
  const kick =
    0.7 *
    Math.sin(2 * Math.PI * (48 * kickTime + 107 * 0.018 * (1 - Math.exp(-kickTime / 0.018)))) *
    Math.exp(-kickTime / 0.065)
  const snare =
    0.22 *
    (highNoise + 0.35 * Math.sin(2 * Math.PI * 185 * snareTime)) *
    Math.exp(-snareTime / 0.06)
  const hat = 0.11 * highNoise * Math.exp(-hatTime / (Math.floor(b * 2) % 2 ? 0.045 : 0.015))
  const noteTime = t % (beat / 2),
    duck = 1 - 0.85 * Math.exp(-kickTime / 0.07)
  const bassEnvelope = Math.min(1, noteTime / 0.012) * Math.exp(-noteTime / 0.2) * duck
  let bass = 0
  for (let h = 1; h <= 6; h++) bass += Math.sin(2 * Math.PI * root * h * noteTime) / (h * h)
  const arpeggio = [0, 7, 12, 15, 12, 7, 19, 12]
  const note = root * 4 * 2 ** (arpeggio[Math.floor(b * 4) % 8] / 12)
  let pluck = 0
  for (let h = 1; h <= 8; h++)
    pluck +=
      (Math.sin(2 * Math.PI * note * h * sixteenth) * Math.exp(-sixteenth * (14 + h * 4))) / h
  const lead = 0.085 * pluck * Math.min(1, sixteenth / 0.003) * duck
  const fill =
    bar % 4 === 3 && b % 4 > 3 ? 0.07 * highNoise * Math.exp(-(t % (beat / 4)) / 0.025) : 0
  samples[i] = Math.tanh(kick + snare + hat + 0.25 * bass * bassEnvelope + lead + fill)
}
function fft(re, im) {
  const n = re.length
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1
    for (; j & bit; bit >>= 1) j ^= bit
    j ^= bit
    if (i < j) {
      ;[re[i], re[j]] = [re[j], re[i]]
      ;[im[i], im[j]] = [im[j], im[i]]
    }
  }
  for (let size = 2; size <= n; size *= 2) {
    const angle = (-2 * Math.PI) / size
    for (let start = 0; start < n; start += size) {
      for (let j = 0; j < size / 2; j++) {
        const c = Math.cos(angle * j),
          s = Math.sin(angle * j),
          a = start + j,
          b = a + size / 2
        const tr = re[b] * c - im[b] * s,
          ti = re[b] * s + im[b] * c
        re[b] = re[a] - tr
        im[b] = im[a] - ti
        re[a] += tr
        im[a] += ti
      }
    }
  }
}
// Check the FFT against a known 1 kHz tone, within one frequency bin.
const testRe = Float64Array.from({ length: fftSize }, (_, i) =>
    Math.sin((2 * Math.PI * 1000 * i) / sampleRate),
  ),
  testIm = new Float64Array(fftSize)
fft(testRe, testIm)
let peak = 0
for (let i = 1; i < fftSize / 2; i++)
  if (Math.hypot(testRe[i], testIm[i]) > Math.hypot(testRe[peak], testIm[peak])) peak = i
assert(Math.abs((peak * sampleRate) / fftSize - 1000) < sampleRate / fftSize)
const edges = Array.from({ length: bands + 1 }, (_, i) => 30 * (16000 / 30) ** (i / bands))
const frames = [],
  smooth = new Float64Array(bands)
// Warm the smoothing filter with one complete pass to avoid a seam in the loop.
for (let frame = 0; frame < duration * fps * 2; frame++) {
  const re = new Float64Array(fftSize),
    im = new Float64Array(fftSize)
  const centre = Math.round(((frame % (duration * fps)) * sampleRate) / fps)
  for (let i = 0; i < fftSize; i++)
    re[i] =
      samples[(centre + i - fftSize / 2 + samples.length) % samples.length] *
      (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (fftSize - 1)))
  fft(re, im)
  const levels = edges.slice(0, -1).map((low, band) => {
    const first = Math.max(1, Math.ceil((low * fftSize) / sampleRate)),
      end = Math.max(first + 1, Math.ceil((edges[band + 1] * fftSize) / sampleRate))
    let power = 0
    for (let bin = first; bin < end; bin++)
      power += (re[bin] ** 2 + im[bin] ** 2) / (fftSize / 4) ** 2
    const db = 10 * Math.log10(Math.max(1e-12, power / (end - first)))
    const level = Math.max(0, Math.min(1, (db + 72) / 60))
    smooth[band] += (level - smooth[band]) * (level > smooth[band] ? 0.8 : 0.28)
    return Math.round(smooth[band] * 255)
  })
  if (frame >= duration * fps) frames.push(levels)
}
assert(
  frames.length === 480 &&
    frames.every((frame) => frame.length === bands && frame.every(Number.isFinite)),
)
mkdirSync('apps/web/src/components/marketing/data', { recursive: true })
writeFileSync(
  'apps/web/src/components/marketing/data/demo-spectrum.json',
  JSON.stringify({ fps, bpm, duration, frequencyEdges: edges.map(Math.round), frames }),
)
// Keep the source audio as a review artifact, not a browser download.
const wav = Buffer.alloc(44 + samples.length * 2)
wav.write('RIFF')
wav.writeUInt32LE(wav.length - 8, 4)
wav.write('WAVEfmt ', 8)
wav.writeUInt32LE(16, 16)
wav.writeUInt16LE(1, 20)
wav.writeUInt16LE(1, 22)
wav.writeUInt32LE(sampleRate, 24)
wav.writeUInt32LE(sampleRate * 2, 28)
wav.writeUInt16LE(2, 32)
wav.writeUInt16LE(16, 34)
wav.write('data', 36)
wav.writeUInt32LE(samples.length * 2, 40)
for (let i = 0; i < samples.length; i++)
  wav.writeInt16LE(Math.round(samples[i] * 32767), 44 + i * 2)
mkdirSync('artifacts/design', { recursive: true })
writeFileSync('artifacts/design/spectrum-source.wav', wav)
console.log(
  `Generated ${frames.length} measured frames, ${bands} logarithmic bands (30–16000 Hz), ${bpm} BPM. FFT tone check passed.`,
)
