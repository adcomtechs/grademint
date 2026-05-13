/**
 * @file retry.test.js
 * @description Unit tests for withRetry, createRetryPolicy, and isRetryableIdbError.
 *
 * TIMER STRATEGY:
 * All tests use vi.useFakeTimers() so that delay behaviour is verified
 * without real waiting. vi.runAllTimersAsync() advances fake timers and
 * flushes the microtask queue in one call, allowing async/await code
 * that relies on setTimeout to complete synchronously in tests.
 *
 * _sleep is part of the public module surface (exported) precisely so
 * that tests can confirm that delays are actually requested — the call
 * to setTimeout is observable through the fake timer infrastructure.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { withRetry, createRetryPolicy, isRetryableIdbError, _sleep } from '@/utils/retry.js';

import { LoggerConfig, LogLevel } from '@/utils/logger.js';

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.useFakeTimers();
  LoggerConfig.setLevel(LogLevel.SILENT);
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  LoggerConfig.reset();
});

// ── Helper: builds a function that fails N times then succeeds ────────────────

function failNTimes(n, error = new Error('transient')) {
  let calls = 0;
  return vi.fn(async () => {
    if (++calls <= n) throw error;
    return `success-on-attempt-${calls}`;
  });
}

// ── Helper: advances fake timers and drains the microtask queue ───────────────
// vi.runAllTimersAsync() handles both timers AND promises in the queue,
// which is required for async functions that await _sleep().

async function drainTimers() {
  await vi.runAllTimersAsync();
}

// ═════════════════════════════════════════════════════════════════════════════
// withRetry — success paths
// ═════════════════════════════════════════════════════════════════════════════

describe('withRetry — succeeds on first attempt', () => {
  it('returns the resolved value immediately', async () => {
    const fn = vi.fn().mockResolvedValue('ok');
    const result = await withRetry(fn, { maxAttempts: 3, baseDelayMs: 100, maxDelayMs: 1000 });

    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledOnce();
  });

  it('does not invoke onRetry when the first attempt succeeds', async () => {
    const onRetry = vi.fn();
    const fn = vi.fn().mockResolvedValue('ok');

    await withRetry(fn, { maxAttempts: 3, baseDelayMs: 100, maxDelayMs: 1000, onRetry });

    expect(onRetry).not.toHaveBeenCalled();
  });
});

describe('withRetry — succeeds after retries', () => {
  it('returns the value when the operation succeeds on the second attempt', async () => {
    const fn = failNTimes(1);

    const promise = withRetry(fn, {
      maxAttempts: 3,
      baseDelayMs: 100,
      maxDelayMs: 1000,
      jitter: false, // deterministic for assertions
    });

    await drainTimers();
    const result = await promise;

    expect(result).toBe('success-on-attempt-2');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('retries exactly maxAttempts − 1 times before succeeding', async () => {
    const fn = failNTimes(2); // fails twice, succeeds on attempt 3

    const promise = withRetry(fn, {
      maxAttempts: 3,
      baseDelayMs: 50,
      maxDelayMs: 500,
      jitter: false,
    });

    await drainTimers();
    await promise;

    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('invokes onRetry once per failure with correct attempt number', async () => {
    const onRetry = vi.fn();
    const fn = failNTimes(2);

    const promise = withRetry(fn, {
      maxAttempts: 3,
      baseDelayMs: 50,
      maxDelayMs: 500,
      jitter: false,
      onRetry,
    });

    await drainTimers();
    await promise;

    // onRetry is called for attempt 1 failure (announcing attempt 2)
    // and attempt 2 failure (announcing attempt 3)
    expect(onRetry).toHaveBeenCalledTimes(2);
    expect(onRetry.mock.calls[0][1]).toBe(2); // next attempt = 2
    expect(onRetry.mock.calls[1][1]).toBe(3); // next attempt = 3
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// withRetry — failure paths
// ═════════════════════════════════════════════════════════════════════════════
describe('withRetry — exhausts all attempts', () => {
  it('throws the last error after all attempts fail', async () => {
    const error = new Error('persistent failure');
    const fn = vi.fn().mockRejectedValue(error);

    const promise = withRetry(fn, {
      maxAttempts: 3,
      baseDelayMs: 50,
      maxDelayMs: 200,
      jitter: false,
    });

    const assertion = expect(promise).rejects.toThrow('persistent failure');
    await drainTimers();
    await assertion;
  });

  it('throws the original error instance, not a wrapper', async () => {
    class CustomError extends Error {}
    const original = new CustomError('original');
    const fn = vi.fn().mockRejectedValue(original);

    const promise = withRetry(fn, {
      maxAttempts: 2,
      baseDelayMs: 50,
      maxDelayMs: 200,
      jitter: false,
    });

    const assertion = expect(promise).rejects.toBe(original);
    await drainTimers();
    await assertion;
  });
});

describe('withRetry — non-retryable errors', () => {
  it('throws immediately without retrying when isRetryable returns false', async () => {
    const error = new Error('permanent');
    const fn = vi.fn().mockRejectedValue(error);

    const promise = withRetry(fn, {
      maxAttempts: 3,
      baseDelayMs: 50,
      maxDelayMs: 200,
      jitter: false,
      isRetryable: () => false,
    });

    // No need to advance timers — should reject immediately
    await expect(promise).rejects.toThrow('permanent');
    expect(fn).toHaveBeenCalledOnce(); // called once, not three times
  });

  it('does not invoke onRetry for non-retryable errors', async () => {
    const onRetry = vi.fn();
    const fn = vi.fn().mockRejectedValue(new Error('permanent'));

    const promise = withRetry(fn, {
      maxAttempts: 3,
      baseDelayMs: 50,
      maxDelayMs: 200,
      jitter: false,
      isRetryable: () => false,
      onRetry,
    });

    await expect(promise).rejects.toThrow();
    expect(onRetry).not.toHaveBeenCalled();
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// withRetry — maxAttempts = 1 (no retries)
// ═════════════════════════════════════════════════════════════════════════════

describe('withRetry — maxAttempts = 1', () => {
  it('calls the function exactly once and throws on failure', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('fail'));

    await expect(
      withRetry(fn, { maxAttempts: 1, baseDelayMs: 100, maxDelayMs: 1000 })
    ).rejects.toThrow('fail');

    expect(fn).toHaveBeenCalledOnce();
  });

  it('does not sleep when maxAttempts = 1', async () => {
    const sleepSpy = vi.spyOn(await import('@/utils/retry.js'), '_sleep');
    const fn = vi.fn().mockRejectedValue(new Error('fail'));

    await expect(
      withRetry(fn, { maxAttempts: 1, baseDelayMs: 100, maxDelayMs: 1000 })
    ).rejects.toThrow();

    expect(sleepSpy).not.toHaveBeenCalled();
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// withRetry — backoff delay computation
// ═════════════════════════════════════════════════════════════════════════════

describe('withRetry — exponential backoff (jitter disabled)', () => {
  it('requests the correct delay for each attempt', async () => {
    const delays = [];
    const onRetry = (_err, _attempt, delayMs) => delays.push(delayMs);
    const fn = failNTimes(3);

    const promise = withRetry(fn, {
      maxAttempts: 4,
      baseDelayMs: 100,
      maxDelayMs: 10_000,
      jitter: false,
      onRetry,
    });

    await drainTimers();
    await promise;

    // attempt 1 → delay = min(100 × 2^0, 10000) = 100
    // attempt 2 → delay = min(100 × 2^1, 10000) = 200
    // attempt 3 → delay = min(100 × 2^2, 10000) = 400
    expect(delays).toEqual([100, 200, 400]);
  });

  it('caps the delay at maxDelayMs', async () => {
    const delays = [];
    const onRetry = (_err, _attempt, delayMs) => delays.push(delayMs);
    const fn = failNTimes(4);

    const promise = withRetry(fn, {
      maxAttempts: 5,
      baseDelayMs: 1000,
      maxDelayMs: 2000, // cap at 2000
      jitter: false,
      onRetry,
    });

    await drainTimers();
    await promise;

    // attempt 1 → min(1000 × 1, 2000) = 1000
    // attempt 2 → min(1000 × 2, 2000) = 2000
    // attempt 3 → min(1000 × 4, 2000) = 2000  ← capped
    // attempt 4 → min(1000 × 8, 2000) = 2000  ← capped
    expect(delays).toEqual([1000, 2000, 2000, 2000]);
  });
});

describe('withRetry — jitter', () => {
  it('produces a delay between 0 and the capped exponential when jitter is enabled', async () => {
    const delays = [];
    const onRetry = (_err, _attempt, delayMs) => delays.push(delayMs);
    const fn = failNTimes(1);

    const promise = withRetry(fn, {
      maxAttempts: 2,
      baseDelayMs: 1000,
      maxDelayMs: 5000,
      jitter: true, // enabled
      onRetry,
    });

    await drainTimers();
    await promise;

    expect(delays).toHaveLength(1);
    expect(delays[0]).toBeGreaterThanOrEqual(0);
    expect(delays[0]).toBeLessThanOrEqual(1000); // capped exponential for attempt 1
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// withRetry — option validation
// ═════════════════════════════════════════════════════════════════════════════

describe('withRetry — option validation', () => {
  it('throws RangeError when maxAttempts is 0', () => {
    expect(() =>
      withRetry(vi.fn(), { maxAttempts: 0, baseDelayMs: 100, maxDelayMs: 1000 })
    ).toThrow(RangeError);
  });

  it('throws RangeError when maxAttempts is not an integer', () => {
    expect(() =>
      withRetry(vi.fn(), { maxAttempts: 1.5, baseDelayMs: 100, maxDelayMs: 1000 })
    ).toThrow(RangeError);
  });

  it('throws RangeError when baseDelayMs is negative', () => {
    expect(() => withRetry(vi.fn(), { maxAttempts: 3, baseDelayMs: -1, maxDelayMs: 1000 })).toThrow(
      RangeError
    );
  });

  it('throws RangeError when maxDelayMs is less than baseDelayMs', () => {
    expect(() => withRetry(vi.fn(), { maxAttempts: 3, baseDelayMs: 500, maxDelayMs: 100 })).toThrow(
      RangeError
    );
  });

  it('accepts baseDelayMs = 0 (immediate retry, no delay)', async () => {
    const fn = failNTimes(1);

    const promise = withRetry(fn, {
      maxAttempts: 2,
      baseDelayMs: 0,
      maxDelayMs: 0,
      jitter: false,
    });

    await drainTimers();
    await expect(promise).resolves.toBeDefined();
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// withRetry — onRetry callback resilience
// ═════════════════════════════════════════════════════════════════════════════

describe('withRetry — onRetry callback resilience', () => {
  it('does not crash the retry loop when onRetry throws', async () => {
    const fn = failNTimes(1);

    const promise = withRetry(fn, {
      maxAttempts: 2,
      baseDelayMs: 50,
      maxDelayMs: 200,
      jitter: false,
      onRetry: () => {
        throw new Error('callback exploded');
      },
    });

    await drainTimers();
    // The retry should still succeed despite the broken callback
    await expect(promise).resolves.toBeDefined();
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// createRetryPolicy
// ═════════════════════════════════════════════════════════════════════════════

describe('createRetryPolicy', () => {
  it('returns a function that wraps operations with the bound options', async () => {
    const policy = createRetryPolicy({
      maxAttempts: 3,
      baseDelayMs: 50,
      maxDelayMs: 500,
      jitter: false,
    });

    const fn = failNTimes(1);

    const promise = policy(fn);
    await drainTimers();
    const result = await promise;

    expect(result).toBe('success-on-attempt-2');
  });

  it('can wrap multiple different operations with the same policy', async () => {
    const policy = createRetryPolicy({
      maxAttempts: 2,
      baseDelayMs: 50,
      maxDelayMs: 200,
      jitter: false,
    });

    const fnA = vi.fn().mockResolvedValue('A');
    const fnB = vi.fn().mockResolvedValue('B');

    const [a, b] = await Promise.all([policy(fnA), policy(fnB)]);

    expect(a).toBe('A');
    expect(b).toBe('B');
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// isRetryableIdbError
// ═════════════════════════════════════════════════════════════════════════════

describe('isRetryableIdbError', () => {
  // Errors that SHOULD be retried
  const retryableCases = [
    'Transaction aborted',
    'Transaction aborted: quota exceeded',
    'QuotaExceededError: storage is full',
    'UnknownError: internal IDB error',
    'Persistence sync failed',
  ];

  retryableCases.forEach((message) => {
    it(`returns true for: "${message}"`, () => {
      expect(isRetryableIdbError(new Error(message))).toBe(true);
    });
  });

  // Errors that should NOT be retried
  const permanentCases = [
    'putSemester() called before open() completed',
    'DataError: key path mismatch',
    'InvalidStateError: database is closing',
    'VersionError: schema mismatch',
    'ConstraintError: key already exists',
  ];

  permanentCases.forEach((message) => {
    it(`returns false for: "${message}"`, () => {
      expect(isRetryableIdbError(new Error(message))).toBe(false);
    });
  });

  it('returns false for unknown error messages (conservative default)', () => {
    expect(isRetryableIdbError(new Error('some exotic IDB error'))).toBe(false);
  });

  it('handles null/undefined gracefully without throwing', () => {
    expect(isRetryableIdbError(null)).toBe(false);
    expect(isRetryableIdbError(undefined)).toBe(false);
    expect(isRetryableIdbError({})).toBe(false);
  });
});
