const PdfExport = (() => {

  function esc(s) {
    return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  function formatDate(d) {
    if (!d) return new Date().toLocaleDateString('he-IL');
    const [y, m, day] = d.split('-');
    return `${day}/${m}/${y}`;
  }

  // ── QR CODE ──────────────────────────────────────────────────────────────────
  function makeQrDataUrl(text) {
    return new Promise(resolve => {
      const div = document.createElement('div');
      div.style.cssText = 'position:fixed;left:-9999px;top:0;';
      document.body.appendChild(div);
      try {
        new QRCode(div, { text: text.slice(0, 300), width: 80, height: 80, correctLevel: QRCode.CorrectLevel.M });
        setTimeout(() => {
          const img = div.querySelector('img') || div.querySelector('canvas');
          const src = img?.src || (img?.toDataURL?.() ?? '');
          div.remove();
          resolve(src);
        }, 200);
      } catch {
        div.remove();
        resolve('');
      }
    });
  }

  // ── WAIT FOR IMAGES ──────────────────────────────────────────────────────────
  function waitForImages(container) {
    const imgs = Array.from(container.querySelectorAll('img'));
    return Promise.all(imgs.map(img =>
      img.complete
        ? Promise.resolve()
        : new Promise(res => { img.onload = res; img.onerror = res; })
    ));
  }

  // ── INLINE SVG ICONS ─────────────────────────────────────────────────────────
  function svgIcon(name, size = 16, color = '#9A9A9A') {
    const paths = {
      calendar: `<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>`,
      user:     `<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>`,
      users:    `<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>`,
      map:      `<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>`,
      tag:      `<path d="M20.59 13.41 13.42 20.58a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/>`,
      check:    `<polyline points="20 6 9 17 4 12"/>`,
      camera:   `<path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/>`,
    };
    return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;flex-shrink:0;">${paths[name] || ''}</svg>`;
  }

  // ── REPORT HEADER ─────────────────────────────────────────────────────────────
  function reportHeaderHtml(ditLogoSrc, clientLogoSrc, clientName, report) {
    const clientSlot = clientLogoSrc
      ? `<img src="${clientLogoSrc}" alt="${esc(clientName)}"
           style="height:56px;max-width:130px;object-fit:contain;display:block;">`
      : clientName
        ? `<div style="width:130px;min-height:56px;border:1.5px dashed #BFBFBF;border-radius:6px;
              background:repeating-linear-gradient(135deg,#FAFAF8 0 8px,#F2F2EF 8px 16px);
              display:flex;align-items:center;justify-content:center;
              font-size:11px;color:#9A9A9A;text-align:center;padding:6px;box-sizing:border-box;">
            ${esc(clientName)}
          </div>`
        : '';

    return `
      <header style="background:#fff;border-bottom:2px solid #1A1A1A;">
        <div style="height:3px;background:#8CC63F;"></div>
        <div style="display:grid;grid-template-columns:1fr 2fr 1fr;align-items:center;
                    gap:18px;padding:20px 28px;max-width:794px;margin:0 auto;
                    box-sizing:border-box;">
          <div style="display:flex;justify-content:flex-start;">
            <div style="background:#1A1A1A;border-radius:6px;padding:6px 10px;display:inline-flex;">
              <img src="${ditLogoSrc}" style="height:48px;width:auto;" alt="DIT">
            </div>
          </div>
          <div style="text-align:center;">
            <div style="font-family:'Heebo',Arial,sans-serif;font-weight:800;font-size:22px;
                        color:#1A1A1A;line-height:1.15;">דוח סיור פיקוח</div>
            <div style="font-family:Arial,sans-serif;font-size:12px;color:#6B6B6B;margin-top:4px;">
              DIT — Design It Right · ניהול ופיקוח בנייה
            </div>
            <div style="font-family:monospace;font-size:11px;color:#6B6B6B;
                        letter-spacing:.06em;margin-top:6px;">
              REP-${report.reportNumber} · ${formatDate(report.date)}
            </div>
          </div>
          <div style="display:flex;justify-content:flex-end;">
            ${clientSlot}
          </div>
        </div>
      </header>
    `;
  }

  // ── META SECTION ─────────────────────────────────────────────────────────────
  function metaSectionHtml(report, project) {
    const locationVal = [report.siteName, report.floors].filter(Boolean).join(' · ') || '—';
    const items = [
      { icon: 'tag',      label: 'שם הפרויקט',     value: project?.name || '—' },
      { icon: 'map',      label: 'מיקום / אתר',    value: locationVal },
      { icon: 'calendar', label: 'תאריך הסיור',    value: formatDate(report.date) || '—' },
      { icon: 'user',     label: 'מפקח מטעם DIT',  value: report.inspector || '—' },
      { icon: 'users',    label: 'משתתפים נוספים', value: report.participants || '—' },
      { icon: 'check',    label: 'מטרת הסיור',     value: report.description || '—' },
    ];

    const cells = items.map(it => `
      <div style="display:flex;gap:10px;align-items:flex-start;">
        <span style="margin-top:2px;">${svgIcon(it.icon, 16, '#9A9A9A')}</span>
        <div>
          <div style="font-size:10px;color:#6B6B6B;font-weight:600;letter-spacing:.06em;
                      text-transform:uppercase;margin-bottom:2px;">${it.label}</div>
          <div style="font-size:14px;color:#1A1A1A;font-weight:600;line-height:1.4;">${esc(it.value)}</div>
        </div>
      </div>
    `).join('');

    return `
      <section style="max-width:794px;margin:0 auto;padding:22px 28px 18px;
                      border-bottom:1px solid #E6E6E2;">
        <div style="font-family:'Heebo',Arial,sans-serif;font-weight:800;font-size:11px;
                    letter-spacing:.12em;text-transform:uppercase;color:#6FA82B;
                    margin-bottom:16px;">פרטי הסיור</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px 32px;">
          ${cells}
        </div>
      </section>
    `;
  }

  // ── SINGLE FINDING CARD ───────────────────────────────────────────────────────
  async function noteCardHtml(note, index) {
    const num = String(index).padStart(2, '0');
    const locationStr = [note.floor, note.area].filter(Boolean).join(' / ');

    const images     = (note.mediaItems || []).filter(m => m.type === 'image');
    const firstPhoto = images[0] || null;
    const extraPhotos = images.slice(1);

    const photoHtml = firstPhoto ? `
      <figure style="margin:0;">
        <div style="height:160px;border-radius:4px;border:1px solid #D1D1CC;overflow:hidden;">
          <img src="${firstPhoto.data}" style="width:100%;height:100%;object-fit:cover;display:block;">
        </div>
        ${locationStr ? `<figcaption style="font-size:11px;color:#6B6B6B;margin-top:6px;
          display:flex;align-items:center;gap:4px;">
          ${svgIcon('camera', 12, '#9A9A9A')} ${esc(locationStr)}
        </figcaption>` : ''}
      </figure>
    ` : '';

    const extraPhotosHtml = extraPhotos.length ? `
      <div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:10px;padding-top:10px;
                  border-top:1px solid #E6E6E2;">
        ${extraPhotos.map(m => `
          <div style="width:160px;height:120px;border-radius:4px;border:1px solid #D1D1CC;
                      overflow:hidden;flex-shrink:0;">
            <img src="${m.data}" style="width:100%;height:100%;object-fit:cover;display:block;">
          </div>
        `).join('')}
      </div>
    ` : '';

    const planMarkupsHtml = (note.planMarkups || []).length ? `
      <div style="margin-top:10px;padding-top:10px;border-top:1px solid #E6E6E2;">
        <div style="font-size:10px;color:#6B6B6B;font-weight:600;letter-spacing:.06em;
                    text-transform:uppercase;margin-bottom:8px;">תוכניות מסומנות</div>
        <div style="display:flex;flex-wrap:wrap;gap:10px;">
          ${note.planMarkups.map(pm => `
            <div>
              <img src="${pm.imageData}" alt="${esc(pm.planName)}"
                style="max-width:250px;max-height:175px;object-fit:contain;display:block;
                       border:1px solid #D1D1CC;border-radius:4px;">
              <div style="font-size:10px;color:#6B6B6B;text-align:center;margin-top:3px;">
                ${esc(pm.planName)}
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    ` : '';

    const videos = (note.mediaItems || []).filter(m => m.type === 'video');
    let videoQrHtml = '';
    if (videos.length) {
      const qrItems = [];
      for (const v of videos) {
        const qr = await makeQrDataUrl(v.name || 'video');
        qrItems.push({ name: v.name, qr });
      }
      videoQrHtml = `
        <div style="margin-top:10px;padding-top:10px;border-top:1px solid #E6E6E2;
                    display:flex;flex-wrap:wrap;gap:8px;">
          ${qrItems.map(qi => `
            <div style="display:flex;align-items:center;gap:10px;padding:8px 12px;
                        border:1px solid #D1D1CC;border-radius:6px;">
              ${qi.qr ? `<img src="${qi.qr}" style="width:56px;height:56px;">` : ''}
              <div>
                <div style="font-size:10px;color:#6B6B6B;font-weight:600;">סרטון</div>
                <div style="font-size:13px;font-weight:700;color:#1A1A1A;">${esc(qi.name || 'וידאו')}</div>
                <div style="font-size:10px;color:#9A9A9A;">סרוק QR לצפייה</div>
              </div>
            </div>
          `).join('')}
        </div>
      `;
    }

    const hasExtraMedia = extraPhotosHtml || planMarkupsHtml || videoQrHtml;

    const footerParts = [];
    if (note.responsible) footerParts.push(`<span>באחריות: <b style="color:#1A1A1A;">${esc(note.responsible)}</b></span>`);
    if (locationStr)       footerParts.push(`<span>${esc(locationStr)}</span>`);

    return `
      <article style="background:#fff;border:1px solid #E6E6E2;border-radius:8px;
                      box-shadow:0 1px 2px rgba(26,26,26,.06);overflow:hidden;
                      margin-bottom:20px;page-break-inside:avoid;">
        <div style="display:flex;align-items:center;gap:14px;
                    padding:14px 18px;border-bottom:1px solid #E6E6E2;">
          <span style="font-family:monospace;font-size:11px;font-weight:700;
                       background:#1A1A1A;color:#fff;padding:4px 12px;
                       border-radius:999px;letter-spacing:.04em;white-space:nowrap;
                       flex-shrink:0;">ממצא ${num}</span>
          <div style="flex:1;font-family:'Heebo',Arial,sans-serif;font-weight:700;
                      font-size:15px;color:#1A1A1A;line-height:1.3;">
            ${locationStr
              ? `<span style="display:inline;font-size:13px;color:#6B6B6B;font-weight:500;
                   margin-inline-end:6px;">${esc(locationStr)} —</span>`
              : ''}
            ${esc(note.description).split('\n')[0] || ''}
          </div>
        </div>

        <div style="display:grid;grid-template-columns:${firstPhoto ? '1.5fr 1fr' : '1fr'};
                    gap:18px;padding:16px 18px;">
          <div style="font-size:14px;color:#3A3A3A;line-height:1.65;white-space:pre-wrap;">
            ${esc(note.description)}
          </div>
          ${photoHtml}
        </div>

        ${hasExtraMedia ? `
          <div style="padding:0 18px 16px;">${extraPhotosHtml}${planMarkupsHtml}${videoQrHtml}</div>
        ` : ''}

        ${footerParts.length ? `
          <div style="display:flex;gap:16px;align-items:center;flex-wrap:wrap;
                      padding:12px 18px;background:#FAFAF8;border-top:1px solid #E6E6E2;
                      font-size:13px;color:#6B6B6B;">
            ${footerParts.join(`<span style="color:#D1D1CC;">·</span>`)}
          </div>
        ` : ''}
      </article>
    `;
  }

  // ── BUILD FULL HTML ──────────────────────────────────────────────────────────
  async function buildHtml(report, notes, project) {
    const ditLogoSrc    = 'icons/logo.svg';
    const clientLogoSrc = project?.logoData || '';
    const clientName    = project?.clientName || project?.name || '';

    const header = reportHeaderHtml(ditLogoSrc, clientLogoSrc, clientName, report);
    const meta   = metaSectionHtml(report, project);

    let findingsHtml;
    if (notes.length > 0) {
      const cards = [];
      for (let i = 0; i < notes.length; i++) {
        cards.push(await noteCardHtml(notes[i], i + 1));
      }
      findingsHtml = `
        <section style="max-width:794px;margin:0 auto;padding:24px 28px 8px;">
          <div style="font-family:'Heebo',Arial,sans-serif;font-weight:800;font-size:11px;
                      letter-spacing:.12em;text-transform:uppercase;color:#6FA82B;
                      margin-bottom:16px;">ממצאים והערות (${notes.length})</div>
          ${cards.join('')}
        </section>
      `;
    } else {
      findingsHtml = `
        <section style="max-width:794px;margin:0 auto;padding:24px 28px;">
          <p style="color:#6B6B6B;font-size:14px;">לא נרשמו ממצאים בסיור זה.</p>
        </section>
      `;
    }

    const docFooter = `
      <footer style="display:flex;justify-content:space-between;align-items:center;
                     padding:14px 28px;background:#1A1A1A;color:#fff;
                     font-family:Arial,sans-serif;font-size:12px;margin-top:8px;">
        <span>דוח #${report.reportNumber} · ${formatDate(report.date)}</span>
        <span style="color:#8CC63F;font-weight:800;letter-spacing:.04em;">DIT</span>
        <span>Design It Right · dit.co.il</span>
      </footer>
    `;

    return `
      <div style="font-family:'Heebo',Arial,'Assistant',sans-serif;direction:rtl;
                  background:#fff;color:#1A1A1A;line-height:1.5;">
        ${header}
        ${meta}
        ${findingsHtml}
        ${docFooter}
      </div>
    `;
  }

  // ── PREVIEW ───────────────────────────────────────────────────────────────────
  let _prevReport = null, _prevNotes = null, _prevProject = null;

  async function preview(report, notes, project) {
    App.showLoading('מכין תצוגה מקדימה...');
    try {
      _prevReport  = report;
      _prevNotes   = notes;
      _prevProject = project;
      const html = await buildHtml(report, notes, project);
      _showPreviewOverlay(report, html);
    } catch (err) {
      App.toast('שגיאה בטעינת תצוגה מקדימה');
      console.error(err);
    } finally {
      App.hideLoading();
    }
  }

  function _showPreviewOverlay(report, html) {
    document.getElementById('pdf-preview-overlay')?.remove();

    const overlay = document.createElement('div');
    overlay.id = 'pdf-preview-overlay';
    overlay.style.cssText =
      'position:fixed;inset:0;z-index:900;display:flex;flex-direction:column;';

    overlay.innerHTML = `
      <div style="background:#1A1A1A;padding:10px 16px;display:flex;align-items:center;
        justify-content:space-between;border-bottom:3px solid #8CC63F;flex-shrink:0;
        font-family:'Heebo',Arial,sans-serif;">
        <div style="color:#fff;font-weight:700;font-size:.95rem;">
          דוח #${report.reportNumber} — תצוגה מקדימה
        </div>
        <div style="display:flex;gap:8px;">
          <button onclick="PdfExport.downloadFromPreview()"
            style="background:#8CC63F;color:#fff;border:none;border-radius:5px;
            padding:8px 20px;font-weight:700;cursor:pointer;font-family:inherit;font-size:.88rem;">
            ⬇ הורד PDF
          </button>
          <button onclick="document.getElementById('pdf-preview-overlay').remove()"
            style="background:rgba(255,255,255,.12);color:#fff;
            border:1.5px solid rgba(255,255,255,.25);border-radius:5px;
            padding:8px 14px;font-weight:600;cursor:pointer;font-family:inherit;font-size:.88rem;">
            ✕ סגור
          </button>
        </div>
      </div>
      <div style="flex:1;overflow:auto;background:#EFEEEA;padding:20px;
        display:flex;flex-direction:column;align-items:center;">
        <div style="background:#fff;width:100%;max-width:880px;
          border:1px solid #E6E6E2;box-shadow:0 8px 24px rgba(26,26,26,.1);
          min-height:600px;">
          ${html}
        </div>
      </div>
    `;

    document.body.appendChild(overlay);
  }

  async function downloadFromPreview() {
    if (!_prevReport) return;
    App.showLoading('מייצר PDF...');
    try {
      await generate(_prevReport, _prevNotes, _prevProject);
      document.getElementById('pdf-preview-overlay')?.remove();
    } catch (err) {
      App.toast('שגיאה בייצוא PDF');
      console.error(err);
    } finally {
      App.hideLoading();
    }
  }

  // ── GENERATE PDF ─────────────────────────────────────────────────────────────
  async function generate(report, notes, project) {
    const html = await buildHtml(report, notes, project);

    const container = document.getElementById('pdf-template');
    container.innerHTML = html;
    await waitForImages(container);

    const canvas = await html2canvas(container, {
      scale:           2,
      useCORS:         true,
      allowTaint:      true,
      backgroundColor: '#ffffff',
      logging:         false,
    });

    const { jsPDF } = window.jspdf;
    const pdf    = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageW  = pdf.internal.pageSize.getWidth();
    const pageH  = pdf.internal.pageSize.getHeight();
    const ratio  = pageW / canvas.width;
    let rendered = 0;
    let page     = 0;

    while (rendered < canvas.height) {
      if (page > 0) pdf.addPage();
      const sliceH = Math.min(pageH / ratio, canvas.height - rendered);
      const slice  = document.createElement('canvas');
      slice.width  = canvas.width;
      slice.height = sliceH;
      slice.getContext('2d').drawImage(canvas, 0, rendered, canvas.width, sliceH, 0, 0, canvas.width, sliceH);
      pdf.addImage(slice.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, pageW, sliceH * ratio);
      rendered += sliceH;
      page++;
    }

    container.innerHTML = '';

    const fname = `דוח-${report.reportNumber}-${(project?.name || 'DIT').replace(/\s+/g, '-')}.pdf`;
    pdf.save(fname);
  }

  return { generate, preview, downloadFromPreview };
})();
