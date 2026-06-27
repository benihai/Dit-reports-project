// ── Gemini: שכתוב/מיון חכם של תיאור ממצא ───────────────────────────────────────
// מקבל טקסט חופשי שהמשתמש כתב (כולל קומה/אזור/אחריות במילים שלו) ומחזיר אובייקט
// מובנה: { floor, area, responsibilities[], customResponsibility, description }.
//
// שני מסלולי מפתח:
//   1. (ברירת מחדל) Supabase Edge Function 'gemini' — מחזיק את המפתח בצד-שרת,
//      כך שאף משתמש לא נשאל והמפתח לא נחשף. דורש משתמש מחובר.
//   2. (override לפיתוח) מפתח מקומי ב-localStorage('dit:gemini_key') → קריאה
//      ישירה ל-Google. שימושי לבדיקה בלי חיבור Supabase.
const Gemini = (() => {
  const MODEL    = 'gemini-2.5-flash';
  const LS_KEY   = 'dit:gemini_key';

  // חייב להישאר תואם ל-RESPONSIBILITY_OPTIONS ב-noteModal.js (ללא 'התאמה אישית')
  const RESP_PRESETS = [
    'פיקוח', 'קבלן ראשי', 'קבלן חשמל', 'קבלן מיזוג',
    'קבלן תקשורת', 'קבלן ביטחון', 'קבלן מולטימדיה',
  ];

  function localKey()        { try { return localStorage.getItem(LS_KEY) || ''; } catch (_) { return ''; } }
  function setLocalKey(k)     { try { k ? localStorage.setItem(LS_KEY, k.trim()) : localStorage.removeItem(LS_KEY); } catch (_) {} }
  function hasLocalKey()      { return !!localKey(); }

  // ── בניית גוף הבקשה ל-Gemini (מקור אמת יחיד לשני המסלולים) ───────────────────
  function _buildBody(rawText) {
    const prompt =
      'אתה עוזר לכתיבת דוחות פיקוח בנייה בעברית. קיבלת תיאור חופשי של ממצא ' +
      'שכתב מפקח במילים שלו. עליך:\n' +
      '1. לחלץ את הקומה (אם צוינה) לשדה floor — רק שם/מספר הקומה, ללא המילה "קומה" אם אפשר ' +
      '(למשל "קומה 3" → "קומה 3"; "בקומת קרקע" → "קומת קרקע").\n' +
      '2. לחלץ את האזור/החדר לשדה area (למשל "חדר שינה", "מטבח", "לובי").\n' +
      '3. לזהות מי הגורם האחראי ולמלא את responsibilities מתוך הרשימה הסגורה בלבד: ' +
      RESP_PRESETS.join(', ') + '. בחר רק ערכים שבאמת מתאימים (אפשר כמה, אפשר ריק). ' +
      'אם האחראי שהוזכר אינו ברשימה, השאר responsibilities ריק ומלא את customResponsibility ' +
      'בשם הגורם (למשל "קבלן אינסטלציה"). אם לא צוין אחראי כלל — השאר את שניהם ריקים.\n' +
      '4. לנסח מחדש את הממצא לשדה description בצורה מקצועית, ברורה, תמציתית ומסודרת ' +
      'בעברית תקנית, בלשון דיווח עניינית. אל תמציא פרטים שלא נכתבו. אל תכלול את הקומה/האזור ' +
      'בתוך description (הם נשמרים בנפרד), אלא רק את תיאור הליקוי עצמו.\n\n' +
      'הטקסט החופשי:\n"""\n' + rawText + '\n"""';

    return {
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.4,
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'OBJECT',
          properties: {
            floor:                 { type: 'STRING' },
            area:                  { type: 'STRING' },
            responsibilities:      { type: 'ARRAY', items: { type: 'STRING', enum: RESP_PRESETS } },
            customResponsibility:  { type: 'STRING' },
            description:           { type: 'STRING' },
          },
          required: ['description'],
        },
      },
    };
  }

  // מחלץ את אובייקט ה-JSON מתשובת Gemini הגולמית
  function _parseResult(data) {
    const txt = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!txt) {
      const reason = data?.promptFeedback?.blockReason || data?.candidates?.[0]?.finishReason;
      throw new Error(reason ? `Gemini חסם/לא השיב (${reason})` : 'תשובה ריקה מ-Gemini');
    }
    let obj;
    try { obj = JSON.parse(txt); }
    catch (_) {
      // הגנה: לעיתים נדירות עוטף את ה-JSON ב-```json … ```
      const m = txt.match(/\{[\s\S]*\}/);
      if (!m) throw new Error('לא ניתן לפענח את תשובת Gemini');
      obj = JSON.parse(m[0]);
    }
    return _normalize(obj);
  }

  function _normalize(obj) {
    const presetSet = new Set(RESP_PRESETS);
    const resp = Array.isArray(obj.responsibilities)
      ? obj.responsibilities.map(s => String(s).trim()).filter(s => presetSet.has(s))
      : [];
    return {
      floor:                String(obj.floor || '').trim(),
      area:                 String(obj.area  || '').trim(),
      responsibilities:     [...new Set(resp)],
      customResponsibility: String(obj.customResponsibility || '').trim(),
      description:          String(obj.description || '').trim(),
    };
  }

  // ── קריאה ───────────────────────────────────────────────────────────────────
  async function enhanceFinding(rawText) {
    const text = String(rawText || '').trim();
    if (!text) throw new Error('אין טקסט לשכתוב');

    const body = _buildBody(text);
    const key  = localKey();

    let data;
    if (key) {
      // מסלול ישיר ל-Google (מפתח מקומי — override לפיתוח)
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${encodeURIComponent(key)}`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
      );
      if (!res.ok) {
        const errTxt = await res.text().catch(() => '');
        throw new Error(`Gemini ${res.status}: ${errTxt.slice(0, 200) || res.statusText}`);
      }
      data = await res.json();
    } else {
      // מסלול Supabase Edge Function — המפתח בצד-שרת. functions.invoke מוסיף
      // אוטומטית Authorization (token של המשתמש המחובר) + apikey.
      const { data: out, error } = await _supabase.functions.invoke('gemini', {
        body: { model: MODEL, body },
      });
      if (error) {
        let detail = error.message || String(error);
        let status = error.context?.status;
        try { const ctx = await error.context?.json?.(); if (ctx?.error) detail = ctx.error; } catch (_) {}
        if (status === 401) throw new Error('צריך להתחבר מחדש כדי להשתמש בשכתוב AI');
        throw new Error('שגיאת AI: ' + detail);
      }
      data = out;
    }

    return _parseResult(data);
  }

  return { enhanceFinding, hasLocalKey, setLocalKey, localKey, RESP_PRESETS, MODEL };
})();
