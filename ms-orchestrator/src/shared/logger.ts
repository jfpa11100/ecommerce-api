type LogFields = Record<string, unknown>;

function log(level: 'info' | 'warn' | 'error', message: string, fields: LogFields = {}): void {
  console.log(JSON.stringify({
    level,
    message,
    timestamp: new Date().toISOString(),
    ...fields,
  }));
}

export const logger = {
  info: (message: string, fields?: LogFields) => log('info', message, fields),
  warn: (message: string, fields?: LogFields) => log('warn', message, fields),
  error: (message: string, fields?: LogFields) => log('error', message, fields),
};
