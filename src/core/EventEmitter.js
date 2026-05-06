/**
 * @module EventEmitter
 * @description Typed publish-subscribe event system.
 *
 * PATTERNS DEMONSTRATED:
 * - Symbol() — unique, non-enumerable key for truly private listener storage
 * - Observer Pattern — producers and consumers are fully decoupled
 * - Fluent Interface — on/off/emit return `this` for method chaining
 * - Closure in once() — a wrapper that removes itself after firing
 */

import { createLogger } from '../utils/logger.js';

const log = createLogger('EventEmitter');
const _listeners = Symbol('listeners');

export class EventEmitter {
  constructor() {
    // Map<eventName, Set<Function>>
    // Set ensures each listener is registered at most once
    this[_listeners] = new Map();
  }

  on(event, listener) {
    if (typeof listener !== 'function')
      throw new TypeError(`EventEmitter.on: listener must be a function, got ${typeof listener}`);
    if (!this[_listeners].has(event)) this[_listeners].set(event, new Set());
    this[_listeners].get(event).add(listener);
    return this; // fluent
  }

  /**
   * Registers a one-time listener.
   * Closure: `wrapper` closes over `listener` and `this` to self-remove.
   */
  once(event, listener) {
    const wrapper = (...args) => { listener(...args); this.off(event, wrapper); };
    wrapper._original = listener;
    return this.on(event, wrapper);
  }

  off(event, listener) {
    const set = this[_listeners].get(event);
    if (!set) return this;
    for (const fn of set) {
      if (fn === listener || fn._original === listener) { set.delete(fn); break; }
    }
    return this;
  }

  /** Emits synchronously; errors in one listener don't break the others */
  emit(event, ...args) {
    const set = this[_listeners].get(event);
    if (!set?.size) return this;
    for (const fn of [...set]) {        // snapshot the Set
      try { fn(...args); }
      catch (err) { log.error(`Error in "${event}" listener`, err); }
    }
    return this;
  }

  removeAllListeners(event) {
    event ? this[_listeners].delete(event) : this[_listeners].clear();
    return this;
  }

  listenerCount(event) { return this[_listeners].get(event)?.size ?? 0; }
  eventNames()        { return [...this[_listeners].keys()]; }
}

/**
 * Singleton application event bus.
 * Components communicate through this shared instance without knowing about each other.
 */
export const eventBus = new EventEmitter();
