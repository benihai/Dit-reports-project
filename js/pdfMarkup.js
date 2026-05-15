const PdfMarkup = (() => {
  let _planId     = null;
  let _reportId   = null;
  let _pdfDoc     = null;
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
  // Store strokes as rendered canvas snapshots per page (base64)
  let _pageStates = {};   // { pageNum: [base64, base64, ...] }  — stack for undo
  let _pins       = [];   // [{ x, y, noteId, color, page }]
  let _notes      = [];
  let _onSaveCallback = null;  // fn(imageBase64, planId, planName)
  let _planName   = '';

  const COLORS = ['#dc2626', '#f97316', '#16a34a', '#2563eb', '#000000'];

  // ── OPEN ────────────────────────────────────────────────────────────────────
  // openForNote: called from NoteModal to annotate a plan for a specific note
  async function openForNote({ planId, reportId, existingImage, onSave }) {
    _planId          = planId;
    _reportId        = reportId;
    _onSaveCallback  = onSave;
    _pageStates      = {};
    _pins            = [];
    _pageNum         = 1;
    _tool            = 'pen';
    _color           = '#dc2626';

    const plan = await Storage.Plans.get(planId);
    if (!plan) { App.toast('תוכנית לא נמצאה'); return; }
    _planName = plan.name;
    _notes    = await Storage.Notes.getForReport(reportId);

    const screen = document.getElementById('markup-screen');
    screen.classList.remove('hidden');
    screen.innerHTML = buildUi();

    _pdfCanvas  = document.getElementById('markup-pdf-canvas');
    _drawCanvas = document.getElementById('markup-draw-canvas');
    _ctx        = _drawCanvas.getContext('2d');

    if (typeof pdfjsLib !== 'undefined') {
      pdfjsLib.GlobalWorkerOptions.workerSrc =
        'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js';
    }

    const base64 = plan.pdfData.split(',')[1];
    const binary = atob(base64);
    const bytes  = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

    App.showLoading('טוען תוכנית...');
    try {
      _pdfDoc     = await pdfjsLib.getDocument({ data: bytes }).promise;
      _totalPages = _pdfDoc.numPages;
      await renderPage(_pageNum);
      bindCanvasEvents();
    } catch (err) {
      App.toast('שגיאה בטעינת PDF');
      console.error(err);
    } finally {
      App.hideLoading();
    }
  }

  function buildUi() {
    const colorBtns = COLORS.map(c =>
      `<button class="markup-color-btn ${c===_color?'active':''}" style="background:${c};"
        onclick="PdfMarkup.setColor('${c}')" data-color="${c}"></button>`
    ).join('');

    return `
      <div class="markup-toolbar">
        <div class="markup-toolbar-group">
          ${toolBtn('pen',   '✏️', 'עיפרון')}
          ${toolBtn('marker','🖊️', 'מרקר')}
          ${toolBtn('arrow', '➡️', 'חץ')}
          ${toolBtn('text',  'T',  'טקסט')}
          ${toolBtn('pin',   '📌', 'סיכה')}
        </div>
        <div class="markup-toolbar-group">
          ${colorBtns}
        </div>
        <div class="markup-toolbar-group">
          <button class="markup-tool-btn" title="בטל" onclick="PdfMarkup.undo()">↩️</button>
        </div>
        <div class="markup-toolbar-group" style="margin-right:auto;">
          <div class="markup-page-nav">
            <button onclick="PdfMarkup.prevPage()">‹</button>
            <span id="markup-page-info">עמוד 1</span>
            <button onclick="PdfMarkup.nextPage()">›</button>
          </div>
        </div>
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
        <button class="btn btn-primary" onclick="PdfMarkup.save()">שמור סימון להערה</button>
      </div>
    `;
  }

  function toolBtn(id, icon, title) {
    return `<button class="markup-tool-btn ${_tool===id?'active':''}" title="${title}"
      onclick="PdfMarkup.setTool('${id}')" id="tool-btn-${id}">${icon}</button>`;
  }

  // ── RENDER PAGE ─────────────────────────────────────────────────────────────
  async function renderPage(num) {
    const page     = await _pdfDoc.getPage(num);
    const maxW     = window.innerWidth * 0.9;
    const scale    = Math.min(maxW / page.getViewport({ scale: 1 }).width, 2.5);
    const viewport = page.getViewport({ scale });

    _pdfCanvas.width  = _drawCanvas.width  = viewport.width;
    _pdfCanvas.height = _drawCanvas.height = viewport.height;

    await page.render({ canvasContext: _pdfCanvas.getContext('2d'), viewport }).promise;

    document.getElementById('markup-page-info').textContent =
      `עמוד ${num} / ${_totalPages}`;

    // Restore existing strokes for this page
    const states = _pageStates[num];
    if (states && states.length > 0) {
      const img = new Image();
      await new Promise(resolve => {
        img.onload = resolve;
        img.src = states[states.length - 1];
      });
      _ctx.drawImage(img, 0, 0);
    } else {
      _ctx.clearRect(0, 0, _drawCanvas.width, _drawCanvas.height);
    }

    renderPins();
  }

  // ── CANVAS EVENTS ────────────────────────────────────────────────────────────
  function bindCanvasEvents() {
    _drawCanvas.addEventListener('mousedown',  onDown);
    _drawCanvas.addEventListener('mousemove',  onMove);
    _drawCanvas.addEventListener('mouseup',    onUp);
    _drawCanvas.addEventListener('touchstart', e => { e.preventDefault(); onDown(toMouse(e)); }, { passive: false });
    _drawCanvas.addEventListener('touchmove',  e => { e.preventDefault(); onMove(toMouse(e)); }, { passive: false });
    _drawCanvas.addEventListener('touchend',   e => { e.preventDefault(); onUp(toMouse(e)); },   { passive: false });
    _drawCanvas.addEventListener('click', onClick);
    document.addEventListener('keydown', onKey);
  }

  function onKey(e) {
    const screen = document.getElementById('markup-screen');
    if (screen.classList.contains('hidden')) return;
    if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); undo(); }
  }

  function toMouse(e) {
    const t = e.touches[0] || e.changedTouches[0];
    return { clientX: t.clientX, clientY: t.clientY };
  }

  function getPos(e) {
    const rect = _drawCanvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * (_drawCanvas.width  / rect.width),
      y: (e.clientY - rect.top)  * (_drawCanvas.height / rect.height),
    };
  }

  let _arrowStart = null;
  let _preArrowSnapshot = null;

  function onDown(e) {
    if (_tool === 'text' || _tool === 'pin') return;
    _drawing = true;
    const pos = getPos(e);
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
    }
  }

  function onMove(e) {
    if (!_drawing) return;
    const pos = getPos(e);
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
    } else if (_tool === 'arrow' && _arrowStart) {
      // Redraw from pre-arrow snapshot then draw arrow preview
      const img = new Image();
      img.src = _preArrowSnapshot;
      _ctx.clearRect(0, 0, _drawCanvas.width, _drawCanvas.height);
      _ctx.globalAlpha = 1;
      _ctx.drawImage(img, 0, 0);
      drawArrow(_ctx, _arrowStart.x, _arrowStart.y, pos.x, pos.y);
    }
    _ctx.globalAlpha = 1;
  }

  function onUp(e) {
    if (!_drawing) return;
    _drawing = false;
    _ctx.globalAlpha = 1;
    if (_tool === 'pen' || _tool === 'marker' || _tool === 'arrow') {
      pushState();
    }
    _arrowStart = null;
    _preArrowSnapshot = null;
  }

  function onClick(e) {
    if (_tool === 'text') {
      const pos  = getPos(e);
      const text = prompt('הזן טקסט:');
      if (!text) return;
      _ctx.font      = `bold 18px Heebo,Arial`;
      _ctx.fillStyle = _color;
      _ctx.direction = 'rtl';
      _ctx.globalAlpha = 1;
      _ctx.fillText(text, pos.x, pos.y);
      pushState();
    } else if (_tool === 'pin') {
      const pos = getPos(e);
      showPinPopup(pos.x, pos.y, e);
    }
  }

  // ── STROKE STATE STACK ───────────────────────────────────────────────────────
  function pushState() {
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

  // ── ARROW DRAW ───────────────────────────────────────────────────────────────
  function drawArrow(ctx, x1, y1, x2, y2) {
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
  function renderPins() {
    const container = document.getElementById('markup-pins');
    if (!container) return;
    const pagePins = _pins.filter(p => p.page === _pageNum);
    const cRect    = _drawCanvas.getBoundingClientRect();
    const scaleX   = _drawCanvas.width  / cRect.width;
    const scaleY   = _drawCanvas.height / cRect.height;

    container.innerHTML = pagePins.map((pin, i) => {
      const note = _notes.find(n => n.id === pin.noteId);
      const lx   = pin.x / scaleX;
      const ty   = pin.y / scaleY;
      return `<div class="markup-pin" style="left:${lx}px;top:${ty}px;background:${pin.color};"
        onclick="PdfMarkup.onPinClick(${i},${lx},${ty},event)">
        <span>${note?.noteNumber || '?'}</span>
      </div>`;
    }).join('');
  }

  function showPinPopup(x, y, e) {
    if (_notes.length === 0) { App.toast('הוסף ממצאים תחילה'); return; }
    const popup = document.getElementById('markup-pin-popup');
    popup.innerHTML = `
      <h4>📌 שייך לממצא:</h4>
      ${_notes.map(n => `
        <div style="padding:6px 0;border-bottom:1px solid var(--border-light);cursor:pointer;font-size:.82rem;"
          onclick="PdfMarkup.addPin(${x},${y},'${n.id}')">
          <strong>ממצא ${n.noteNumber}</strong> — ${n.description.slice(0,60)}
        </div>
      `).join('')}
      <button class="btn btn-ghost btn-sm" style="margin-top:8px;" onclick="PdfMarkup.closePinPopup()">ביטול</button>
    `;
    const cRect = _drawCanvas.getBoundingClientRect();
    popup.style.right = Math.min(x / (_drawCanvas.width / cRect.width) + 10, cRect.width - 240) + 'px';
    popup.style.top   = Math.max(y / (_drawCanvas.height / cRect.height) - 10, 0) + 'px';
    popup.classList.remove('hidden');
  }

  function closePinPopup() {
    document.getElementById('markup-pin-popup')?.classList.add('hidden');
  }

  function addPin(x, y, noteId) {
    closePinPopup();
    _pins.push({ x, y, noteId, color: _color, page: _pageNum });
    renderPins();
    // Draw a small pin mark on draw canvas
    _ctx.beginPath();
    _ctx.arc(x, y, 10, 0, Math.PI * 2);
    _ctx.fillStyle = _color;
    _ctx.globalAlpha = 0.7;
    _ctx.fill();
    _ctx.globalAlpha = 1;
    pushState();
  }

  function onPinClick(idx, lx, ty) {
    const pagePins = _pins.filter(p => p.page === _pageNum);
    const pin      = pagePins[idx];
    const note     = _notes.find(n => n.id === pin?.noteId);
    if (!note) return;
    const popup    = document.getElementById('markup-pin-popup');
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
    const pin      = pagePins[idx];
    const gi       = _pins.indexOf(pin);
    if (gi >= 0) _pins.splice(gi, 1);
    closePinPopup();
    renderPins();
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
    await renderPage(_pageNum);
  }

  async function nextPage() {
    if (_pageNum >= _totalPages) return;
    _pageNum++;
    await renderPage(_pageNum);
  }

  // ── SAVE — render composite to base64 and call callback ─────────────────────
  async function save() {
    App.showLoading('שומר...');
    try {
      // Compose: PDF page + draw layer
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
    document.removeEventListener('keydown', onKey);
    const screen = document.getElementById('markup-screen');
    screen.classList.add('hidden');
    screen.innerHTML = '';
    _pdfDoc = null;
    _onSaveCallback = null;
  }

  return {
    openForNote, close, save, undo,
    setTool, setColor,
    prevPage, nextPage,
    addPin, removePin, onPinClick, closePinPopup,
  };
})();
