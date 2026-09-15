import pino, { type Logger } from 'pino'

/**
 * One pino logger for the process. Pretty output locally, JSON in production
 * (Railway / Fly capture stdout).
 */
export function createLogger(): Logger {
  const level = process.env.LOG_LEVEL ?? 'info'
  const pretty = process.env.NODE_ENV !== 'production' && process.stdout.isTTY
  return pino({
    level,
    base: { service: 'ume-worker' },
    ...(pretty ? { transport: { target: 'pino-pretty', options: { colorize: true, translateTime: 'HH:MM:ss' } } } : {}),
  })
}

export type { Logger }
