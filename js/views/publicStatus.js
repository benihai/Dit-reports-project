// Public, unauthenticated status page. Reached via #/public/<token>. Loads a
// report through the anon get_public_report RPC, lets an external recipient mark
// each finding done/open + add a note, and submits a "sub-report" (their own
// separate snapshot) via submit_sub_report. Never writes to the report itself.
const PublicStatus = (() => {
  let _token = null;
  let _data = null;            // { report, notes }
  const _responses = {};       // noteId -> { status, note }

  function esc(s) {
    return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }
  function fmtDate(d) {
    if (!d) return '';
    const [y, m, day] = String(d).split('-');
    return day ? `${day}/${m}/${y}` : d;
  }
  function _tokenFromHash() {
    const m = location.hash.match(/^#\/public\/([^/?]+)/);
    return m ? decodeURIComponent(m[1]) : null;
  }
  function _msg(title, sub) {
    return `<div style="max-width:480px;margin:60px auto;text-align:center;padding:24px;font-family:'Heebo',Arial,sans-serif;">
      <h2 style="color:#1A1A1A;">${esc(title)}</h2>
      ${sub ? `<p style="color:#666;">${esc(sub)}</p>` : ''}</div>`;
  }

  async function render() {
    _token = _tokenFromHash();
    const container = document.getElementById('view-container');
    if (!container) return;
    if (!_token) { container.innerHTML = _msg('קישור לא תקין'); return; }
    container.innerHTML = `<div style="padding:50px;text-align:center;color:#999;">טוען דוח…</div>`;
    try {
      _data = await Storage.Public.getReport(_token);
    } catch (_) {
      container.innerHTML = _msg('שגיאה בטעינת הדוח', 'נסה שוב מאוחר יותר');
      return;
    }
    if (!_data || !_data.report) {
      container.innerHTML = _msg('הדוח לא נמצא', 'ייתכן שהקישור שגוי או פג תוקף');
      return;
    }
    (_data.notes || []).forEach(n => { _responses[n.id] = { status: 'open', note: '' }; });
    container.innerHTML = _formHtml();
  }

  function _findingHtml(n, num) {
    const imgs = (n.mediaItems || []).filter(m => m.type === 'image');
    const plans = (n.planMarkups || []);
    return `
      <div style="background:#fff;border:1px solid #E6E6E2;border-radius:10px;padding:14px;margin-bottom:12px;">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:8px;">
          <span style="background:#1A1A1A;color:#fff;font-size:.72rem;font-weight:700;padding:3px 12px;border-radius:999px;white-space:nowrap;">ממצא ${num}</span>
          <span style="font-size:.8rem;color:#666;text-align:left;">${esc([n.floor, n.area].filter(Boolean).join(' · '))}</span>
        </div>
        <div style="font-size:.95rem;color:#1A1A1A;line-height:1.6;white-space:pre-line;">${esc(n.description)}</div>
        ${n.responsible ? `<div style="font-size:.8rem;color:#666;margin-top:6px;">👷 אחראי: ${esc(n.responsible)}</div>` : ''}
        ${imgs.length ? `<div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:10px;">
          ${imgs.map(m => `<img src="${m.data}" style="max-width:150px;max-height:130px;border-radius:6px;border:1px solid #ddd;">`).join('')}</div>` : ''}
        ${plans.length ? `<div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:8px;">
          ${plans.map(p => `<img src="${p.imageData}" style="max-width:170px;max-height:130px;border-radius:6px;border:1px solid #ddd;">`).join('')}</div>` : ''}
        <div style="display:flex;gap:8px;margin-top:12px;">
          <button type="button" id="st-done-${n.id}" class="pub-status-btn" onclick="PublicStatus.setStatus('${n.id}','done')">✓ הושלם</button>
          <button type="button" id="st-open-${n.id}" class="pub-status-btn active-open" onclick="PublicStatus.setStatus('${n.id}','open')">○ פתוח</button>
        </div>
        <textarea id="resp-note-${n.id}" placeholder="הערה (אופציונלי)…" oninput="PublicStatus.setNote('${n.id}', this.value)"
          style="width:100%;margin-top:8px;min-height:36px;padding:8px;border:1.5px solid #e4f0c4;border-radius:6px;font-family:inherit;resize:vertical;"></textarea>
      </div>`;
  }

  function _formHtml() {
    const r = _data.report;
    const notes = _data.notes || [];
    return `
      <div style="max-width:760px;margin:0 auto;padding:16px;font-family:'Heebo',Arial,sans-serif;direction:rtl;">
        <div style="background:#1A1A1A;color:#fff;border-radius:10px;padding:16px 20px;margin-bottom:16px;border-top:4px solid #8DC63F;">
          <div style="font-weight:800;font-size:1.05rem;">דוח סיור #${esc(r.reportNumber)} — מילוי סטטוס</div>
          ${r.description ? `<div style="opacity:.85;font-size:.88rem;margin-top:4px;">${esc(r.description)}</div>` : ''}
          <div style="opacity:.6;font-size:.8rem;margin-top:6px;">${esc(fmtDate(r.date))}${r.floors ? ' · ' + esc(r.floors) : ''}</div>
        </div>
        <div style="background:#f5f7f2;border:1px solid #d4e8b0;border-radius:8px;padding:12px 16px;margin-bottom:16px;font-size:.9rem;color:#3A3A3A;line-height:1.6;">
          סמן לכל ממצא אם <b>הושלם</b> או <b>פתוח</b>, והוסף הערה לפי הצורך. בסיום מלא שם ותפקיד ולחץ <b>"שלח סטטוס"</b>.
        </div>
        ${notes.length ? notes.map((n, i) => _findingHtml(n, i + 1)).join('') : '<p style="text-align:center;color:#888;">אין ממצאים בדוח.</p>'}
        <div style="background:#fff;border:1px solid #E6E6E2;border-radius:10px;padding:16px;margin-top:18px;">
          <div style="font-weight:700;margin-bottom:10px;">פרטי הממלא</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
            <div>
              <label style="font-size:.8rem;color:#666;">שם מלא *</label>
              <input id="pub-name" type="text" style="width:100%;padding:9px;border:1.5px solid #d4e8b0;border-radius:6px;font-family:inherit;">
            </div>
            <div>
              <label style="font-size:.8rem;color:#666;">תפקיד *</label>
              <input id="pub-role" type="text" placeholder="למשל: קבלן חשמל" style="width:100%;padding:9px;border:1.5px solid #d4e8b0;border-radius:6px;font-family:inherit;">
            </div>
          </div>
          <button type="button" onclick="PublicStatus.submit()" style="margin-top:14px;width:100%;padding:12px;background:#4a8a20;color:#fff;border:none;border-radius:8px;font-weight:700;font-size:1rem;cursor:pointer;">שלח סטטוס</button>
        </div>
        <div style="text-align:center;color:#aaa;font-size:.75rem;margin:20px 0;"><b style="color:#8DC63F;">DIT</b> · Design It Right</div>
      </div>`;
  }

  function setStatus(id, status) {
    _responses[id] = _responses[id] || { status: 'open', note: '' };
    _responses[id].status = status;
    document.getElementById(`st-done-${id}`)?.classList.toggle('active-done', status === 'done');
    document.getElementById(`st-open-${id}`)?.classList.toggle('active-open', status === 'open');
  }
  function setNote(id, v) {
    _responses[id] = _responses[id] || { status: 'open', note: '' };
    _responses[id].note = v;
  }

  async function submit() {
    const name = document.getElementById('pub-name')?.value.trim() || '';
    const role = document.getElementById('pub-role')?.value.trim() || '';
    if (!name || !role) { alert('נא למלא שם ותפקיד'); return; }
    const responses = (_data.notes || []).map(n => ({
      noteId: n.id,
      description: n.description,
      status: _responses[n.id]?.status || 'open',
      note: _responses[n.id]?.note || '',
    }));
    try {
      await Storage.Public.submit(_token, name, role, responses);
      document.getElementById('view-container').innerHTML = `
        <div style="max-width:480px;margin:60px auto;text-align:center;padding:24px;font-family:'Heebo',Arial,sans-serif;">
          <div style="font-size:3rem;color:#4a8a20;">✓</div>
          <h2 style="color:#4a8a20;">הסטטוס נשלח, תודה ${esc(name)}!</h2>
          <p style="color:#666;">הדיווח התקבל ונשמר. אפשר לסגור את הדף.</p>
        </div>`;
    } catch (_) {
      alert('שגיאה בשליחה. בדוק חיבור לאינטרנט ונסה שוב.');
    }
  }

  return { render, setStatus, setNote, submit };
})();
