// Netlify function: פרוקסי מאובטח ל-Gemini. מחזיק את GEMINI_API_KEY כ-env var
// כך שהמפתח לעולם אינו נחשף בצד הלקוח. הלקוח שולח { model, body } והפונקציה
// מזריקה את המפתח ומעבירה ל-Google.
//
// הגדרת המפתח: Netlify → Site settings → Environment variables → GEMINI_API_KEY

const ALLOWED_MODELS = ['gemini-2.0-flash', 'gemini-2.5-flash'];
const MAX_BODY_CHARS  = 20000;  // תקרת גודל למניעת ניצול לרעה

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    return { statusCode: 500, body: 'GEMINI_API_KEY not configured' };
  }

  let payload;
  try { payload = JSON.parse(event.body || '{}'); }
  catch (_) { return { statusCode: 400, body: 'Invalid JSON' }; }

  const model = payload.model;
  const body  = payload.body;
  if (!ALLOWED_MODELS.includes(model)) {
    return { statusCode: 400, body: 'Model not allowed' };
  }
  if (!body || typeof body !== 'object') {
    return { statusCode: 400, body: 'Missing body' };
  }
  if (JSON.stringify(body).length > MAX_BODY_CHARS) {
    return { statusCode: 413, body: 'Payload too large' };
  }

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`;
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const text = await resp.text();
    return {
      statusCode: resp.status,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: text,
    };
  } catch (err) {
    return { statusCode: 502, body: 'Gemini request failed: ' + err.message };
  }
};
