/**
 * Performance optimizations for Neon Relic.
 * Debouncing, caching, and render batching utilities.
 */

/**
 * Debounce a function call.
 * @param {Function} fn - Function to debounce.
 * @param {number} delay - Milliseconds to delay.
 * @returns {Function} Debounced function.
 */
export function debounce(fn, delay = 200) {
  let timer;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}

/**
 * Simple in-memory cache with TTL.
 */
export class SimpleCache {
  constructor(ttl = 60000) {
    this._cache = new Map();
    this._ttl = ttl;
  }

  get(key) {
    const entry = this._cache.get(key);
    if (!entry) return undefined;
    if (Date.now() - entry.time > this._ttl) {
      this._cache.delete(key);
      return undefined;
    }
    return entry.value;
  }

  set(key, value) {
    this._cache.set(key, { value, time: Date.now() });
  }

  clear() {
    this._cache.clear();
  }
}

/**
 * Batch multiple update calls into a single render.
 * Collects updates over a microtask then fires once.
 * @param {Function} renderFn - The render function to call once.
 * @returns {Function} A function that queues renders.
 */
export function batchRender(renderFn) {
  let queued = false;
  return function () {
    if (queued) return;
    queued = true;
    queueMicrotask(() => {
      queued = false;
      renderFn.call(this);
    });
  };
}

/**
 * Lazily evaluate a value once and cache the result.
 * @param {Function} factory - Factory function.
 * @returns {Function} Getter that returns cached value.
 */
export function lazy(factory) {
  let value;
  let computed = false;
  return () => {
    if (!computed) {
      value = factory();
      computed = true;
    }
    return value;
  };
}
