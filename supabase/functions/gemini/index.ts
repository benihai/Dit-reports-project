import "jsr:@supabase/functions-js/edge-runtime.d.ts";

// Gemini proxy — מחזיק את מפתח ה-API בצד-שרת כך שהוא לעולם לא נחשף ללקוח.
//
// המפתח: הפונקציה החיה פרוסה עם המפתח מוטמע בקוד (server-side, פרטי לפרויקט).
// הדרך המומלצת לתחזוקה: להגדיר secret במקום זאת —
//   supabase secrets set GEMINI_API_KEY=<key>
// ואז לפרוס מחדש את הקובץ הזה (שקורא מ-Deno.env). בלי secret, הפריסה
// דרך הקובץ הזה תיכשל ב-runtime — לכן הפריסה החיה מטמיעה את המפתח ישירות.
const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY") ?? "";
const ALLOWED_MODELS = ["gemini-2.0-flash", "gemini-2.5-flash"];
const MAX_BODY_CHARS = 20000;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// מחלץ את ה-role מתוך ה-JWT (כבר אומת ע"י verify_jwt). דורשים משתמש מחובר (לא anon).
function roleFromJwt(auth: string | null): string | null {
  if (!auth) return null;
  const m = auth.match(/^Bearer\s+(.+)$/i);
  if (!m) return null;
  try {
    const part = m[1].split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    const payload = JSON.parse(atob(part));
    return payload.role ?? null;
  } catch {
    return null;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: cors });
  }

  const role = roleFromJwt(req.headers.get("Authorization"));
  if (role !== "authenticated") {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  let payload: any;
  try {
    payload = await req.json();
  } catch {
    return new Response("Invalid JSON", { status: 400, headers: cors });
  }

  const model = payload?.model;
  const body = payload?.body;
  if (!ALLOWED_MODELS.includes(model)) {
    return new Response("Model not allowed", { status: 400, headers: cors });
  }
  if (!body || typeof body !== "object") {
    return new Response("Missing body", { status: 400, headers: cors });
  }
  if (JSON.stringify(body).length > MAX_BODY_CHARS) {
    return new Response("Payload too large", { status: 413, headers: cors });
  }

  try {
    const url =
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=` +
      encodeURIComponent(GEMINI_API_KEY);
    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const text = await resp.text();
    return new Response(text, {
      status: resp.status,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: "Gemini request failed: " + String(err) }), {
      status: 502,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
