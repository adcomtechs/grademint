/**
 * @module logger
 * @description Centralised, namespaced, environment-aware logging system.
 *
 * ── USAGE ─────────────────────────────────────────────────────────────────────
 *
 * Each module creates one logger instance at module scope:
 *
 *   import { createLogger } from '@/utils/logger.js';
 *   const log = createLogger('Bootstrap');
 *
 *   log.debug('Store hydrated', { semesterCount: 4 });
 *   log.info('IDB opened successfully');
 *   log.warn('Storage quota low', { used: '48MB' });
 *   log.error('Sync failed', err);
 *
 * ── LOG LEVELS ────────────────────────────────────────────────────────────────
 *
 *   DEBUG  — Fine-grained diagnostic detail. Dev only.
 *   INFO   — Significant lifecycle events. Dev only by default.
 *   WARN   — Recoverable problems. Emitted in all environments.
 *   ERROR  — Failures that affect user-visible behaviour. Always emitted.
 *
 * ── ENVIRONMENT BEHAVIOUR ─────────────────────────────────────────────────────
 *
 *   Development  (import.meta.env.DEV):  DEBUG and above
 *   Production   (import.meta.env.PROD): WARN and above
 *
 *   The minimum level is configurable at runtime via LoggerConfig.setLevel(),
 *   which is useful for enabling verbose logging in a production debugging
 *   session without a rebuild.
 *
 * ── MONITORING INTEGRATION ────────────────────────────────────────────────────
 *
 *   Register a reporter to forward errors to an external service:
 *
 *   import { LoggerConfig } from '@/utils/logger.js';
 *   LoggerConfig.setReporter((entry) => Sentry.captureException(entry.error));
 *
 *   The reporter receives every LogEntry at ERROR level (and WARN if configured).
 *   It is called after the console output, never before — logging to console
 *   never depends on the reporter being available.
 *
 * ── DESIGN DECISIONS ──────────────────────────────────────────────────────────
 *
 *   1. No singleton logger — each module owns its namespace. This makes
 *      log output self-identifying and enables per-namespace level filtering
 *      in future iterations without changing call sites.
 *
 *   2. Context is a plain object (not a string) — it is logged as structured
 *      data in development (console.group + table) and serialised for reporters.
 *      String interpolation loses structure; object context preserves it.
 *
 *   3. The reporter is optional — the logger works correctly with no reporter.
 *      Missing reporter = no error, no warning, no side effect.
 *
 *   4. Tree-shaking: in production builds, DEBUG and INFO calls whose log
 *      level is below the minimum are gated by a numeric comparison.
 *      Vite's rollup step cannot eliminate the function calls entirely
 *      (they are runtime-gated, not compile-time constants), but the
 *      bodies of those calls — including any context object construction —
 *      are never executed. Callers should not construct expensive context
 *      objects inline for DEBUG calls in hot paths.
 */

// ── Log Level Definitions ─────────────────────────────────────────────────────

/**
 * Numeric priority values for log levels.
 * Higher number = higher severity = more likely to be shown.
 * @readonly
 * @enum {number}
 */
export const LogLevel = Object.freeze({
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
  SILENT: 4, // disables all output — useful in test suites
});

/** Human-readable labels for each level. @type {Record<number, string>} */
const LEVEL_LABELS = Object.freeze({
  [LogLevel.DEBUG]: 'DEBUG',
  [LogLevel.INFO]: 'INFO',
  [LogLevel.WARN]: 'WARN',
  [LogLevel.ERROR]: 'ERROR',
});

/** Console method to use for each level. @type {Record<number, string>} */
const LEVEL_METHODS = Object.freeze({
  [LogLevel.DEBUG]: 'debug',
  [LogLevel.INFO]: 'info',
  [LogLevel.WARN]: 'warn',
  [LogLevel.ERROR]: 'error',
});

// ── LogEntry type ──────────────────────────────────────────────────────────────

/**
 * Structured log record passed to reporters and used internally.
 *
 * @typedef {Object} LogEntry
 * @property {number}      level     - Numeric log level (LogLevel enum value)
 * @property {string}      levelName - Human-readable level name
 * @property {string}      namespace - Module name that created the logger
 * @property {string}      message   - Human-readable description
 * @property {object|null} context   - Structured supplementary data (or null)
 * @property {Error|null}  error     - The original Error instance (or null)
 * @property {number}      timestamp - Unix timestamp (ms) when logged
 */

// ── LoggerConfig — global configuration singleton ─────────────────────────────

/**
 * Global logger configuration.
 * Mutated at most twice per application lifetime:
 *   1. Once on boot (setLevel called by the entry point)
 *   2. Once if a monitoring reporter is registered
 *
 * All Logger instances read from this object — changing the level here
 * immediately affects all active loggers without requiring re-instantiation.
 */
export const LoggerConfig = Object.seal({
  /**
   * Minimum level for output. Messages below this level are silently dropped.
   * Defaults to DEBUG in development, WARN in production.
   * @type {number}
   */
  minLevel: _defaultMinLevel(),

  /**
   * Optional external reporter function.
   * Receives every LogEntry that meets the minLevel threshold.
   * Called after console output — never blocks logging.
   * @type {((entry: LogEntry) => void) | null}
   */
  reporter: null,

  /**
   * Sets the minimum log level.
   * @param {number} level - A LogLevel enum value
   */
  setLevel(level) {
    if (!Object.values(LogLevel).includes(level)) {
      console.warn(`[LoggerConfig] Unknown log level: ${level}`);
      return;
    }
    this.minLevel = level;
  },

  /**
   * Registers an external error reporter.
   *
   * The reporter is called for every log entry at or above minLevel.
   * It receives a LogEntry object. Errors thrown inside the reporter
   * are caught and logged to console.error — the reporter must never
   * crash the application.
   *
   * @param {(entry: LogEntry) => void} fn
   */
  setReporter(fn) {
    if (typeof fn !== 'function') {
      console.warn('[LoggerConfig] Reporter must be a function.');
      return;
    }
    this.reporter = fn;
  },

  /** Resets configuration to defaults. Primarily used in tests. */
  reset() {
    this.minLevel = _defaultMinLevel();
    this.reporter = null;
  },
});

/**
 * Resolves the default minimum log level from the build environment.
 * @returns {number}
 */
function _defaultMinLevel() {
  // import.meta.env is injected by Vite.
  // In tests (vitest), import.meta.env.DEV is true by default.
  // In production builds, import.meta.env.PROD is true and DEV is false.
  try {
    return import.meta.env?.PROD === true ? LogLevel.WARN : LogLevel.DEBUG;
  } catch {
    // import.meta.env unavailable (e.g. running directly in Node without Vite)
    return LogLevel.DEBUG;
  }
}

// ── Logger class ──────────────────────────────────────────────────────────────

/**
 * Namespaced logger instance.
 * Create via createLogger() — do not instantiate directly.
 */
class Logger {
  /**
   * @param {string} namespace - Module or component name for log identification
   */
  constructor(namespace) {
    if (!namespace || typeof namespace !== 'string') {
      throw new TypeError('Logger: namespace must be a non-empty string.');
    }
    /** @type {string} */
    this.namespace = namespace;
  }

  // ── Public logging methods ─────────────────────────────────────────────────

  /**
   * Fine-grained diagnostic information.
   * Shown in development only (default). Never sent to reporters.
   *
   * @param {string}  message
   * @param {object}  [context]
   */
  debug(message, context) {
    this._emit(LogLevel.DEBUG, message, context ?? null, null);
  }

  /**
   * Significant application lifecycle events.
   * Shown in development only (default).
   *
   * @param {string}  message
   * @param {object}  [context]
   */
  info(message, context) {
    this._emit(LogLevel.INFO, message, context ?? null, null);
  }

  /**
   * Recoverable problems — the operation completed but in a degraded state.
   * Shown in all environments. Forwarded to reporter if registered.
   *
   * @param {string}       message
   * @param {object|Error} [contextOrError]
   */
  warn(message, contextOrError) {
    const { context, error } = _splitContextOrError(contextOrError);
    this._emit(LogLevel.WARN, message, context, error);
  }

  /**
   * Failures that affect user-visible behaviour.
   * Always shown. Always forwarded to reporter if registered.
   *
   * @param {string}  message
   * @param {Error|object} [errorOrContext] - Preferably an Error instance
   * @param {object}  [context]            - Additional structured data
   */
  error(message, errorOrContext, context) {
    // Overload: error(msg, err) or error(msg, err, context) or error(msg, context)
    let resolvedError = null;
    let resolvedContext = null;

    if (errorOrContext instanceof Error) {
      resolvedError = errorOrContext;
      resolvedContext = context ?? null;
    } else if (errorOrContext && typeof errorOrContext === 'object') {
      resolvedContext = errorOrContext;
    }

    this._emit(LogLevel.ERROR, message, resolvedContext, resolvedError);
  }

  // ── Private ────────────────────────────────────────────────────────────────

  /**
   * Core emit — builds the LogEntry, checks the level gate, writes to
   * console, and calls the reporter.
   *
   * @param {number}      level
   * @param {string}      message
   * @param {object|null} context
   * @param {Error|null}  error
   */
  _emit(level, message, context, error) {
    // Level gate — drop messages below the configured minimum.
    if (level < LoggerConfig.minLevel) return;

    /** @type {LogEntry} */
    const entry = {
      level,
      levelName: LEVEL_LABELS[level],
      namespace: this.namespace,
      message,
      context,
      error: error ?? null,
      timestamp: Date.now(),
    };

    // ── Console output ───────────────────────────────────────────────────────
    this._writeToConsole(entry);

    // ── Reporter ─────────────────────────────────────────────────────────────
    // Only forward WARN and ERROR to the reporter — DEBUG and INFO are
    // diagnostic noise that external services do not need.
    if (LoggerConfig.reporter && level >= LogLevel.WARN) {
      try {
        LoggerConfig.reporter(entry);
      } catch (reporterErr) {
        // The reporter must never crash the application.
        // Use raw console.error to avoid infinite recursion through Logger.
        console.error('[Logger] Reporter threw an error:', reporterErr);
      }
    }
  }

  /**
   * Formats and writes a LogEntry to the appropriate console method.
   *
   * Development: rich output with namespace prefix, context object,
   *              and full error stack.
   * Production:  concise single-line output — just the message and
   *              essential context, no stack traces.
   *
   * @param {LogEntry} entry
   */
  _writeToConsole(entry) {
    const method = LEVEL_METHODS[entry.level] ?? 'log';
    const prefix = `[${entry.namespace}]`;

    if (import.meta.env?.DEV !== false) {
      // ── Development: rich, structured output ──────────────────────────────
      if (entry.error) {
        console[method](`${prefix} ${entry.message}`, entry.error);
        if (entry.context) {
          console[method](`${prefix} Context:`, entry.context);
        }
      } else if (entry.context) {
        console[method](`${prefix} ${entry.message}`, entry.context);
      } else {
        console[method](`${prefix} ${entry.message}`);
      }
    } else {
      // ── Production: concise, no stack traces ──────────────────────────────
      // Stack traces expose internal implementation details to end users
      // via the browser console. In production we log the message and
      // the error message (not stack), nothing more.
      const errorSuffix = entry.error ? ` — ${entry.error.message}` : '';
      console[method](`${prefix} ${entry.message}${errorSuffix}`);
    }
  }
}

// ── Public factory ────────────────────────────────────────────────────────────

/**
 * Creates a namespaced Logger instance for a module.
 *
 * Call once at module scope — not inside functions or classes.
 * The namespace should be the module's logical name (not the file path).
 *
 * @example
 * // At the top of any module file:
 * const log = createLogger('IndexedDBService');
 * log.error('Connection failed', err, { dbName: DB_CONFIG.name });
 *
 * @param {string} namespace
 * @returns {Logger}
 */
export function createLogger(namespace) {
  return new Logger(namespace);
}

// ── Private helpers ───────────────────────────────────────────────────────────

/**
 * Splits an argument that may be either a context object or an Error
 * into separate typed fields.
 *
 * @param {object|Error|undefined} value
 * @returns {{ context: object|null, error: Error|null }}
 */
function _splitContextOrError(value) {
  if (!value) return { context: null, error: null };
  if (value instanceof Error) return { context: null, error: value };
  return { context: value, error: null };
}
