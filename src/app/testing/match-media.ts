/**
 * jsdom has no matchMedia. This one matches the given queries (e.g. reduced motion, so the
 * terminal skips its typing animation) and nothing else.
 */
export function stubMatchMedia(...matching: string[]) {
  window.matchMedia = (query: string) => ({
    matches: matching.includes(query),
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  });
}

export const REDUCED_MOTION = '(prefers-reduced-motion: reduce)';
