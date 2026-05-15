const PdfMarkup = (() => {
  // ── LAZY PDFJS LOADER ────────────────────────────────────────────────────────
  let _pdfjsLoading = null;
  function _ensurePdfJs() {
    if (typeof pdfjsLib !== 'undefined') return Promise.resolve();
    if (_pdfjsLoading) return _pdfjsLoading;
    _pdfjsLoading = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js';
      s.onload = resolve; s.onerror = reject;
      document.head.appendChild(s);
    });
    return _pdfjsLoading;
  }

  let _planId     = null;
  let _reportId   = null;
  let _pdfDoc     = null;          // pdfjs doc (old format only)
  let _planPages  = null;          // Image[] for new rasterised format
  let _imageMode  = false;         // true when annotating a plain image (not a plan)
  let _pageNum    = 1;
  let _totalPages = 1;
  let _pdfCanvas  = null;
  let _drawCanvas = null;
  let _ctx        = null;
  let _tool       = 'pen';
  let _color      = '#dc2626';
  let _drawing    = false;
  let _startX     = 0;
  let _startY     = 0;
  let _pageStates = {};   // { pageNum: [base64, ...] } undo stack
  let _pins       = [];
  let _notes      = [];
  let _onSaveCallback = null;
  let _planName   = '';

  const COLORS = ['#dc2626', '#f97316', '#16a34a', '#2563eb', '#000000'];

  // ── OPEN FOR PLAN (from NoteModal) ───────────────────────────────────────────
  async function openForNote({ planId, reportId, onSave }) {
    _planId         = planId;
    _reportId       = reportId;
    _onSaveCallback = onSave;
    _imageMode      = false;
    _pageStates     = {};
    _pins           = [];
    _pageNum        = 1;
    _tool           = 'pen';
    _color          = '#dc2626';

    const plan = await Storage.Plans.get(planId);
    if (!plan) { App.toast('תוכנית לא נמצאה'); return; }
    _planName = plan.name;
    _notes    = await Storage.Notes.getForReport(reportId);

    _buildScreen(false);

    _pdfCanvas  = document.getElementById('markup-pdf-canvas');
    _drawCanvas = document.getElementById('markup-draw-canvas');
    _ctx        = _drawCanvas.getContext('2d');

    App.showLoading('טוען תוכנית...');
    try {
      if (plan.pages && plan.pages.length) {
        // New rasterised format — preload Image objects
        _pdfDoc    = null;
        _planPages = await Promise.all(plan.pages.map(src => {
          return new Promise(res => {
            const img = new Image();
            img.onload = () => res(img);
            img.onerror = () => res(null);
            img.src = src;
          });
        }));
        _totalPages = _planPages.length;
      } else if (plan.pdfData) {
        // Legacy raw-PDF format
        _planPages = null;
        await _ensurePdfJs();
        pdfjsLib.GlobalWorkerOptions.workerSrc =
          'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js';
        const base64 = plan.pdfData.split(',')[1];
        const binary = atob(base64);
        const bytes  = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        _pdfDoc     = await pdfjsLib.getDocument({ data: bytes }).promise;
        _totalPages = _pdfDoc.numPages;
      } else {
        throw new Error('אין נתוני תוכנית');
      }
      await _renderPage(_pageNum);
      _bindCanvasEvents();
    } catch (err) {
      App.toast('שגיאה בטעינת התוכנית');
      console.error(err);
    } finally {
      App.hideLoading();
    }
  }

  // ── OPEN FOR IMAGE (from NoteModal image annotation) ─────────────────────────
  async function openForImage({ imageData, onSave }) {
    _imageMode      = true;
    _pdfDoc         = null;
    _planPages      = null;
    _planId         = null;
    _reportId       = null;
    _onSaveCallback = onSave;
    _pageStates     = {};
    _pins           = [];
    _pageNum        = 1;
    _totalPages     = 1;
    _tool           = 'pen';
    _color          = '#dc2626';
    _notes          = [];

    _buildScreen(true);  // hidePin=true, hidePagination=true

    _pdfCanvas  = document.getElementById('markup-pdf-canvas');
    _drawCanvas = document.getElementById('markup-draw-canvas');
    _ctx        = _drawCanvas.getContext('2d');

    App.showLoading('טוען תמונה...');
    try {
      const img = await new Promise((res, rej) => {
        const i = new Image();
        i.onload  = () => res(i);
        i.onerror = () => rej(new Error('שגיאה בטעינת תמונה'));
        i.src = imageData;
      });
      const avail = _availSize();
      const scale = Math.min(avail.w / img.naturalWidth, avail.h / img.naturalHeight, 1);
      _pdfCanvas.width  = _drawCanvas.width  = Math.round(img.naturalWidth  * scale);
      _pdfCanvas.height = _drawCanvas.height = Math.round(img.naturalHeight * scale);
      _pdfCanvas.getContext('2d').drawImage(img, 0, 0, _pdfCanvas.width, _pdfCanvas.height);
      _bindCanvasEvents();
    } catch (err) {
      App.toast('שגיאה בטעינת התמונה');
      console.error(err);
    } finally {
      App.hideLoading();
    }
  }

  // ── SCREEN BUILD ─────────────────────────────────────────────────────────────
  function _buildScreen(imageMode) {
    const screen = document.getElementById('markup-screen');
    screen.classList.remove('hidden');
    screen.innerHTML = _buildUi(imageMode);
  }

  function _buildUi(imageMode) {
    const colorBtns = COLORS.map(c =>
      `<button class="markup-color-btn ${c===_color?'active':''}" style="background:${c};"
        onclick="PdfMarkup.setColor('${c}')" data-color="${c}"></button>`
    ).join('');

    const toolBtns = [
      _toolBtn('pen',    '✏️', 'עיפרון'),
      _toolBtn('marker', '🖊️', 'מרקר'),
      _toolBtn('arrow',  '➡️', 'חץ'),
      _toolBtn('text',   'T',  'טקסט'),
      ...(imageMode ? [] : [_toolBtn('pin', '📌', 'סיכה')]),
    ].join('');

    const pageNav = imageMode ? '' : `
      <div class="markup-toolbar-group" style="margin-right:auto;">
        <div class="markup-page-nav">
          <button onclick="PdfMarkup.prevPage()">‹</button>
          <span id="markup-page-info">עמוד 1</span>
          <button onclick="PdfMarkup.nextPage()">›</button>
        </div>
      </div>`;

    return `
      <div class="markup-toolbar">
        <div class="markup-toolbar-group">${toolBtns}</div>
        <div class="markup-toolbar-group">${colorBtns}</div>
        <div class="markup-toolbar-group">
          <button class="markup-tool-btn" title="בטל" onclick="PdfMarkup.undo()">↩️</button>
        </div>
        ${pageNav}
      </div>

      <div class="markup-canvas-wrap">
        <div class="markup-canvas-container" id="markup-canvas-container">
          <canvas id="markup-pdf-canvas"></canvas>
          <canvas id="markup-draw-canvas"></canvas>
          <div id="markup-pins"></div>
          <div id="markup-pin-popup" class="markup-pin-popup hidden"></div>
        </div>
      </div>

      <div class="markup-actions">
        <button class="btn btn-outline" onclick="PdfMarkup.close()">ביטול</button>
        <button class="btn btn-primary" onclick="PdfMarkup.save()">${imageMode ? 'שמור תמונה מסומנת' : 'שמור סימון להערה'}</button>
      </div>
    `;
  }

  function _toolBtn(id, icon, title) {
    return `<button class="markup-tool-btn ${_tool===id?'active':''}" title="${title}"
      onclick="PdfMarkup.setTool('${id}')" id="tool-btn-${id}">${icon}</button>`;
  }

  // ── AVAILABLE SIZE ────────────────────────────────────────────────────────────
  function _availSize() {
    const toolbarH  = 62;
    const actionsH  = 62;
    const paddingH  = 24;
    const paddingW  = 24;
    return {
      w: window.innerWidth  - paddingW,
      h: window.innerHeight - toolbarH - actionsH - paddingH,
    };
  }

  // ── RENDER PAGE ──────────────────────────────────────────────────────────────
  async function _renderPage(num) {
    const avail = _availSize();

    if (_planPages) {
      // New rasterised image format
      const img = _planPages[num - 1];
      if (!img) return;
      const scale = Math.min(avail.w / img.naturalWidth, avail.h / img.naturalHeight, 1.5);
      _pdfCanvas.width  = _drawCanvas.width  = Math.round(img.naturalWidth  * scale);
      _pdfCanvas.height = _drawCanvas.height = Math.round(img.naturalHeight * scale);
      _pdfCanvas.getContext('2d').drawImage(img, 0, 0, _pdfCanvas.width, _pdfCanvas.height);
    } else if (_pdfDoc) {
      // Legacy raw-PDF format
      const page  = await _pdfDoc.getPage(num);
      const vp1   = page.getViewport({ scale: 1 });
      const scale = Math.min(avail.w / vp1.width, avail.h / vp1.height, 2.5);
      const vp    = page.getViewport({ scale });
      _pdfCanvas.width  = _drawCanvas.width  = Math.round(vp.width);
      _pdfCanvas.height = _drawCanvas.height = Math.round(vp.height);
      await page.render({ canvasContext: _pdfCanvas.getContext('2d'), viewport: vp }).promise;
    }

    const infoEl = document.getElementById('markup-page-info');
    if (infoEl) infoEl.textContent = `עמוד ${num} / ${_totalPages}`;

    // Restore existing strokes for this page
    const states = _pageStates[num];
    _ctx.clearRect(0, 0, _drawCanvas.width, _drawCanvas.height);
    if (states?.length) {
      const img = new Image();
      await new Promise(res => { img.onload = res; img.src = states[states.length - 1]; });
      _ctx.drawImage(img, 0, 0);
    }

    _renderPins();
  }

  // ── CANVAS EVENTS ────────────────────────────────────────────────────────────
  function _bindCanvasEvents() {
    _drawCanvas.addEventListener('mousedown',  _onDown);
    _drawCanvas.addEventListener('mousemove',  _onMove);
    _drawCanvas.addEventListener('mouseup',    _onUp);
    _drawCanvas.addEventListener('touchstart', e => { e.preventDefault(); _onDown(_toMouse(e)); }, { passive: false });
    _drawCanvas.addEventListener('touchmove',  e => { e.preventDefault(); _onMove(_toMouse(e)); }, { passive: false });
    _drawCanvas.addEventListener('touchend',   e => { e.preventDefault(); _onUp(_toMouse(e));   }, { passive: false });
    _drawCanvas.addEventListener('click', _onClick);
    document.addEventListener('keydown', _onKey);
  }

  function _onKey(e) {
    if (document.getElementById('markup-screen')?.classList.contains('hidden')) return;
    if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); undo(); }
  }

  function _toMouse(e) {
    const t = e.touches[0] || e.changedTouches[0];
    return { clientX: t.clientX, clientY: t.clientY };
  }

  function _getPos(e) {
    const rect = _drawCanvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * (_drawCanvas.width  / rect.width),
      y: (e.clientY - rect.top)  * (_drawCanvas.height / rect.height),
    };
  }

  let _arrowStart = null;
  let _preArrowSnapshot = null;
  let _preArrowImg = null;    // cached Image for arrow preview redraws

  function _onDown(e) {
    if (_tool === 'text' || _tool === 'pin') return;
    _drawing = true;
    const pos = _getPos(e);
    _startX = pos.x;
    _startY = pos.y;
    if (_tool === 'pen' || _tool === 'marker') {
      _ctx.beginPath();
      _ctx.moveTo(pos.x, pos.y);
      _ctx.lineCap  = 'round';
      _ctx.lineJoin = 'round';
    }
    if (_tool === 'arrow') {
      _arrowStart = pos;
      _preArrowSnapshot = _drawCanvas.toDataURL('image/png');
      // Pre-decode the snapshot once so mousemove can drawImage immediately
      _preArrowImg = new Image();
      _preArrowImg.src = _preArrowSnapshot;
    }
  }

  function _onMove(e) {
    if (!_drawing) return;
    const pos = _getPos(e);
    _ctx.lineCap  = 'round';
    _ctx.lineJoin = 'round';
    _ctx.strokeStyle = _color;

    if (_tool === 'pen') {
      _ctx.globalAlpha = 1;
      _ctx.lineWidth   = 3;
      _ctx.lineTo(pos.x, pos.y);
      _ctx.stroke();
      _ctx.beginPath();
      _ctx.moveTo(pos.x, pos.y);
    } else if (_tool === 'marker') {
      _ctx.globalAlpha = 0.4;
      _ctx.lineWidth   = 18;
      _ctx.lineTo(pos.x, pos.y);
      _ctx.stroke();
      _ctx.beginPath();
      _ctx.moveTo(pos.x, pos.y);
    } else if (_tool === 'arrow' && _arrowStart && _preArrowImg?.complete) {
      _ctx.clearRect(0, 0, _drawCanvas.width, _drawCanvas.height);
      _ctx.globalAlpha = 1;
      _ctx.drawImage(_preArrowImg, 0, 0);
      _drawArrow(_ctx, _arrowStart.x, _arrowStart.y, pos.x, pos.y);
    }
    _ctx.globalAlpha = 1;
  }

  function _onUp() {
    if (!_drawing) return;
    _drawing = false;
    _ctx.globalAlpha = 1;
    if (_tool === 'pen' || _tool === 'marker' || _tool === 'arrow') _pushState();
    _arrowStart = null;
    _preArrowSnapshot = null;
    _preArrowImg = null;
  }

  function _onClick(e) {
    if (_tool === 'text') {
      const pos  = _getPos(e);
      const text = prompt('הזן טקסט:');
      if (!text) return;
      _ctx.font         = 'bold 18px Heebo,Arial';
      _ctx.fillStyle    = _color;
      _ctx.direction    = 'rtl';
      _ctx.globalAlpha  = 1;
      _ctx.fillText(text, pos.x, pos.y);
      _pushState();
    } else if (_tool === 'pin') {
      _showPinPopup(_getPos(e), e);
    }
  }

  // ── STROKE STATE STACK ───────────────────────────────────────────────────────
  function _pushState() {
    if (!_pageStates[_pageNum]) _pageStates[_pageNum] = [];
    _pageStates[_pageNum].push(_drawCanvas.toDataURL('image/png'));
  }

  function undo() {
    if (!_pageStates[_pageNum]?.length) return;
    _pageStates[_pageNum].pop();
    const states = _pageStates[_pageNum];
    _ctx.clearRect(0, 0, _drawCanvas.width, _drawCanvas.height);
    if (states.length > 0) {
      const img = new Image();
      img.onload = () => _ctx.drawImage(img, 0, 0);
      img.src = states[states.length - 1];
    }
  }

  // ── ARROW ────────────────────────────────────────────────────────────────────
  function _drawArrow(ctx, x1, y1, x2, y2) {
    const headlen = 16;
    const angle   = Math.atan2(y2 - y1, x2 - x1);
    ctx.lineWidth   = 3;
    ctx.strokeStyle = _color;
    ctx.fillStyle   = _color;
    ctx.globalAlpha = 1;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x2, y2);
    ctx.lineTo(x2 - headlen * Math.cos(angle - Math.PI/6), y2 - headlen * Math.sin(angle - Math.PI/6));
    ctx.lineTo(x2 - headlen * Math.cos(angle + Math.PI/6), y2 - headlen * Math.sin(angle + Math.PI/6));
    ctx.closePath();
    ctx.fill();
  }

  // ── PINS ─────────────────────────────────────────────────────────────────────
  function _renderPins() {
    const container = document.getElementById('markup-pins');
    if (!container) return;
    const pagePins = _pins.filter(p => p.page === _pageNum);
    const cRect    = _drawCanvas.getBoundingClientRect();
    const scaleX   = _drawCanvas.width  / cRect.width;
    const scaleY   = _drawCanvas.height / cRect.height;
    container.innerHTML = pagePins.map((pin, i) => {
      const note = _notes.find(n => n.id === pin.noteId);
      return `<div class="markup-pin" style="left:${pin.x/scaleX}px;top:${pin.y/scaleY}px;background:${pin.color};"
        onclick="PdfMarkup.onPinClick(${i},${pin.x/scaleX},${pin.y/scaleY},event)">
        <span>${note?.noteNumber || '?'}</span>
      </div>`;
    }).join('');
  }

  function _showPinPopup(pos, e) {
    if (_notes.length === 0) { App.toast('הוסף ממצאים תחילה'); return; }
    const popup = document.getElementById('markup-pin-popup');
    const cRect = _drawCanvas.getBoundingClientRect();
    popup.innerHTML = `
      <h4>📌 שייך לממצא:</h4>
      ${_notes.map(n => `
        <div style="padding:6px 0;border-bottom:1px solid var(--border-light);cursor:pointer;font-size:.82rem;"
          onclick="PdfMarkup.addPin(${pos.x},${pos.y},'${n.id}')">
          <strong>ממצא ${n.noteNumber}</strong> — ${n.description.slice(0,60)}
        </div>
      `).join('')}
      <button class="btn btn-ghost btn-sm" style="margin-top:8px;" onclick="PdfMarkup.closePinPopup()">ביטול</button>
    `;
    popup.style.right = Math.min(pos.x / (_drawCanvas.width  / cRect.width)  + 10, cRect.width  - 240) + 'px';
    popup.style.top   = Math.max(pos.y / (_drawCanvas.height / cRect.height) - 10, 0) + 'px';
    popup.classList.remove('hidden');
  }

  function closePinPopup() {
    document.getElementById('markup-pin-popup')?.classList.add('hidden');
  }

  function addPin(x, y, noteId) {
    closePinPopup();
    _pins.push({ x, y, noteId, color: _color, page: _pageNum });
    _renderPins();
    _ctx.beginPath();
    _ctx.arc(x, y, 10, 0, Math.PI * 2);
    _ctx.fillStyle   = _color;
    _ctx.globalAlpha = 0.7;
    _ctx.fill();
    _ctx.globalAlpha = 1;
    _pushState();
  }

  function onPinClick(idx, lx, ty) {
    const pagePins = _pins.filter(p => p.page === _pageNum);
    const pin      = pagePins[idx];
    const note     = _notes.find(n => n.id === pin?.noteId);
    if (!note) return;
    const popup = document.getElementById('markup-pin-popup');
    popup.innerHTML = `
      <h4>📌 ממצא ${note.noteNumber}</h4>
      <p style="font-size:.82rem;color:var(--text-muted);margin-bottom:8px;">${note.description.slice(0,100)}</p>
      <button class="btn btn-danger btn-sm" onclick="PdfMarkup.removePin(${idx})">הסר סיכה</button>
      <button class="btn btn-ghost btn-sm" onclick="PdfMarkup.closePinPopup()">סגור</button>
    `;
    popup.style.right = Math.min(lx + 10, _drawCanvas.clientWidth - 240) + 'px';
    popup.style.top   = Math.max(ty - 10, 0) + 'px';
    popup.classList.remove('hidden');
  }

  function removePin(idx) {
    const pagePins = _pins.filter(p => p.page === _pageNum);
    const pin = pagePins[idx];
    const gi  = _pins.indexOf(pin);
    if (gi >= 0) _pins.splice(gi, 1);
    closePinPopup();
    _renderPins();
  }

  // ── CONTROLS ─────────────────────────────────────────────────────────────────
  function setTool(t) {
    _tool = t;
    document.querySelectorAll('[id^="tool-btn-"]').forEach(btn => {
      btn.classList.toggle('active', btn.id === `tool-btn-${t}`);
    });
    _drawCanvas.style.cursor = t === 'text' ? 'text' : 'crosshair';
  }

  function setColor(c) {
    _color = c;
    document.querySelectorAll('.markup-color-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.color === c);
    });
  }

  async function prevPage() {
    if (_pageNum <= 1) return;
    _pageNum--;
    await _renderPage(_pageNum);
  }

  async function nextPage() {
    if (_pageNum >= _totalPages) return;
    _pageNum++;
    await _renderPage(_pageNum);
  }

  // ── SAVE ─────────────────────────────────────────────────────────────────────
  async function save() {
    App.showLoading('שומר...');
    try {
      const composite = document.createElement('canvas');
      composite.width  = _pdfCanvas.width;
      composite.height = _pdfCanvas.height;
      const cctx = composite.getContext('2d');
      cctx.drawImage(_pdfCanvas, 0, 0);
      cctx.drawImage(_drawCanvas, 0, 0);
      const imageData = composite.toDataURL('image/jpeg', 0.88);
      if (_onSaveCallback) _onSaveCallback(imageData, _planId, _planName);
      close();
    } catch (err) {
      App.toast('שגיאה בשמירה');
      console.error(err);
    } finally {
      App.hideLoading();
    }
  }

  function close() {
    document.removeEventListener('keydown', _onKey);
    const screen = document.getElementById('markup-screen');
    screen.classList.add('hidden');
    screen.innerHTML = '';
    _pdfDoc    = null;
    _planPages = null;
    _onSaveCallback = null;
    if (document.exitFullscreen && document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    }
  }

  return {
    openForNote, openForImage, close, save, undo,
    setTool, setColor,
    prevPage, nextPage,
    addPin, removePin, onPinClick, closePinPopup,
  };
})();
