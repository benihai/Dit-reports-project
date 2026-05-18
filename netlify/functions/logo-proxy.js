const ALLOWED_HOSTS = [
  'logo.clearbit.com',
  'autocomplete.clearbit.com',
  'www.google.com',
  'icons.duckduckgo.com',
  'icon.horse',
];

exports.handler = async (event) => {
  const url = event.queryStringParameters?.url;
  if (!url) return { statusCode: 400, body: 'Missing url parameter' };

  let parsed;
  try { parsed = new URL(url); } catch (_) {
    return { statusCode: 400, body: 'Invalid URL' };
  }

  if (!ALLOWED_HOSTS.includes(parsed.hostname)) {
    return { statusCode: 403, body: 'Host not allowed' };
  }

  try {
    const resp = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    if (!resp.ok) return { statusCode: resp.status, body: 'Upstream error' };

    const buffer = await resp.arrayBuffer();
    const base64 = Buffer.from(buffer).toString('base64');
    const ct = resp.headers.get('content-type') || 'image/png';

    return {
      statusCode: 200,
      headers: {
        'Content-Type': ct,
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=86400',
      },
      body: base64,
      isBase64Encoded: true,
    };
  } catch (err) {
    return { statusCode: 502, body: 'Fetch failed: ' + err.message };
  }
};
