import { expect } from '@playwright/test';
import type { Page } from '@playwright/test';

/**
 * Waits for a <conjure-component> custom element to appear on the page,
 * then asserts it contains a table-like structure with rows.
 */
export const expectTableInPage = async (page: Page): Promise<void> => {
  // Wait for Conjure's custom element to be injected
  const conjureComponent = page.locator('conjure-component');
  await expect(conjureComponent.first()).toBeAttached({ timeout: 90_000 });

  // Look for a table inside the shadow DOM or light DOM
  // Conjure injects components inside a shadow root within <conjure-component>
  const tableLocator = conjureComponent.first().locator('table, [role="table"]');
  const shadowTableLocator = page.locator('conjure-component').first().locator('>> table, >> [role="table"]');

  // Try light DOM first, then shadow DOM
  const hasLightTable = await tableLocator
    .count()
    .then(c => c > 0)
    .catch(() => false);
  const hasShadowTable = await shadowTableLocator
    .count()
    .then(c => c > 0)
    .catch(() => false);

  expect(hasLightTable || hasShadowTable).toBe(true);

  // Assert rows exist (at least header + 1 data row)
  if (hasLightTable) {
    const rows = tableLocator.first().locator('tr, [role="row"]');
    expect(await rows.count()).toBeGreaterThanOrEqual(2);
  } else {
    const rows = shadowTableLocator.first().locator('>> tr, >> [role="row"]');
    expect(await rows.count()).toBeGreaterThanOrEqual(2);
  }
};
