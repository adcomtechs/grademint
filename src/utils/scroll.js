// src/utils/scroll.js

/**
 * Scrolls the main content area back to the top so the hero zone
 * (GPA rings) is visible after a user action.
 *
 * Called after:
 *   - ADD_SEMESTER dispatch
 *   - ADD_COURSE dispatch
 *   - UPDATE_COURSE dispatch
 *   - Student profile save
 *   - Previous record save / clear
 *
 * Uses window.scrollTo with smooth behaviour. The `behavior: 'smooth'`
 * option is respected by all modern browsers. On browsers that don't
 * support it the call falls back to an instant jump — acceptable.
 *
 * @param {'smooth' | 'instant'} [behavior='smooth']
 */
export function scrollToHero(behavior = 'smooth') {
  window.scrollTo({ top: 0, behavior });
}
