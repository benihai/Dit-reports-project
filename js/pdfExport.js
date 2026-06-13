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
    // Served locally (not CDN) so PDF export works fully offline.
    if (typeof QRCode === 'undefined') {
      await _loadScript('js/vendor/qrcode.js?v=5.29');
    }
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

  // ── TAG CHIP (תיוג ממצא) ───────────────────────────────────────────────────────
  function tagChipHtml(tag) {
    if (!tag) return '';
    const colors = {
      'בינוי':     ['#e0edff', '#1e4fa3'],
      'מולטימדיה': ['#f1e3ff', '#6b2fb3'],
      'תקשורת':    ['#d9f5f1', '#0f766e'],
      'ביטחון':    ['#ffe1e1', '#b91c1c'],
      'פיקוח':     ['#eaf5d4', '#4a8a20'],
      'אחר':       ['#eef0f2', '#475569'],
    }[tag] || ['#eef0f2', '#475569'];
    return `<span style="display:inline-block;font-family:'Heebo',Arial,sans-serif;
              font-size:10px;font-weight:700;padding:2px 9px;border-radius:999px;
              background:${colors[0]};color:${colors[1]};white-space:nowrap;flex-shrink:0;">${esc(tag)}</span>`;
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
  function reportHeaderHtml(clientLogoSrc, clientName, report, ditLogoSrc = 'icons/dit-logo.png') {
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
            <img src="${ditLogoSrc}" alt="DIT — Design It Right"
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
              DIT — Design It Right · יעוץ, תכנון וניהול פרוייקטים טכנולוגים
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
      { ic:'tag',      k:'שם הפרויקט',        v: project?.name         || '—' },
      { ic:'users',    k:'חברת פיקוח',         v: project?.clientName   || '—' },
      { ic:'map',      k:'קומות / אזורים',   v: report.floors         || '—' },
      { ic:'calendar', k:'תאריך הסיור',       v: formatDate(report.date) || '—' },
      { ic:'user',     k:'מפקח מטעם DIT',     v: report.inspector      || '—' },
      { ic:'users',    k:'משתתפים נוספים',    v: report.participants   || '—' },
      { ic:'check',    k:'מטרת הסיור',        v: report.description    || '—' },
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
    const location = [note.floor, note.area].filter(Boolean).join(' · ');

    // ── all images in a single row, natural proportions ──
    const images = (note.mediaItems || []).filter(m => m.type === 'image');
    const imagesHtml = images.length ? `
      <div style="margin-top:14px;padding-top:12px;border-top:1px solid #E6E6E2;
                  display:flex;flex-wrap:wrap;gap:10px;">
        ${images.map(m => `
          <figure style="margin:0;flex-shrink:0;">
            <img src="${m.data}"
                 style="max-width:220px;max-height:180px;width:auto;height:auto;
                        object-fit:contain;display:block;border-radius:4px;
                        border:1px solid #D1D1CC;">
          </figure>`).join('')}
      </div>` : '';

    // ── plan markups ──
    const markupsHtml = (note.planMarkups || []).length ? `
      <div style="margin-top:12px;padding-top:12px;border-top:1px solid #E6E6E2;">
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

    // ── video QR codes ──
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

    const ref = `FIND-${String(_currentReport?.reportNumber||0).padStart(3,'0')}-${num}`;

    return `
      <article data-finding-card="1"
               style="background:#fff;border:1px solid #E6E6E2;border-radius:8px;
                      box-shadow:0 1px 2px rgba(26,26,26,.06);overflow:hidden;
                      margin-bottom:16px;page-break-inside:avoid;">

        <!-- Card head: right=badge+location, left=ref -->
        <div style="display:flex;align-items:center;justify-content:space-between;
                    padding:10px 16px;border-bottom:1px solid #E6E6E2;background:#FAFAF8;
                    direction:rtl;gap:8px;">
          <div style="display:flex;align-items:center;gap:10px;flex-wrap:nowrap;overflow:hidden;">
            <span style="font-family:monospace;font-size:11px;font-weight:700;
                         background:#1A1A1A;color:#fff;padding:3px 12px;
                         border-radius:999px;white-space:nowrap;flex-shrink:0;">ממצא ${num}</span>
            ${note.floor ? `<span style="display:flex;align-items:center;gap:4px;font-size:12px;font-weight:600;color:#3A3A3A;white-space:nowrap;">📍 ${esc(note.floor)}</span>` : ''}
            ${note.area  ? `<span style="display:flex;align-items:center;gap:4px;font-size:12px;font-weight:600;color:#3A3A3A;white-space:nowrap;">🚪 ${esc(note.area)}</span>` : ''}
            ${tagChipHtml(note.tag)}
          </div>
          <span style="font-family:monospace;font-size:10px;color:#AEAEAD;white-space:nowrap;flex-shrink:0;">${ref}</span>
        </div>

        <!-- Card body -->
        <div style="padding:12px 16px;direction:rtl;text-align:right;">
          <div style="font-family:'Heebo',Arial,sans-serif;font-size:13px;color:#1A1A1A;
                      line-height:1.7;white-space:pre-line;direction:rtl;text-align:right;">${esc(note.description).trim()}</div>
          ${note.responsible ? `<div style="margin-top:8px;font-size:12px;color:#3A3A3A;direction:rtl;text-align:right;">${icon('user',13,'#9A9A9A')} <b>אחריות:</b> ${esc(note.responsible)}</div>` : ''}
          ${imagesHtml}${markupsHtml}${videoHtml}
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
      <section dir="rtl" style="max-width:794px;margin:0 auto;padding:24px 28px 32px;
                      border-top:2px solid #1A1A1A;direction:rtl;text-align:right;">
        <h2 style="margin:0 0 14px;font-family:'Heebo',Arial,sans-serif;
                   font-weight:800;font-size:14px;letter-spacing:.12em;
                   text-transform:uppercase;color:#6FA82B;text-align:right;">סיכום והנחיות להמשך</h2>
        <div style="padding:14px 16px;background:#F6FAEC;border-radius:8px;
                    border:1px solid #BCDE85;margin-bottom:16px;">
          <p style="margin:0;font-family:'Heebo',Arial,sans-serif;font-size:14px;
                    color:#3A3A3A;line-height:1.65;white-space:pre-wrap;
                    direction:rtl;text-align:right;">${esc(summaryText).trim()}</p>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;text-align:right;">
          <div style="display:flex;flex-direction:row-reverse;gap:10px;align-items:center;">
            ${icon('calendar', 16, '#6FA82B')}
            <div style="text-align:right;">
              <div style="font-size:11px;color:#6B6B6B;font-weight:600;
                          letter-spacing:.06em;text-transform:uppercase;">תאריך הסיור</div>
              <div style="font-family:'Heebo',Arial,sans-serif;font-weight:700;
                          font-size:16px;color:#1A1A1A;margin-top:2px;">
                ${formatDate(report.date)}
              </div>
            </div>
          </div>
          <div style="display:flex;flex-direction:row-reverse;gap:10px;align-items:center;">
            ${icon('user', 16, '#6FA82B')}
            <div style="text-align:right;">
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

  async function _fetchBlob(url) {
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(resp.status);
    const blob = await resp.blob();
    return new Promise((res, rej) => {
      const reader = new FileReader();
      reader.onload  = () => res(reader.result);
      reader.onerror = () => rej();
      reader.readAsDataURL(blob);
    });
  }

  // Supabase Edge Function — server-side fetch, no CORS limits, accessible from any host
  const _PROXY = 'https://plmvrqdaxfraizlillgm.supabase.co/functions/v1/logo-proxy';

  async function _toDataUrl(url) {
    if (!url || url.startsWith('data:')) return url;
    // 1. Supabase proxy (works from GitHub Pages, Netlify, anywhere)
    try {
      const r = await _fetchBlob(`${_PROXY}?url=${encodeURIComponent(url)}`);
      if (r) return r;
    } catch (_) {}
    // 2. Direct CORS fetch (works for services that send Access-Control-Allow-Origin: *)
    try {
      const r = await _fetchBlob(url);
      if (r) return r;
    } catch (_) {}
    // 3. Canvas fallback with cache-buster
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
      img.src = url + (url.includes('?') ? '&' : '?') + '_cors=' + Date.now();
    });
  }

  // DIT logo כ-data URL (נשמר cache בזיכרון)
  let _ditLogoCache = null;
  async function _getDitLogoDataUrl() {
    if (_ditLogoCache) return _ditLogoCache;
    try {
      const r = await fetch('icons/dit-logo.png');
      if (!r.ok) throw new Error('not ok');
      const blob = await r.blob();
      _ditLogoCache = await new Promise((res, rej) => {
        const fr = new FileReader();
        fr.onload  = () => res(fr.result);
        fr.onerror = rej;
        fr.readAsDataURL(blob);
      });
    } catch(e) {
      _ditLogoCache = 'icons/dit-logo.png'; // fallback לנתיב רגיל
    }
    return _ditLogoCache;
  }

  async function buildHtml(report, notes, project, opts = {}) {
    _currentReport = report;
    const rawLogoSrc = project?.logoData || '';
    let clientLogoSrc = rawLogoSrc;
    if (rawLogoSrc && !rawLogoSrc.startsWith('data:')) {
      clientLogoSrc = (await _toDataUrl(rawLogoSrc)) || rawLogoSrc;
    }
    // המר לוגו DIT ל-data URL למנוע בעיות CORS ב-html2canvas
    const ditLogoSrc = await _getDitLogoDataUrl();
    const clientName = project?.clientName || project?.name || '';

    // באנר סינון — מוצג רק כשמפיקים דוח מסונן
    const filterBanner = opts.filterTags
      ? `<div style="max-width:794px;margin:8px auto 0;padding:8px 28px;">
           <div style="background:#F6FAEC;border:1px solid #BCDE85;border-radius:6px;
                       padding:8px 12px;font-family:'Heebo',Arial,sans-serif;font-size:12px;
                       color:#4a8a20;font-weight:700;">
             דוח מסונן · מציג ממצאים בתגיות: ${esc(opts.filterTags)}
           </div>
         </div>`
      : '';

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
            ${opts.filterTags ? 'ממצאים מסוננים' : 'ממצאים והערות'} (${notes.length})
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
      <div class="dit-report" style="font-family:'Heebo',Arial,sans-serif;direction:rtl;
                  background:#fff;color:#1A1A1A;line-height:1.5;">
        ${reportHeaderHtml(clientLogoSrc, clientName, report, ditLogoSrc)}
        ${metadataBlockHtml(report, project)}
        ${filterBanner}
        ${findingsHtml}
        ${summaryBlockHtml(report)}
        ${docFooterHtml(report, clientName)}
      </div>`;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // PREVIEW OVERLAY
  // ─────────────────────────────────────────────────────────────────────────────
  let _prevReport = null, _prevNotes = null, _prevProject = null, _prevHtml = null, _prevOpts = {};

  async function preview(report, notes, project, opts = {}) {
    App.showLoading('מכין תצוגה מקדימה...');
    try {
      await _ensureLibs();
      _prevReport  = report;
      _prevNotes   = notes;
      _prevProject = project;
      _prevOpts    = opts;
      _prevHtml    = await buildHtml(report, notes, project, opts);
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
            ⬇ שמור PDF
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
    try {
      await generate(_prevReport, _prevNotes, _prevProject, _prevOpts);
      document.getElementById('pdf-preview-overlay')?.remove();
    } catch (err) {
      App.toast('שגיאה בייצוא PDF');
      console.error(err);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // GENERATE PDF  — window.print() → real PDF with selectable text
  // Browser headers/footers are suppressed via @page { margin:0 } in the CSS.
  // User clicks "Save as PDF" in the print dialog → direct download.
  // ─────────────────────────────────────────────────────────────────────────────
  const _PRINT_CSS = `
    @import url('https://fonts.googleapis.com/css2?family=Heebo:wght@400;600;700;800&display=swap');
    *, *::before, *::after { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; background: #fff; direction: rtl; text-align: right; }

    /* margin: 0 removes browser URL/date/page-number headers and footers.
       top/bottom 10mm gives breathing room so content is not clipped at page edges. */
    @page { size: A4 portrait; margin: 10mm 0; }
    @page :first { margin-top: 0; }

    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .dit-report { padding: 0 !important; }
      [data-finding-card] {
        page-break-inside: avoid;
        break-inside: avoid;
        orphans: 4;
        widows: 4;
      }
      figure, img { page-break-inside: avoid; break-inside: avoid; }
    }
    img { max-width: 100%; }
    figure { margin: 0; }
  `;

  async function generate(report, notes, project, opts = {}) {
    await _ensureLibs();
    const html = await buildHtml(report, notes, project, opts);
    const _desc = (report.description || '').replace(/[\\/:*?"<>|]/g,'').replace(/\s+/g,' ').trim();
    const _proj = (project?.name || 'DIT').replace(/[\\/:*?"<>|]/g,'').replace(/\s+/g,' ').trim();
    const fname = `${_desc || ('דוח ' + report.reportNumber)} - ${_proj}`;

    const win = window.open('', '_blank');
    if (!win) { App.toast('יש לאפשר חלון קופץ בדפדפן'); return; }

    win.document.write(`<!DOCTYPE html>
<html dir="rtl" lang="he">
<head>
  <meta charset="utf-8">
  <title>${fname}</title>
  <style>${_PRINT_CSS}</style>
</head>
<body>${html}</body>
</html>`);
    win.document.close();

    await new Promise(resolve => {
      if (win.document.readyState === 'complete') { resolve(); return; }
      win.addEventListener('load', resolve, { once: true });
      setTimeout(resolve, 4000);
    });
    await win.document.fonts.ready.catch(() => {});

    win.focus();
    win.print();
    win.addEventListener('afterprint', () => win.close());
  }

  return { generate, preview, downloadFromPreview, buildHtml };
})();

window.PdfExport = PdfExport;
