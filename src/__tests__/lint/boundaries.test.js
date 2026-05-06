/**
 * @file boundaries.test.js
 * @description Smoke tests confirming the ESLint boundary configuration
 * is well-formed and the plugin is registered correctly.
 *
 * These tests do NOT re-implement boundary checking — that is ESLint's job.
 * They verify:
 *   1. The ESLint config can be loaded without throwing
 *   2. The boundaries plugin appears in the loaded config
 *   3. The element type definitions match ARCHITECTURE.md expectations
 *
 * Full boundary enforcement is verified by running `pnpm lint`.
 *
 * @vitest-environment node
 */
import { describe, it, expect, beforeAll } from 'vitest';

const configPromise = import('../../../eslint.config.js');

describe('ESLint boundary configuration — structural integrity', () => {
  it('loads the ESLint config without throwing', async () => {
    await expect(configPromise).resolves.toBeDefined();
  });

  it('exports an array of config objects (flat config format)', async () => {
    const module = await configPromise;
    const config = module.default;

    expect(Array.isArray(config)).toBe(true);
    expect(config.length).toBeGreaterThan(0);
  });

  it('includes the boundaries plugin', async () => {
    const module = await configPromise;
    const config = module.default;

    const boundaryBlock = config.find((block) => block.plugins?.boundaries !== undefined);

    expect(boundaryBlock).toBeDefined();
  });

  it('declares the correct number of element types', async () => {
    const module = await configPromise;
    const config = module.default;

    const boundaryBlock = config.find((block) => block.settings?.['boundaries/elements']);

    expect(boundaryBlock).toBeDefined();

    const elements = boundaryBlock.settings['boundaries/elements'];

    expect(elements).toHaveLength(9);
  });

  it('declares all expected layer names', async () => {
    const module = await configPromise;
    const config = module.default;

    const boundaryBlock = config.find((block) => block.settings?.['boundaries/elements']);

    const types = boundaryBlock.settings['boundaries/elements'].map((e) => e.type);

    expect(types).toEqual(
      expect.arrayContaining([
        'utils',
        'config',
        'domain',
        'services',
        'core',
        'components',
        'docs',
        'styles',
        'entries',
      ])
    );
  });

  it('enables boundaries/dependencies rule', async () => {
    const module = await configPromise;
    const config = module.default;

    const boundaryBlock = config.find((block) => block.rules?.['boundaries/dependencies']);

    expect(boundaryBlock).toBeDefined();
    expect(boundaryBlock.rules['boundaries/dependencies'][0]).toBe('error');
  });

  it('declares an explicit dependency matrix', async () => {
    const module = await configPromise;
    const config = module.default;

    const boundaryBlock = config.find((block) => block.rules?.['boundaries/dependencies']);
    const matrix = boundaryBlock.rules['boundaries/dependencies'][1];

    expect(matrix.default).toBe('disallow');
    expect(matrix.rules).toHaveLength(9);
  });

  it('has a test override that disables boundary rules', async () => {
    const module = await configPromise;
    const config = module.default;

  const testOverride = config.find((block) => {
    if (!Array.isArray(block.files)) return false;

    const matchesTestPattern = block.files.some(
      (pattern) =>
        pattern.includes('__tests__') || pattern.includes('.test.') || pattern.includes('.spec.')
    );

    const disablesBoundaries =
      block.rules?.['boundaries/dependencies'] === 'off' &&
      block.rules?.['boundaries/no-unknown'] === 'off';

    return matchesTestPattern && disablesBoundaries;
  });
    expect(testOverride).toBeDefined();
  });
});
