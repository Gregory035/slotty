import { chromium } from '@playwright/test';

const target = new URL(process.env.PERFORMANCE_URL || 'https://slotty23.ru/');
const browser = await chromium.launch();
try {
  for (let run = 1; run <= 3; run++) {
    const context = await browser.newContext({ viewport: { width: 440, height: 956 }, deviceScaleFactor: 1, isMobile: true });
    const page = await context.newPage();
    const cdp = await context.newCDPSession(page);
    await cdp.send('Network.enable');
    await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
    await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: 200000, uploadThroughput: 93750 });
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    await page.addInitScript(() => {
      globalThis.performanceSamples = { lcp: null, cls: 0 };
      new PerformanceObserver((list) => {
        const entry = list.getEntries().at(-1);
        globalThis.performanceSamples.lcp = { ms: entry.startTime, tag: entry.element?.tagName, className: entry.element?.className, text: entry.element?.textContent?.slice(0, 100), url: entry.url };
      }).observe({ type: 'largest-contentful-paint', buffered: true });
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) if (!entry.hadRecentInput) globalThis.performanceSamples.cls += entry.value;
      }).observe({ type: 'layout-shift', buffered: true });
    });
    await page.goto(target.href, { waitUntil: 'load', timeout: 60000 });
    await page.waitForTimeout(6000);
    console.log(JSON.stringify(await page.evaluate((run) => {
      const nav = performance.getEntriesByType('navigation')[0];
      return { run, ...globalThis.performanceSamples, ttfbMs: nav.responseStart, resources: performance.getEntriesByType('resource').map((r) => ({ name: new URL(r.name).pathname, bytes: r.transferSize, endMs: r.responseEnd })).sort((a, b) => b.bytes - a.bytes).slice(0, 12), overflow: globalThis.document.documentElement.scrollWidth > globalThis.innerWidth };
    }, run)));
    await context.close();
  }
} finally { await browser.close(); }
