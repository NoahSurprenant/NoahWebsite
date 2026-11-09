import { rm } from 'node:fs/promises';

/** Starts each run without the last one's axe scans (e2e/axe.ts appends to them). */
export default async function globalSetup() {
  await rm('axe-results', { recursive: true, force: true });
}
