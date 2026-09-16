'use client'

import { useEffect, useRef } from 'react'
import spectrum from './data/demo-spectrum.json'

// Measured from an original music loop by scripts/generate-demo-spectrum.mjs.
// Precomputed FFT frames keep this silent demo lightweight and deterministic.
export function MusicSpectrum() {
  const container = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const element = container.current
    if (!element) return
    const bars = Array.from(element.children) as HTMLElement[]
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
    let visible = false
    let frameId = 0
    let previousTime: number | null = null
    let elapsed = 0

    function draw(time: number) {
      if (previousTime !== null) elapsed += time - previousTime
      previousTime = time
      const position = ((elapsed / 1000) * spectrum.fps) % spectrum.frames.length
      const index = Math.floor(position)
      const current = spectrum.frames[index]!
      const next = spectrum.frames[(index + 1) % spectrum.frames.length]!
      const blend = position - index
      bars.forEach((bar, i) => {
        const level = (current[i]! + (next[i]! - current[i]!) * blend) / 255
        bar.style.transform = `scaleY(${Math.max(0.025, level)})`
      })
      frameId = requestAnimationFrame(draw)
    }

    function updatePlayback() {
      cancelAnimationFrame(frameId)
      previousTime = null
      if (visible && !document.hidden && !reducedMotion.matches) {
        frameId = requestAnimationFrame(draw)
      }
    }

    const observer = new IntersectionObserver(([entry]) => {
      visible = entry?.isIntersecting ?? false
      updatePlayback()
    })
    observer.observe(element)
    reducedMotion.addEventListener('change', updatePlayback)
    document.addEventListener('visibilitychange', updatePlayback)
    return () => {
      cancelAnimationFrame(frameId)
      observer.disconnect()
      reducedMotion.removeEventListener('change', updatePlayback)
      document.removeEventListener('visibilitychange', updatePlayback)
    }
  }, [])

  return (
    <div
      ref={container}
      className="spectrum mt-6 flex h-24 items-end justify-between gap-[3px] sm:gap-1"
      aria-hidden
    >
      {spectrum.frames[0]!.map((level, i) => (
        <span
          key={i}
          className="spectrum-bar"
          style={{ transform: `scaleY(${Math.max(0.025, level / 255)})` }}
        />
      ))}
    </div>
  )
}
