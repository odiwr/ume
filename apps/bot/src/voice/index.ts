import type { VoiceManager } from './manager'

let instance: VoiceManager | null = null

export function setVoiceManager(v: VoiceManager): void {
  instance = v
}

export function voice(): VoiceManager {
  if (!instance) throw new Error('VoiceManager not started')
  return instance
}

export { VoiceManager } from './manager'
export * from './player'
