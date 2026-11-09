import AxeBuilder from '@axe-core/playwright';
import { Page } from '@playwright/test';

/** axe's violations on the page as it is now, one entry per rule with where it was found. */
export async function axeViolations(page: Page) {
  const { violations } = await new AxeBuilder({ page }).analyze();
  return violations.map(v => `${v.id} (${v.impact}): ${v.help}\n    ${v.nodes.map(n => n.target.join(' ')).join('\n    ')}`);
}
