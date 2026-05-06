/**
 * @file logger.test.js
 * @description Unit tests for the Logger utility.
 *
 * Tests cover:
 *   1. Level gating — messages below minLevel are suppressed
 *   2. Console method routing — each level uses the correct console method
 *   3. Namespace output — messages include the module namespace
 *   4. Reporter integration — reporter is called for WARN and ERROR
 *   5. Reporter isolation — a throwing reporter does not crash the logger
 *   6. LoggerConfig.setLevel — dynamically adjusts the minimum level
 *   7. LoggerConfig.setReporter — rejects non-function values
 *   8. createLogger — rejects invalid namespaces
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createLogger, LoggerConfig, LogLevel } from '@/utils/logger.js';

// ── Setup: spy on console methods ─────────────────────────────────────────────

let spies = {};

beforeEach(() => {
  // Reset config to known defaults before each test
  LoggerConfig.reset();
  // Force DEBUG level so all messages are visible regardless of environment
  LoggerConfig.setLevel(LogLevel.DEBUG);

  spies = {
    debug: vi.spyOn(console, 'debug').mockImplementation(() => {}),
    info: vi.spyOn(console, 'info').mockImplementation(() => {}),
    warn: vi.spyOn(console, 'warn').mockImplementation(() => {}),
    error: vi.spyOn(console, 'error').mockImplementation(() => {}),
  };
});

afterEach(() => {
  vi.restoreAllMocks();
  LoggerConfig.reset();
});

// ── createLogger factory ──────────────────────────────────────────────────────

describe('createLogger', () => {
  it('creates a logger with the given namespace', () => {
    const log = createLogger('TestModule');
    expect(log.namespace).toBe('TestModule');
  });

  it('throws when namespace is empty', () => {
    expect(() => createLogger('')).toThrow(TypeError);
  });

  it('throws when namespace is not a string', () => {
    expect(() => createLogger(42)).toThrow(TypeError);
  });

  it('creates independent instances for different namespaces', () => {
    const logA = createLogger('ModuleA');
    const logB = createLogger('ModuleB');
    expect(logA.namespace).not.toBe(logB.namespace);
  });
});

// ── Log level routing ─────────────────────────────────────────────────────────

describe('Logger — console method routing', () => {
  const log = createLogger('Router');

  it('routes debug() to console.debug', () => {
    log.debug('test');
    expect(spies.debug).toHaveBeenCalledOnce();
  });

  it('routes info() to console.info', () => {
    log.info('test');
    expect(spies.info).toHaveBeenCalledOnce();
  });

  it('routes warn() to console.warn', () => {
    log.warn('test');
    expect(spies.warn).toHaveBeenCalledOnce();
  });

  it('routes error() to console.error', () => {
    log.error('test');
    expect(spies.error).toHaveBeenCalledOnce();
  });
});

// ── Level gating ──────────────────────────────────────────────────────────────

describe('Logger — level gating', () => {
  it('suppresses messages below the configured minLevel', () => {
    LoggerConfig.setLevel(LogLevel.WARN);
    const log = createLogger('GatingTest');

    log.debug('suppressed');
    log.info('suppressed');
    log.warn('shown');
    log.error('shown');

    expect(spies.debug).not.toHaveBeenCalled();
    expect(spies.info).not.toHaveBeenCalled();
    expect(spies.warn).toHaveBeenCalledOnce();
    expect(spies.error).toHaveBeenCalledOnce();
  });

  it('shows all messages when minLevel is DEBUG', () => {
    LoggerConfig.setLevel(LogLevel.DEBUG);
    const log = createLogger('GatingTest');

    log.debug('d');
    log.info('i');
    log.warn('w');
    log.error('e');

    expect(spies.debug).toHaveBeenCalledOnce();
    expect(spies.info).toHaveBeenCalledOnce();
    expect(spies.warn).toHaveBeenCalledOnce();
    expect(spies.error).toHaveBeenCalledOnce();
  });

  it('suppresses ALL messages when minLevel is SILENT', () => {
    LoggerConfig.setLevel(LogLevel.SILENT);
    const log = createLogger('SilentTest');

    log.debug('d');
    log.info('i');
    log.warn('w');
    log.error('e');

    expect(spies.debug).not.toHaveBeenCalled();
    expect(spies.info).not.toHaveBeenCalled();
    expect(spies.warn).not.toHaveBeenCalled();
    expect(spies.error).not.toHaveBeenCalled();
  });
});

// ── Namespace prefix ──────────────────────────────────────────────────────────

describe('Logger — namespace in output', () => {
  it('includes the namespace in the console output', () => {
    const log = createLogger('MyNamespace');
    log.warn('something happened');

    const [firstArg] = spies.warn.mock.calls[0];
    expect(firstArg).toContain('MyNamespace');
  });

  it('includes the message in the console output', () => {
    const log = createLogger('NS');
    log.error('critical failure');

    const [firstArg] = spies.error.mock.calls[0];
    expect(firstArg).toContain('critical failure');
  });
});

// ── Context and Error objects ─────────────────────────────────────────────────

describe('Logger — context and error handling', () => {
  it('passes the Error object as a console argument when provided', () => {
    const log = createLogger('ErrTest');
    const err = new Error('boom');
    log.error('failed', err);

    // The Error instance should appear somewhere in the console.error arguments
    const allArgs = spies.error.mock.calls[0];
    expect(allArgs).toContain(err);
  });

  it('passes context object to console when provided', () => {
    const log = createLogger('CtxTest');
    const context = { userId: 42, action: 'SAVE' };
    log.warn('slow operation', context);

    const allArgs = spies.warn.mock.calls[0];
    expect(allArgs).toContain(context);
  });

  it('error() with non-Error object treats it as context', () => {
    const log = createLogger('CtxTest');
    log.error('failed', { code: 500 });

    // Should not throw — contextOrError is handled gracefully
    expect(spies.error).toHaveBeenCalledOnce();
  });
});

// ── Reporter integration ──────────────────────────────────────────────────────

describe('Logger — reporter', () => {
  it('calls the reporter for WARN messages', () => {
    const reporter = vi.fn();
    LoggerConfig.setReporter(reporter);

    const log = createLogger('ReporterTest');
    log.warn('something degraded');

    expect(reporter).toHaveBeenCalledOnce();
  });

  it('calls the reporter for ERROR messages', () => {
    const reporter = vi.fn();
    LoggerConfig.setReporter(reporter);

    const log = createLogger('ReporterTest');
    log.error('critical failure');

    expect(reporter).toHaveBeenCalledOnce();
  });

  it('does NOT call the reporter for DEBUG messages', () => {
    const reporter = vi.fn();
    LoggerConfig.setReporter(reporter);

    const log = createLogger('ReporterTest');
    log.debug('verbose detail');

    expect(reporter).not.toHaveBeenCalled();
  });

  it('does NOT call the reporter for INFO messages', () => {
    const reporter = vi.fn();
    LoggerConfig.setReporter(reporter);

    const log = createLogger('ReporterTest');
    log.info('lifecycle event');

    expect(reporter).not.toHaveBeenCalled();
  });

  it('passes a well-formed LogEntry to the reporter', () => {
    const reporter = vi.fn();
    LoggerConfig.setReporter(reporter);

    const log = createLogger('EntryTest');
    const err = new Error('test error');
    log.error('test message', err, { key: 'value' });

    const entry = reporter.mock.calls[0][0];
    expect(entry).toMatchObject({
      levelName: 'ERROR',
      namespace: 'EntryTest',
      message: 'test message',
      error: err,
      context: { key: 'value' },
    });
    expect(typeof entry.timestamp).toBe('number');
  });

  it('does not crash the logger when the reporter throws', () => {
    LoggerConfig.setReporter(() => {
      throw new Error('reporter exploded');
    });

    const log = createLogger('SafeTest');

    // The logger must not propagate the reporter's exception
    expect(() => log.error('test')).not.toThrow();

    // The original message should still have been logged to console
    expect(spies.error).toHaveBeenCalled();
  });

  it('does not forward to reporter when none is registered', () => {
    // No reporter set — should not throw
    const log = createLogger('NoReporterTest');
    expect(() => log.error('test')).not.toThrow();
  });
});

// ── LoggerConfig ──────────────────────────────────────────────────────────────

describe('LoggerConfig', () => {
  it('setLevel rejects unknown level values', () => {
    LoggerConfig.setLevel(999);
    // Should warn via console.warn but not throw
    expect(spies.warn).toHaveBeenCalled();
    // minLevel should remain unchanged
    expect(LoggerConfig.minLevel).toBe(LogLevel.DEBUG);
  });

  it('setReporter rejects non-function values', () => {
    LoggerConfig.setReporter('not a function');
    expect(spies.warn).toHaveBeenCalled();
    expect(LoggerConfig.reporter).toBeNull();
  });

  it('reset() restores minLevel and clears reporter', () => {
    LoggerConfig.setLevel(LogLevel.SILENT);
    LoggerConfig.setReporter(() => {});

    LoggerConfig.reset();

    expect(LoggerConfig.reporter).toBeNull();
    // After reset, minLevel returns to the environment default
    // In test environment (DEV), that is DEBUG
    expect(LoggerConfig.minLevel).toBe(LogLevel.DEBUG);
  });
});

// ── setLevel dynamically affects active loggers ───────────────────────────────

describe('Logger — dynamic level changes', () => {
  it('respects a level change made after logger creation', () => {
    const log = createLogger('DynamicTest');

    // Start at DEBUG — debug messages show
    log.debug('visible');
    expect(spies.debug).toHaveBeenCalledOnce();

    spies.debug.mockClear();

    // Elevate to WARN — debug messages now suppressed
    LoggerConfig.setLevel(LogLevel.WARN);
    log.debug('suppressed');
    expect(spies.debug).not.toHaveBeenCalled();
  });
});
