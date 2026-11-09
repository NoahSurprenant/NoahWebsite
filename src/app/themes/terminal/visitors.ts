/** Unique visitors per hour for the last two days, from netlify/functions/visitors.mts. */
export const VISITORS_URL = '/api/visitors';

export interface Visitors {
  /** Oldest first */
  hours: number[];
}

/** The counts, or null when there are none to show (local dev, or the analytics are down). */
export async function loadVisitors(): Promise<number[] | null> {
  try {
    const response = await fetch(VISITORS_URL);
    if (!response.ok) return null;
    const { hours } = (await response.json()) as Visitors;
    return Array.isArray(hours) && hours.length ? hours : null;
  } catch {
    return null;
  }
}

const BLOCKS = '▁▂▃▄▅▆▇█';

/** A sparkline in block characters, the tallest value a full block. */
export function sparkline(values: readonly number[]) {
  const max = Math.max(1, ...values);
  return values.map(v => BLOCKS[Math.min(BLOCKS.length - 1, Math.floor((v / max) * BLOCKS.length))]).join('');
}

/** 1234 → 1.2k */
export function short(n: number) {
  return n < 1000 ? String(n) : `${(n / 1000).toFixed(n < 10000 ? 1 : 0)}k`;
}
