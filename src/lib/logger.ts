type LogDetail = Record<string, unknown>

function shouldLog(): boolean {
  return import.meta.env.DEV || import.meta.env.VITE_DEBUG_LOGGING === 'true'
}

export function createLogger(scope: string) {
  const prefix = `[${scope}]`

  function write(
    level: 'info' | 'warn' | 'error',
    message: string,
    detail?: LogDetail,
  ) {
    if (!shouldLog()) {
      return
    }
    const fn = console[level]
    if (detail) {
      fn(prefix, message, detail)
    } else {
      fn(prefix, message)
    }
  }

  return {
    info: (message: string, detail?: LogDetail) => write('info', message, detail),
    warn: (message: string, detail?: LogDetail) => write('warn', message, detail),
    error: (message: string, detail?: LogDetail) => write('error', message, detail),
  }
}
