const LEVELS = { debug: 0, info: 1, warn: 2, error: 3 };
const currentLevel = process.env.LOG_LEVEL || 'info';

function ts() {
  return new Date().toISOString();
}

function log(level, msg, meta) {
  if (LEVELS[level] < LEVELS[currentLevel]) return;
  const base = `[${ts()}] [${level.toUpperCase()}] ${msg}`;
  if (meta) {
    console.log(base, typeof meta === 'object' ? JSON.stringify(meta) : meta);
  } else {
    console.log(base);
  }
}

export const logger = {
  debug: (m, meta) => log('debug', m, meta),
  info: (m, meta) => log('info', m, meta),
  warn: (m, meta) => log('warn', m, meta),
  error: (m, meta) => log('error', m, meta),
};
