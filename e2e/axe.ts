import AxeBuilder from '@axe-core/playwright';
import { Page } from '@playwright/test';
import { appendFile, mkdir } from 'node:fs/promises';

/** Where each scan is recorded, a JSON line per scan, for e2e/axe-summary.mjs (the PR comment). */
export const AXE_RESULTS = 'axe-results/scans.jsonl';

/**
 * axe's violations on the page as it is now, one entry per rule with where it was found. `name`
 * says what was scanned (theme, screen, terminal command) in the record.
 */
export async function axeViolations(page: Page, name: string) {
  const { violations, passes } = await new AxeBuilder({ page }).analyze();
  const found = violations.map(v => `${v.id} (${v.impact}): ${v.help}\n    ${v.nodes.map(n => n.target.join(' ')).join('\n    ')}`);
  await mkdir('axe-results', { recursive: true });
  await appendFile(AXE_RESULTS, `${JSON.stringify({
    name,
    rules: violations.length + passes.length,
    violations: violations.map(v => ({ id: v.id, impact: v.impact, help: v.help, nodes: v.nodes.length })),
  })}\n`);
  return found;
}
