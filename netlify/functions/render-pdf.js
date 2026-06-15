// Server-side PDF renderer. The app builds the report HTML in the browser
// (reusing PdfExport.buildHtml), uploads it to a short-lived private Supabase
// Storage object, and sends us the signed URL. We load it in headless Chrome
// and print it to a real A4 PDF — identical on every device, including iPhone,
// because the rendering happens here with Chrome, not on the user's phone.
const chromium = require('@sparticuz/chromium');
const puppeteer = require('puppeteer-core');

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers: CORS, body: 'Method not allowed' };

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch (_) { return { statusCode: 400, headers: CORS, body: 'Invalid JSON' }; }

  const { htmlUrl, html } = body;
  if (!htmlUrl && !html) {
    return { statusCode: 400, headers: CORS, body: 'Missing htmlUrl or html' };
  }

  let browser;
  try {
    browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: { width: 1240, height: 1754, deviceScaleFactor: 2 },
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
    });

    const page = await browser.newPage();
    // networkidle0 waits for fonts (Google Fonts @import) and any remaining
    // image requests; the body images are inline base64 so they're instant.
    if (htmlUrl) {
      await page.goto(htmlUrl, { waitUntil: 'networkidle0', timeout: 25000 });
    } else {
      await page.setContent(html, { waitUntil: 'networkidle0', timeout: 25000 });
    }
    await page.evaluateHandle('document.fonts.ready').catch(() => {});

    // preferCSSPageSize honors the page's own `@page { size: A4; margin: 0 }`,
    // so there is no browser header/footer and findings stay whole — exactly the
    // layout the print CSS already produces in desktop Chrome.
    const pdf = await page.pdf({
      printBackground: true,
      preferCSSPageSize: true,
      format: 'A4',
      margin: { top: '0', right: '0', bottom: '0', left: '0' },
    });

    return {
      statusCode: 200,
      headers: {
        ...CORS,
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename="report.pdf"',
      },
      body: Buffer.from(pdf).toString('base64'),
      isBase64Encoded: true,
    };
  } catch (err) {
    return { statusCode: 500, headers: CORS, body: 'Render failed: ' + (err && err.message || err) };
  } finally {
    if (browser) { try { await browser.close(); } catch (_) {} }
  }
};
