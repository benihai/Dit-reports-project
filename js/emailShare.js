const EmailShare = (() => {

  let _report = null, _notes = null, _project = null;
  let _missingImages = 0;   // images that failed to load and were left out of the PDF
  const _loaded = {};

  function esc(s) {
    return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  function _loadScript(src) {
    if (_loaded[src]) return _loaded[src];
    _loaded[src] = new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = src; s.onload = res; s.onerror = rej;
      document.head.appendChild(s);
    });
    return _loaded[src];
  }

  // ── פתיחת חלון בחירת נמענים ─────────────────────────────────────────────────
  async function open(report, notes, project) {
    _report  = report;
    _notes   = notes;
    _project = project;

    const contacts = project.contacts || [];
    document.getElementById('email-share-overlay')?.remove();

    const overlay = document.createElement('div');
    overlay.id        = 'email-share-overlay';
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal-box" onclick="event.stopPropagation()" style="max-width:420px;">
        <div class="modal-handle"></div>
        <div class="modal-title">📧 שיתוף דוח במייל</div>
        ${contacts.length === 0
          ? `<p style="color:var(--text-muted);font-size:.9rem;text-align:center;padding:16px 0;">
               לא הוגדרו אנשי קשר לפרויקט זה.<br>
               <span style="font-size:.8rem;">ניתן להוסיף אנשי קשר בעריכת הפרויקט.</span>
             </p>`
          : `<div style="margin-bottom:12px;font-size:.85rem;color:var(--text-muted);">בחר נמענים:</div>
             <div id="esh-contacts" style="display:flex;flex-direction:column;gap:8px;
                  max-height:280px;overflow-y:auto;margin-bottom:16px;">
               ${contacts.map((c, i) => `
                 <label style="display:flex;align-items:center;gap:10px;padding:10px 12px;
                   border:1px solid var(--border);border-radius:8px;cursor:pointer;">
                   <input type="checkbox" data-idx="${i}"
                     style="width:16px;height:16px;accent-color:var(--green);">
                   <div>
                     <div style="font-weight:700;font-size:.9rem;">${esc(c.name)}</div>
                     <div style="font-size:.8rem;color:var(--text-muted);">
                       ${esc(c.email)}${c.role ? ' · ' + esc(c.role) : ''}
                     </div>
                   </div>
                 </label>`).join('')}
             </div>`
        }
        <div class="form-actions">
          <button class="btn btn-outline"
            onclick="document.getElementById('email-share-overlay').remove()">ביטול</button>
          ${contacts.length > 0
            ? `<button class="btn btn-primary" onclick="EmailShare._send()">📤 פתח מייל</button>`
            : ''}
        </div>
      </div>`;
    document.body.appendChild(overlay);
    overlay.classList.remove('hidden');
    overlay.onclick = e => { if (e.target === overlay) overlay.remove(); };
  }

  // ── יצירת PDF כ-Blob ─────────────────────────────────────────────────────────
  async function _generatePdfBlob() {
    await _loadScript('https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js');
    await _loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js');

    const html = await PdfExport.buildHtml(_report, _notes, _project);

    const container = document.createElement('div');
    container.style.cssText =
      'position:fixed;left:-9999px;top:0;width:794px;background:#fff;' +
      'font-family:Heebo,Arial,sans-serif;direction:rtl;';
    container.innerHTML = html;
    document.body.appendChild(container);

    // המר תמונות ל-data URL למנוע "tainted canvas"; ספור תמונות שנכשלו
    _missingImages = 0;
    await Promise.all(Array.from(container.querySelectorAll('img')).map(async img => {
      if (!img.src || img.src.startsWith('data:')) return;
      try {
        const r = await fetch(img.src, { mode: 'cors' });
        if (!r.ok) throw new Error('fetch failed');
        const blob = await r.blob();
        img.src = await new Promise((res, rej) => {
          const fr = new FileReader();
          fr.onload  = () => res(fr.result);
          fr.onerror = rej;
          fr.readAsDataURL(blob);
        });
      } catch { img.style.display = 'none'; _missingImages++; }
    }));

    await new Promise(r => setTimeout(r, 400));

    const canvas = await html2canvas(container, {
      scale: 1.8, useCORS: false, allowTaint: false,
      logging: false, backgroundColor: '#ffffff',
    });

    // אסוף גבולות (בפיקסלים של ה-canvas) של אלמנטים שאסור לחתוך באמצע
    const cRect = container.getBoundingClientRect();
    const sx = canvas.width / container.offsetWidth;
    const regions = Array.from(
      container.querySelectorAll('[data-finding-card], figure, img')
    ).map(el => {
      const r = el.getBoundingClientRect();
      return { top: (r.top - cRect.top) * sx, bottom: (r.bottom - cRect.top) * sx };
    }).filter(r => r.bottom - r.top > 2);

    container.remove();

    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pageWmm = 210, pageHmm = 297;
    const pageHpx = canvas.width * (pageHmm / pageWmm);

    // מצא נקודת חיתוך בטוחה שלא חוצה ממצא/תמונה — דוחף את החיתוך לראש האלמנט
    const safeBottom = (top, ideal) => {
      if (ideal >= canvas.height) return canvas.height;
      let bottom = ideal;
      for (let i = 0; i < 2000; i++) {
        let moved = false;
        for (const r of regions) {
          if (r.top > top + 2 && r.top < bottom - 0.5 && r.bottom > bottom + 0.5) {
            bottom = r.top; moved = true;
          }
        }
        if (!moved) break;
      }
      if (bottom <= top + 1) bottom = ideal; // אלמנט גבוה מעמוד שלם — אין מנוס מחיתוך
      return bottom;
    };

    // חתוך לעמודים — כל עמוד הוא פרוסה נפרדת בגובה משתנה לפי גבולות בטוחים
    let y = 0, first = true;
    while (y < canvas.height - 1) {
      const ideal  = Math.min(y + pageHpx, canvas.height);
      const bottom = safeBottom(y, ideal);
      const sliceH = Math.max(1, Math.round(bottom - y));

      const slice = document.createElement('canvas');
      slice.width  = canvas.width;
      slice.height = sliceH;
      const sctx = slice.getContext('2d');
      sctx.fillStyle = '#ffffff';
      sctx.fillRect(0, 0, slice.width, slice.height);
      sctx.drawImage(canvas, 0, y, canvas.width, sliceH, 0, 0, canvas.width, sliceH);

      if (!first) pdf.addPage();
      pdf.addImage(slice.toDataURL('image/jpeg', 0.88), 'JPEG', 0, 0,
                   pageWmm, sliceH * (pageWmm / canvas.width));
      first = false;
      y = bottom;
    }

    return pdf.output('blob');
  }

  // ── שליחה: הורדת PDF + פתיחת תיבת מייל עם נמען ──────────────────────────────
  async function _send() {
    const contacts = _project.contacts || [];
    const checked  = Array.from(
      document.querySelectorAll('#esh-contacts input[type=checkbox]:checked')
    );
    if (!checked.length) { App.toast('נא לבחור לפחות נמען אחד'); return; }

    const recipients = checked.map(cb => contacts[+cb.dataset.idx]);
    const toEmails   = recipients.map(c => c.email).join(',');
    const subject    = `דוח סיור #${_report.reportNumber} — ${_project.name}`;
    const _desc      = (_report.description || '').replace(/[\\/:*?"<>|]/g,'').replace(/\s+/g,' ').trim();
    const _proj      = (_project.name || 'DIT').replace(/[\\/:*?"<>|]/g,'').replace(/\s+/g,' ').trim();
    const pdfFname   = `${_desc || ('דוח ' + _report.reportNumber)} - ${_proj}.pdf`;

    // גוף ההודעה (טקסט פשוט — mailto לא תומך ב-HTML)
    const bodyText =
      `שלום,\n\n` +
      `מצורף דוח סיור מס' ${_report.reportNumber} מתאריך ${_report.date || ''} ` +
      `עבור פרויקט ${_project.name || ''}.\n\n` +
      `בברכה,\n` +
      `צוות DIT — Design It Right`;

    document.getElementById('email-share-overlay')?.remove();
    App.showLoading('מפיק PDF...');

    try {
      const pdfBlob = await _generatePdfBlob();
      App.hideLoading();

      // 1) הורדת ה-PDF למחשב
      const pdfUrl = URL.createObjectURL(pdfBlob);
      const a = document.createElement('a');
      a.href = pdfUrl;
      a.download = pdfFname;
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(pdfUrl), 60000);

      // 2) פתיחת תיבת מייל ב-Outlook עם נמען + נושא + גוף
      const mailto =
        `mailto:${toEmails}` +
        `?subject=${encodeURIComponent(subject)}` +
        `&body=${encodeURIComponent(bodyText)}`;

      setTimeout(() => { window.location.href = mailto; }, 500);

      App.toast(_missingImages > 0
        ? `📎 ה-PDF הורד — שים לב: ${_missingImages} תמונות לא נכללו (טעינתן נכשלה)`
        : '📎 ה-PDF הורד — גרור אותו לתוך המייל שנפתח ולחץ שלח');

    } catch (err) {
      App.hideLoading();
      App.toast('שגיאה: ' + (err?.message || String(err)));
      console.error(err);
    }
  }

  return { open, _send };
})();
window.EmailShare = EmailShare;
