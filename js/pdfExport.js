const PdfExport = (() => {

  // ── LAZY SCRIPT LOADER ───────────────────────────────────────────────────────
  const _loaded = {};
  function _loadScript(src) {
    if (_loaded[src]) return _loaded[src];
    _loaded[src] = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src; s.onload = resolve; s.onerror = reject;
      document.head.appendChild(s);
    });
    return _loaded[src];
  }

  async function _ensureLibs() {
    await Promise.all([
      typeof html2canvas !== 'undefined' ? Promise.resolve()
        : _loadScript('https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js'),
      typeof window.jspdf !== 'undefined' ? Promise.resolve()
        : _loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js'),
      typeof QRCode !== 'undefined' ? Promise.resolve()
        : _loadScript('https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js'),
    ]);
  }

  // ── HELPERS ──────────────────────────────────────────────────────────────────
  function esc(s) {
    return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  function formatDate(d) {
    if (!d) return new Date().toLocaleDateString('he-IL');
    const [y, m, day] = d.split('-');
    return `${day}/${m}/${y}`;
  }

  // First line of a description → card "title"
  function shortTitle(text) {
    if (!text) return '—';
    const first = text.split('\n')[0].trim();
    return first.length > 90 ? first.slice(0, 87) + '…' : first;
  }

  // ── INLINE SVG ICONS ─────────────────────────────────────────────────────────
  function icon(name, size = 16, color = '#9A9A9A') {
    const d = {
      calendar: `<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>`,
      user:     `<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>`,
      users:    `<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>`,
      map:      `<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>`,
      tag:      `<path d="M20.59 13.41 13.42 20.58a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/>`,
      check:    `<polyline points="20 6 9 17 4 12"/>`,
      camera:   `<path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/>`,
    };
    return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none"
      stroke="${color}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"
      style="display:inline-block;vertical-align:middle;flex-shrink:0;">${d[name]||''}</svg>`;
  }

  // ── QR CODE ──────────────────────────────────────────────────────────────────
  function makeQrDataUrl(text) {
    return new Promise(resolve => {
      const div = document.createElement('div');
      div.style.cssText = 'position:fixed;left:-9999px;top:0;';
      document.body.appendChild(div);
      try {
        new QRCode(div, { text: text.slice(0, 300), width: 80, height: 80, correctLevel: QRCode.CorrectLevel.M });
        const img    = div.querySelector('img');
        const canvas = div.querySelector('canvas');
        if (img) {
          // Wait for real load event instead of arbitrary 200ms delay
          const done = () => { div.remove(); resolve(img.src || ''); };
          if (img.complete && img.src) done();
          else { img.onload = done; img.onerror = () => { div.remove(); resolve(''); }; }
        } else {
          const src = canvas?.toDataURL?.() ?? '';
          div.remove(); resolve(src);
        }
      } catch { div.remove(); resolve(''); }
    });
  }

  // ── WAIT FOR IMAGES ──────────────────────────────────────────────────────────
  function waitForImages(container) {
    const imgs = Array.from(container.querySelectorAll('img'));
    return Promise.all(imgs.map(img =>
      img.complete ? Promise.resolve()
        : new Promise(res => { img.onload = res; img.onerror = res; })
    ));
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // REPORT HEADER
  // 3-column: [DIT logo] | [centered title] | [client logo slot]
  // ─────────────────────────────────────────────────────────────────────────────
  function reportHeaderHtml(clientLogoSrc, clientName, report) {
    const clientSlot = clientLogoSrc
      ? `<img src="${clientLogoSrc}" alt="${esc(clientName)}"
           style="height:60px;width:auto;max-width:140px;object-fit:contain;display:block;">`
      : `<div style="width:130px;height:68px;
              border:1.5px dashed #BFBFBF;border-radius:6px;
              background:repeating-linear-gradient(135deg,#FAFAF8 0 8px,#F2F2EF 8px 16px);
              display:flex;align-items:center;justify-content:center;
              font-size:10px;color:#9A9A9A;letter-spacing:.04em;
              text-align:center;line-height:1.3;padding:4px;box-sizing:border-box;">
           ${esc(clientName || 'לוגו פרויקט / לקוח')}
         </div>`;

    return `
      <header style="background:#fff;border-bottom:2px solid #1A1A1A;">
        <div style="height:3px;background:#8CC63F;"></div>
        <div style="display:grid;grid-template-columns:1fr 2fr 1fr;align-items:center;
                    gap:18px;padding:22px 28px;max-width:794px;
                    margin:0 auto;box-sizing:border-box;">

          <!-- DIT logo — right in RTL -->
          <div style="display:flex;justify-content:flex-start;">
            <img src="icons/dit-logo.png" alt="DIT — Design It Right"
                 style="height:64px;width:auto;display:block;">
          </div>

          <!-- Centered title -->
          <div style="text-align:center;">
            <div style="font-family:'Heebo',Arial,sans-serif;font-weight:800;
                        font-size:24px;color:#1A1A1A;line-height:1.15;">
              דוח סיור פיקוח עליון
            </div>
            <div style="font-family:Arial,sans-serif;font-size:13px;
                        color:#6B6B6B;margin-top:4px;">
              DIT — Design It Right · ניהול ופיקוח בנייה
            </div>
            <div style="font-family:monospace;font-size:11px;color:#6B6B6B;
                        letter-spacing:.06em;margin-top:6px;">
              REP-${String(report.reportNumber).padStart(4,'0')} · ${formatDate(report.date)}
            </div>
          </div>

          <!-- Client logo — left in RTL -->
          <div style="display:flex;justify-content:flex-end;">
            ${clientSlot}
          </div>
        </div>
      </header>`;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // METADATA BLOCK  — 2-column grid with icon + label + value
  // ─────────────────────────────────────────────────────────────────────────────
  function metadataBlockHtml(report, project) {
    const items = [
      { ic:'tag',      k:'שם הפרויקט',     v: project?.name       || '—' },
      { ic:'map',      k:'קומות / אזורים', v: report.floors       || '—' },
      { ic:'calendar', k:'תאריך הסיור',    v: formatDate(report.date) || '—' },
      { ic:'user',     k:'מפקח מטעם DIT',  v: report.inspector    || '—' },
      { ic:'users',    k:'משתתפים נוספים', v: report.participants || '—' },
      { ic:'check',    k:'מטרת הסיור',     v: report.description  || '—' },
    ];

    const cells = items.map(it => `
      <div style="display:flex;gap:10px;align-items:flex-start;">
        <span style="margin-top:2px;">${icon(it.ic, 16, '#9A9A9A')}</span>
        <div style="min-width:0;">
          <div style="font-size:11px;color:#6B6B6B;font-weight:600;
                      letter-spacing:.06em;text-transform:uppercase;
                      margin-bottom:2px;">${it.k}</div>
          <div style="font-size:15px;color:#1A1A1A;font-weight:600;line-height:1.4;">
            ${esc(it.v)}
          </div>
        </div>
      </div>`).join('');

    return `
      <section style="max-width:794px;margin:0 auto;
                      padding:22px 28px 16px;border-bottom:1px solid #E6E6E2;">
        <h2 style="margin:0 0 14px;font-family:'Heebo',Arial,sans-serif;
                   font-weight:800;font-size:14px;letter-spacing:.12em;
                   text-transform:uppercase;color:#6FA82B;">פרטי הסיור</h2>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px 32px;">
          ${cells}
        </div>
      </section>`;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // SINGLE FINDING CARD  (async — handles video QR codes)
  // ─────────────────────────────────────────────────────────────────────────────
  async function findingCardHtml(note, index) {
    const num      = String(index).padStart(2, '0');
    const title    = shortTitle(note.description);
    const location = [note.floor, note.area].filter(Boolean).join(' / ');

    // ── media ──
    const images     = (note.mediaItems || []).filter(m => m.type === 'image');
    const firstPhoto = images[0] || null;
    const extraImgs  = images.slice(1);

    const photoHtml = firstPhoto ? `
      <figure style="margin:0;">
        <div style="height:160px;border-radius:4px;border:1px solid #D1D1CC;overflow:hidden;">
          <img src="${firstPhoto.data}"
               style="width:100%;height:100%;object-fit:cover;display:block;">
        </div>
        <figcaption style="font-size:11px;color:#6B6B6B;margin-top:6px;
                           display:flex;align-items:center;gap:6px;">
          ${icon('camera', 12, '#9A9A9A')}
          ${esc(location || 'תמונת שטח')}
        </figcaption>
      </figure>` : '';

    const extraHtml = extraImgs.length ? `
      <div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:10px;
                  padding-top:10px;border-top:1px solid #E6E6E2;">
        ${extraImgs.map(m => `
          <div style="width:155px;height:115px;border-radius:4px;
                      border:1px solid #D1D1CC;overflow:hidden;flex-shrink:0;">
            <img src="${m.data}" style="width:100%;height:100%;object-fit:cover;display:block;">
          </div>`).join('')}
      </div>` : '';

    // ── plan markups ──
    const markupsHtml = (note.planMarkups || []).length ? `
      <div style="margin-top:10px;padding-top:10px;border-top:1px solid #E6E6E2;">
        <div style="font-size:10px;color:#6B6B6B;font-weight:600;
                    letter-spacing:.06em;text-transform:uppercase;
                    margin-bottom:8px;">תוכניות מסומנות</div>
        <div style="display:flex;flex-wrap:wrap;gap:10px;">
          ${note.planMarkups.map(pm => `
            <div>
              <img src="${pm.imageData}" alt="${esc(pm.planName)}"
                style="max-width:250px;max-height:175px;object-fit:contain;display:block;
                       border:1px solid #D1D1CC;border-radius:4px;">
              <div style="font-size:10px;color:#6B6B6B;text-align:center;margin-top:3px;">
                ${esc(pm.planName)}
              </div>
            </div>`).join('')}
        </div>
      </div>` : '';

    // ── video QR codes — generated in parallel ──
    const videos = (note.mediaItems || []).filter(m => m.type === 'video');
    let videoHtml = '';
    if (videos.length) {
      const items = await Promise.all(videos.map(async v => {
        const qr = await makeQrDataUrl(v.name || 'video');
        return { name: v.name, qr };
      }));
      videoHtml = `
        <div style="margin-top:10px;padding-top:10px;border-top:1px solid #E6E6E2;
                    display:flex;flex-wrap:wrap;gap:8px;">
          ${items.map(qi => `
            <div style="display:flex;align-items:center;gap:10px;padding:8px 12px;
                        border:1px solid #D1D1CC;border-radius:6px;">
              ${qi.qr ? `<img src="${qi.qr}" style="width:56px;height:56px;">` : ''}
              <div>
                <div style="font-size:10px;color:#6B6B6B;font-weight:600;">סרטון</div>
                <div style="font-size:13px;font-weight:700;color:#1A1A1A;">${esc(qi.name||'וידאו')}</div>
                <div style="font-size:10px;color:#9A9A9A;">סרוק QR לצפייה</div>
              </div>
            </div>`).join('')}
        </div>`;
    }

    const hasExtra = extraHtml || markupsHtml || videoHtml;

    // ── footer items ──
    const footerParts = [];
    if (note.responsible)
      footerParts.push(`<span>באחריות: <b style="color:#1A1A1A;">${esc(note.responsible)}</b></span>`);
    const ref = `FIND-${String(_currentReport?.reportNumber||0).padStart(3,'0')}-${num}`;
    footerParts.push(`<span style="font-family:monospace;font-size:11px;">${ref}</span>`);

    return `
      <article style="background:#fff;border:1px solid #E6E6E2;border-radius:8px;
                      box-shadow:0 1px 2px rgba(26,26,26,.06);overflow:hidden;
                      margin-bottom:24px;page-break-inside:avoid;">

        <!-- Card head -->
        <div style="display:flex;align-items:center;gap:14px;
                    padding:14px 18px;border-bottom:1px solid #E6E6E2;">
          <span style="font-family:monospace;font-size:11px;font-weight:700;
                       background:#1A1A1A;color:#fff;padding:4px 12px;
                       border-radius:999px;letter-spacing:.04em;
                       white-space:nowrap;flex-shrink:0;">ממצא ${num}</span>
          <h3 style="margin:0;font-family:'Heebo',Arial,sans-serif;font-weight:700;
                     font-size:18px;color:#1A1A1A;flex:1;line-height:1.3;">
            ${esc(title)}
          </h3>
        </div>

        <!-- Card body: description + first photo -->
        <div style="display:grid;
                    grid-template-columns:${firstPhoto ? '1.5fr 1fr' : '1fr'};
                    gap:18px;padding:16px 18px;">
          <div style="font-family:'Heebo',Arial,sans-serif;font-size:14px;
                      color:#3A3A3A;line-height:1.65;white-space:pre-wrap;">
            ${esc(note.description)}
          </div>
          ${photoHtml}
        </div>

        ${hasExtra ? `<div style="padding:0 18px 14px;">${extraHtml}${markupsHtml}${videoHtml}</div>` : ''}

        <!-- Card footer -->
        <div style="display:flex;gap:20px;align-items:center;flex-wrap:wrap;
                    padding:12px 18px;background:#FAFAF8;
                    border-top:1px solid #E6E6E2;
                    font-family:Arial,sans-serif;font-size:13px;color:#6B6B6B;">
          ${footerParts.join(`<span style="color:#D1D1CC;">·</span>`)}
        </div>
      </article>`;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // SUMMARY / SIGN-OFF BLOCK
  // ─────────────────────────────────────────────────────────────────────────────
  function summaryBlockHtml(report) {
    if (!report.inspector && !report.summary) return '';
    const summaryText = report.summary || 'לא הוזן סיכום';
    return `
      <section style="max-width:794px;margin:0 auto;padding:24px 28px 32px;
                      border-top:2px solid #1A1A1A;">
        <h2 style="margin:0 0 14px;font-family:'Heebo',Arial,sans-serif;
                   font-weight:800;font-size:14px;letter-spacing:.12em;
                   text-transform:uppercase;color:#6FA82B;">סיכום והנחיות להמשך</h2>
        <div style="padding:14px 16px;background:#F6FAEC;border-radius:8px;
                    border:1px solid #BCDE85;margin-bottom:16px;">
          <p style="margin:0;font-family:'Heebo',Arial,sans-serif;font-size:14px;
                    color:#3A3A3A;line-height:1.65;white-space:pre-wrap;">
            ${esc(summaryText)}
          </p>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
          <div style="display:flex;gap:10px;align-items:center;">
            ${icon('calendar', 16, '#6FA82B')}
            <div>
              <div style="font-size:11px;color:#6B6B6B;font-weight:600;
                          letter-spacing:.06em;text-transform:uppercase;">תאריך הסיור</div>
              <div style="font-family:'Heebo',Arial,sans-serif;font-weight:700;
                          font-size:16px;color:#1A1A1A;margin-top:2px;">
                ${formatDate(report.date)}
              </div>
            </div>
          </div>
          <div style="display:flex;gap:10px;align-items:center;">
            ${icon('user', 16, '#6FA82B')}
            <div>
              <div style="font-size:11px;color:#6B6B6B;font-weight:600;
                          letter-spacing:.06em;text-transform:uppercase;">נחתם על ידי</div>
              <div style="font-family:'Heebo',Arial,sans-serif;font-weight:700;
                          font-size:16px;color:#1A1A1A;margin-top:2px;">
                ${esc(report.inspector)}
              </div>
            </div>
          </div>
        </div>
      </section>`;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // DOCUMENT FOOTER  — dark bar
  // ─────────────────────────────────────────────────────────────────────────────
  function docFooterHtml(report, clientName) {
    return `
      <footer style="display:flex;justify-content:space-between;align-items:center;
                     padding:14px 28px;background:#1A1A1A;color:#fff;
                     font-family:Arial,sans-serif;font-size:12px;">
        <span>דוח #${report.reportNumber} · ${formatDate(report.date)}</span>
        <span><span style="color:#8CC63F;font-weight:800;letter-spacing:.04em;">DIT</span> · Design It Right</span>
        ${clientName ? `<span style="color:rgba(255,255,255,.55);">${esc(clientName)}</span>` : '<span></span>'}
      </footer>`;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // BUILD FULL HTML  (async)
  // ─────────────────────────────────────────────────────────────────────────────
  // We need reportNumber accessible inside findingCardHtml, so keep a module ref
  let _currentReport = null;

  function _toDataUrl(url) {
    if (!url || url.startsWith('data:')) return Promise.resolve(url);
    return new Promise(resolve => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        try {
          const c = document.createElement('canvas');
          c.width = img.naturalWidth || 128;
          c.height = img.naturalHeight || 128;
          c.getContext('2d').drawImage(img, 0, 0);
          resolve(c.toDataURL('image/png'));
        } catch (_) { resolve(''); }
      };
      img.onerror = () => resolve('');
      // Cache-buster forces a fresh CORS-enabled request, bypassing any
      // cached non-CORS response left by the earlier image-test load.
      img.src = url + (url.includes('?') ? '&' : '?') + '_cors=' + Date.now();
    });
  }

  async function buildHtml(report, notes, project) {
    _currentReport = report;
    const clientLogoSrc = project?.logoData || '';
    const clientName    = project?.clientName || project?.name || '';

    // findings section
    let findingsHtml;
    if (notes.length > 0) {
      const cards = [];
      for (let i = 0; i < notes.length; i++) {
        cards.push(await findingCardHtml(notes[i], i + 1));
      }
      findingsHtml = `
        <section style="max-width:794px;margin:0 auto;padding:24px 28px 8px;">
          <h2 style="margin:0 0 16px;font-family:'Heebo',Arial,sans-serif;
                     font-weight:800;font-size:14px;letter-spacing:.12em;
                     text-transform:uppercase;color:#6FA82B;">
            ממצאים והערות (${notes.length})
          </h2>
          ${cards.join('')}
        </section>`;
    } else {
      findingsHtml = `
        <section style="max-width:794px;margin:0 auto;padding:24px 28px;">
          <p style="font-size:14px;color:#6B6B6B;">לא נרשמו ממצאים בסיור זה.</p>
        </section>`;
    }

    return `
      <div style="font-family:'Heebo',Arial,sans-serif;direction:rtl;
                  background:#fff;color:#1A1A1A;line-height:1.5;">
        ${reportHeaderHtml(clientLogoSrc, clientName, report)}
        ${metadataBlockHtml(report, project)}
        ${findingsHtml}
        ${summaryBlockHtml(report)}
        ${docFooterHtml(report, clientName)}
      </div>`;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // PREVIEW OVERLAY
  // ─────────────────────────────────────────────────────────────────────────────
  let _prevReport = null, _prevNotes = null, _prevProject = null, _prevHtml = null;

  async function preview(report, notes, project) {
    App.showLoading('מכין תצוגה מקדימה...');
    try {
      await _ensureLibs();
      _prevReport  = report;
      _prevNotes   = notes;
      _prevProject = project;
      _prevHtml    = await buildHtml(report, notes, project);
      _showPreviewOverlay(report, _prevHtml);
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
      <div style="flex:1;overflow:auto;background:#EFEEEA;padding:24px;
        display:flex;flex-direction:column;align-items:center;">
        <div style="background:#fff;width:100%;max-width:880px;
          border:1px solid #E6E6E2;
          box-shadow:0 8px 24px rgba(26,26,26,.10);">
          ${html}
        </div>
      </div>`;

    document.body.appendChild(overlay);
  }

  async function downloadFromPreview() {
    if (!_prevReport) return;
    App.showLoading('מייצר PDF...');
    try {
      // Reuse the already-built HTML — no need to regenerate QR codes etc.
      await generate(_prevReport, _prevNotes, _prevProject, _prevHtml);
      document.getElementById('pdf-preview-overlay')?.remove();
    } catch (err) {
      App.toast('שגיאה בייצוא PDF');
      console.error(err);
    } finally {
      App.hideLoading();
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // GENERATE PDF  (html2canvas → jsPDF slicing)
  // ─────────────────────────────────────────────────────────────────────────────
  async function _inlineExternalImages(container) {
    const imgs = Array.from(container.querySelectorAll('img[src]'));
    await Promise.all(imgs.map(async img => {
      const src = img.getAttribute('src');
      if (src && !src.startsWith('data:') && !src.startsWith('blob:')) {
        const dataUrl = await _toDataUrl(src);
        if (dataUrl) img.src = dataUrl;
      }
    }));
  }

  async function generate(report, notes, project, prebuiltHtml = null) {
    await _ensureLibs();
    const html = prebuiltHtml || await buildHtml(report, notes, project);

    const container = document.getElementById('pdf-template');
    container.innerHTML = html;
    await _inlineExternalImages(container);
    await waitForImages(container);

    const canvas = await html2canvas(container, {
      scale:           1.5,   // was 2 (4× pixels); 1.5 reduces processing ~44% at still-sharp quality
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
    let rendered = 0, page = 0;

    while (rendered < canvas.height) {
      if (page > 0) pdf.addPage();
      const sliceH = Math.min(pageH / ratio, canvas.height - rendered);
      const slice  = document.createElement('canvas');
      slice.width  = canvas.width;
      slice.height = sliceH;
      slice.getContext('2d').drawImage(
        canvas, 0, rendered, canvas.width, sliceH,
        0, 0, canvas.width, sliceH
      );
      pdf.addImage(slice.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, pageW, sliceH * ratio);
      rendered += sliceH;
      page++;
    }

    container.innerHTML = '';

    const fname = `דוח-${report.reportNumber}-${(project?.name || 'DIT').replace(/\s+/g,'-')}.pdf`;
    pdf.save(fname);
  }

  return { generate, preview, downloadFromPreview };
})();

window.PdfExport = PdfExport;
