import { chromium } from "playwright";

export async function renderPdf(html: string) {
  const browser = await chromium.launch({ headless: true, timeout: 20_000, chromiumSandbox: process.env.CHROMIUM_SANDBOX === "1" });
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const context = await browser.newContext({ javaScriptEnabled: false, serviceWorkers: "block", offline: true });
    await context.route("**/*", (route) => route.abort());
    const page = await context.newPage();
    await page.setContent(html, { waitUntil: "domcontentloaded", timeout: 15_000 });
    return await Promise.race([
      page.pdf({
        format: "A4", preferCSSPageSize: true, printBackground: false, displayHeaderFooter: true,
        margin: { top: "15mm", bottom: "18mm", left: "14mm", right: "14mm" },
        headerTemplate: "<span></span>",
        footerTemplate: '<div style="width:100%;font:9px Arial;text-align:center;color:#555">Seite <span class="pageNumber"></span> / <span class="totalPages"></span></div>',
      }),
      new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error("PDF timeout")), 40_000); }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
    await browser.close();
  }
}
