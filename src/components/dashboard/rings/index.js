/**
 * @module rings/index
 * @description Barrel export for the rings module.
 *
 * Any file that previously imported GPARings from its old flat location:
 *   import { GPARings } from '../components/dashboard/GPARings.js';
 *
 * can continue to do so without change if you move GPARings.js here and
 * place this index at the original path, or update imports to:
 *   import { GPARings } from '../components/dashboard/rings/index.js';
 *
 * Individual renderers are also exported for direct use in tests or
 * future components that need to render a specific sub-section.
 */

export { GPARings } from './GPARings.js';

// Renderers — exported for testability
export { animateRing, setText, setHidden } from './RingAnimator.js';
export { renderIdentity } from './IdentityRenderer.js';
export { renderNudge, removeNudge } from './NudgeRenderer.js';
export { renderEmptyHeroState } from './EmptyHeroState.js';
export { renderSparkline } from './SparklineRenderer.js';
export { renderTierProgress } from './TierProgressRenderer.js';
export { renderFooter } from './FooterRenderer.js';
export { renderOverviewMode } from './OverviewMode.js';
export { renderSemesterMode } from './SemesterMode.js';
