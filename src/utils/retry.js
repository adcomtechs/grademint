/**
 * @module retry
 * @description Production-grade retry utility with exponential backoff and jitter.
 *
 * ── ALGORITHM ─────────────────────────────────────────────────────────────────
 *
 * On each failure the delay before the next attempt is computed as:
 *
 *   base = min(baseDelayMs × 2^(attempt − 1), maxDelayMs)
 *   delay = jitter ? random(0, base) : base
 *
 * The full-jitter variant (random between 0 and the capped exponential) is
 * recommended by AWS for distributed systems because it decorrelates retries
 * across multiple concurrent callers — preventing all of them from hammering
 * a recovering resource at the same instant after a shared failure.
 *
 * Reference: https://aws.amazon.com/blogs/architecture/exponential-backoff-and-jitter/
 *
 * ── RETRY PREDICATE ───────────────────────────────────────────────────────────
 *
 * The isRetryable option determines whether a given error warrants another
 * attempt. This is the most important parameter — retrying a permanent error
 * (e.g. a developer mistake, a corrupted database) wastes time and delays
 * the user's error notification.
 *
 * Default: retry all errors (appropriate only if the caller knows all errors
 * from the wrapped function are transient). Always supply a predicate for
 * production use cases.
 *
 * ── USAGE ─────────────────────────────────────────────────────────────────────
 *
 * @example
 * import { withRetry } from '@/utils/retry.js';
 *
 * const result = await withRetry(
 *   () => idb.syncSemesterDiff(diff),
 *   {
 *     maxAttempts:  3,
 *     baseDelayMs:  100,
 *     maxDelayMs:   2000,
 *     jitter:       true,
 *     isRetryable:  (err) => err instanceof StorageError && err.transient,
 *     onRetry:      (err, attempt, delayMs) => {
 *       log.warn(`Retry attempt ${attempt}`, { error: err.message, delayMs });
 *     },
 *   }
 * );
 */

// ── Types ─────────────────────────────────────────────────────────────────────

/**
 * @typedef {Object} RetryOptions
 *
 * @property {number} [maxAttempts=3]
 *   Total number of attempts (including the first). A value of 1 means no
 *   retries — the function is called exactly once.
 *
 * @property {number} [baseDelayMs=100]
 *   Delay before the first retry in milliseconds. Subsequent retries use
 *   exponential backoff: baseDelayMs × 2^(attempt − 1), capped at maxDelayMs.
 *
 * @property {number} [maxDelayMs=10000]
 *   Upper bound on the computed delay in milliseconds. Prevents the backoff
 *   from growing unboundedly on long retry sequences.
 *
 * @property {boolean} [jitter=true]
 *   When true, applies full jitter: the actual delay is random(0, computedDelay).
 *   This decorrelates concurrent retries across multiple callers.
 *   Set to false in tests or deterministic scenarios where predictable delays
 *   are required.
 *
 * @property {(error: Error) => boolean} [isRetryable]
 *   Predicate that determines whether a given error warrants a retry.
 *   Return true to retry, false to fail immediately without further attempts.
 *   Defaults to () => true (retry all errors).
 *
 * @property {(error: Error, attempt: number, delayMs: number) => void} [onRetry]
 *   Optional callback invoked before each retry. Receives the error that caused
 *   the retry, the upcoming attempt number (1-based), and the computed delay.
 *   Useful for logging or metrics without coupling retry logic to a specific
 *   logger instance.
 */

/**
 * @typedef {Object} RetryResult
 * @property {boolean} succeeded    - Whether the operation ultimately succeeded
 * @property {number}  attempts     - Total number of attempts made
 * @property {Error|null} lastError - The final error if all attempts failed
 */

// ── Core implementation ───────────────────────────────────────────────────────

/**
 * Wraps an async function with retry logic using exponential backoff and jitter.
 *
 * The wrapped function is called up to `maxAttempts` times. If all attempts
 * fail, the last error is re-thrown so the caller's catch block receives a
 * real Error rather than a wrapped or swallowed one.
 *
 * @template T
 * @param {() => Promise<T>} fn
 *   The async operation to retry. Must be a zero-argument thunk — any
 *   parameters are captured by the caller's closure. This ensures fn() can
 *   be called identically on every attempt without withRetry needing to know
 *   the operation's argument shape.
 *
 * @param {RetryOptions} [options={}]
 * @returns {Promise<T>}
 * @throws {Error} The error from the final failed attempt.
 */
export function withRetry(fn, options = {}) {
  const {
    maxAttempts = 3,
    baseDelayMs = 100,
    maxDelayMs = 10_000,
    jitter = true,
    isRetryable = () => true,
    onRetry = null,
  } = options;

  // ✅ This will now throw synchronously
  _validateOptions({ maxAttempts, baseDelayMs, maxDelayMs });

  return (async () => {
    let lastError = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await fn();
      } catch (err) {
        lastError = err;

        if (!isRetryable(err)) {
          throw err;
        }

        if (attempt === maxAttempts) {
          throw err; // ✅ original instance preserved
        }

        const delay = _computeDelay({ attempt, baseDelayMs, maxDelayMs, jitter });

        if (typeof onRetry === 'function') {
          try {
            onRetry(err, attempt + 1, delay);
          } catch (_) {
            // swallow safely
          }
        }

        await _sleep(delay);
      }
    }

    throw lastError; // safety fallback
  })();
}

// ── Convenience factory ───────────────────────────────────────────────────────

/**
 * Creates a pre-configured retry executor bound to fixed options.
 *
 * Useful when the same retry configuration is applied to multiple
 * operations in one module — define the policy once, reuse everywhere:
 *
 * @example
 * const retryPersist = createRetryPolicy({
 *   maxAttempts:  3,
 *   baseDelayMs:  150,
 *   isRetryable:  isRetryableIdbError,
 *   onRetry:      (err, attempt, ms) => log.warn('Retrying IDB', { attempt, ms }),
 * });
 *
 * await retryPersist(() => idb.syncSemesterDiff(diff));
 * await retryPersist(() => idb.putSetting('student', value));
 *
 * @param {RetryOptions} options
 * @returns {<T>(fn: () => Promise<T>) => Promise<T>}
 */
export function createRetryPolicy(options) {
  return (fn) => withRetry(fn, options);
}

// ── IDB-specific retry predicate ──────────────────────────────────────────────

/**
 * Determines whether an IndexedDB StorageError is likely transient and
 * safe to retry.
 *
 * TRANSIENT (retry):
 *   - "Transaction aborted"          — browser-initiated abort, often recovers
 *   - "QuotaExceededError"           — transient quota spikes in some browsers
 *   - "UnknownError"                 — IDB spec's catch-all for internal errors
 *
 * PERMANENT (do not retry):
 *   - "called before open()"        — developer error, will not self-correct
 *   - "DataError"                   — malformed key or value, code bug
 *   - "InvalidStateError"           — database is closing/closed permanently
 *   - "VersionError"                — schema mismatch, needs page reload
 *   - "ConstraintError"             — key uniqueness violation, data error
 *
 * This predicate is conservative — when in doubt, it does NOT retry. A false
 * negative (failing fast on a transient error) is less harmful than a false
 * positive (retrying a permanent error three times before surfacing it).
 *
 * @param {Error} err
 * @returns {boolean}
 */
export function isRetryableIdbError(err) {
  const message = err?.message ?? '';

  // Permanent: developer errors that will never self-correct
  if (message.includes('called before open()')) return false;
  if (message.includes('DataError')) return false;
  if (message.includes('InvalidStateError')) return false;
  if (message.includes('VersionError')) return false;
  if (message.includes('ConstraintError')) return false;

  // Transient: browser-initiated failures that typically recover
  if (message.includes('Transaction aborted')) return true;
  if (message.includes('QuotaExceededError')) return true;
  if (message.includes('UnknownError')) return true;
  if (message.includes('Persistence sync failed')) return true;

  // Conservative default: do not retry unknown error types.
  // It is better to surface an unfamiliar error immediately than to
  // retry it silently and delay the user's notification.
  return false;
}

// ── Private helpers ───────────────────────────────────────────────────────────

/**
 * Computes the delay for a given attempt using exponential backoff
 * with optional full jitter.
 *
 * Formula (no jitter):   min(baseDelayMs × 2^(attempt − 1), maxDelayMs)
 * Formula (with jitter): random(0, min(baseDelayMs × 2^(attempt − 1), maxDelayMs))
 *
 * @param {{ attempt: number, baseDelayMs: number, maxDelayMs: number, jitter: boolean }} p
 * @returns {number} Delay in milliseconds (always a non-negative integer)
 */
function _computeDelay({ attempt, baseDelayMs, maxDelayMs, jitter }) {
  // 2^(attempt − 1) grows as: 1, 2, 4, 8, 16 ...
  // Multiply by baseDelayMs and cap at maxDelayMs.
  const exponential = Math.min(baseDelayMs * Math.pow(2, attempt - 1), maxDelayMs);

  if (!jitter) return Math.round(exponential);

  // Full jitter: uniform random between 0 and the capped exponential.
  // This spreads retries across the full interval, preventing waves of
  // concurrent callers from all retrying at the same instant.
  return Math.round(Math.random() * exponential);
}

/**
 * Returns a Promise that resolves after `ms` milliseconds.
 * Extracted as a named function so tests can replace it via module mocking.
 *
 * @param {number} ms
 * @returns {Promise<void>}
 */
export function _sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Validates retry options and throws on clearly invalid configuration.
 * @param {{ maxAttempts: number, baseDelayMs: number, maxDelayMs: number }} opts
 */
function _validateOptions({ maxAttempts, baseDelayMs, maxDelayMs }) {
  if (!Number.isInteger(maxAttempts) || maxAttempts < 1) {
    throw new RangeError(`withRetry: maxAttempts must be a positive integer, got ${maxAttempts}`);
  }
  if (!Number.isFinite(baseDelayMs) || baseDelayMs < 0) {
    throw new RangeError(
      `withRetry: baseDelayMs must be a non-negative number, got ${baseDelayMs}`
    );
  }
  if (!Number.isFinite(maxDelayMs) || maxDelayMs < baseDelayMs) {
    throw new RangeError(
      `withRetry: maxDelayMs (${maxDelayMs}) must be >= baseDelayMs (${baseDelayMs})`
    );
  }
}
