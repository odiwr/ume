import pino from 'pino'

const isDev = process.env.NODE_ENV !== 'production'

/**
 * One logger for the whole process. Pretty output in dev, JSON in production so
 * Railway / Fly log drains can index it.
 */
export const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  base: { app: 'ume-bot' },
  ...(isDev
    ? { transport: { target: 'pino-pretty', options: { colorize: true, translateTime: 'HH:MM:ss', ignore: 'pid,hostname,app' } } }
    : {}),
})

export type Logger = typeof logger
