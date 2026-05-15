const NoteModal = (() => {
  let _reportId    = null;
  let _projectId   = null;
  let _noteId      = null;
  let _mediaItems  = [];     // [{ type, data, name }]
  let _planMarkups = [];     // [{ planId, planName, imageData }]
  let _onSave      = null;
  let _projectPlans = [];    // available plans from project library

  function escHtml(s) {
    return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  // ── MEDIA THUMBNAILS ─────────────────────────────────────────────────────────
  function mediaThumbHtml(item, index) {
    if (item.type === 'video') {
      return `
        <div class="media-thumb">
          <video src="${item.data}" muted playsinline></video>
          <span class="video-badge">VID</span>
          <button class="remove-media" type="button" onclick="NoteModal.removeMedia(${index})">✕</button>
        </div>
      `;
    }
    return `
      <div class="media-thumb">
        <img src="${item.data}" alt="תמונה ${index + 1}">
        <button class="annotate-media" type="button" title="סמן על תמונה" onclick="NoteModal.annotateMedia(${index})">✏️</button>
        <button class="remove-media" type="button" onclick="NoteModal.removeMedia(${index})">✕</button>
      </div>
    `;
  }

  function refreshMediaGrid() {
    const grid = document.getElementById('note-media-grid');
    if (!grid) return;
    grid.innerHTML = _mediaItems.map((item, i) => mediaThumbHtml(item, i)).join('');
  }

  // ── PLAN MARKUP THUMBNAILS ───────────────────────────────────────────────────
  function planMarkupThumbHtml(pm, index) {
    return `
      <div class="media-thumb">
        <img src="${pm.imageData}" alt="${escHtml(pm.planName)}">
        <span class="video-badge" style="background:var(--green);">תוכנית</span>
        <button class="remove-media" type="button" onclick="NoteModal.removePlanMarkup(${index})">✕</button>
      </div>
    `;
  }

  function refreshPlanMarkupsGrid() {
    const grid = document.getElementById('note-plan-markups-grid');
    if (!grid) return;
    grid.innerHTML = _planMarkups.map((pm, i) => planMarkupThumbHtml(pm, i)).join('');
  }

  function planPickerHtml() {
    if (_projectPlans.length === 0) {
      return `<p class="text-sm text-muted">אין תוכניות במאגר הפרויקט — העלה תוכניות PDF מדף הפרויקט</p>`;
    }
    return `
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:6px;">
        ${_projectPlans.map(p => `
          <button type="button" class="btn btn-outline btn-sm" onclick="NoteModal.openPlanMarkup('${p.id}')">
            ${p.thumbData ? `<img src="${p.thumbData}" style="width:32px;height:24px;object-fit:cover;border-radius:2px;margin-left:4px;">` : ''}
            ${escHtml(p.name)}
          </button>
        `).join('')}
      </div>
    `;
  }

  // ── OPEN ─────────────────────────────────────────────────────────────────────
  async function open(reportId, noteId = null, onSave = null) {
    _reportId    = reportId;
    _noteId      = noteId;
    _onSave      = onSave;
    _mediaItems  = [];
    _planMarkups = [];

    const report = await Storage.Reports.get(reportId);
    _projectId   = report?.projectId || null;

    let note = null;
    if (noteId) {
      note         = await Storage.Notes.get(noteId);
      _mediaItems  = note?.mediaItems  ? [...note.mediaItems]  : [];
      _planMarkups = note?.planMarkups ? [...note.planMarkups] : [];
    }

    _projectPlans = _projectId ? await Storage.Plans.getForProject(_projectId) : [];

    let overlay = document.getElementById('note-modal-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id        = 'note-modal-overlay';
      overlay.className = 'modal-overlay';
      document.body.appendChild(overlay);
    }

    overlay.innerHTML = `
      <div class="modal-box" onclick="event.stopPropagation()">
        <div class="modal-handle"></div>
        <div class="modal-title">${noteId ? 'עריכת ממצא' : 'ממצא חדש'}</div>

        <form onsubmit="NoteModal.submit(event)" novalidate>

          <div class="form-section" style="margin-bottom:12px;">
            <div class="form-section-title">מיקום</div>
            <div class="form-row">
              <div class="form-group">
                <label>קומה</label>
                <input type="text" id="note-floor" placeholder="קומה 3" value="${escHtml(note?.floor || '')}">
              </div>
              <div class="form-group">
                <label>אזור / חדר</label>
                <input type="text" id="note-area" placeholder="חדר שינה" value="${escHtml(note?.area || '')}">
              </div>
            </div>
          </div>

          <div class="form-section" style="margin-bottom:12px;">
            <div class="form-section-title">פרטי הממצא</div>
            <div class="form-group">
              <label>תיאור הממצא <span class="required">*</span></label>
              <textarea id="note-description" placeholder="תאר את הממצא בפירוט..." rows="4">${escHtml(note?.description || '')}</textarea>
            </div>
            <div class="form-group">
              <label>אחראי לטיפול</label>
              <input type="text" id="note-responsible" placeholder="קבלן גבס / חשמלאי..." value="${escHtml(note?.responsible || '')}">
            </div>
          </div>

          <div class="form-section" style="margin-bottom:12px;">
            <div class="form-section-title">תמונות ווידאו</div>
            <div class="media-grid" id="note-media-grid">
              ${_mediaItems.map((item, i) => mediaThumbHtml(item, i)).join('')}
            </div>
            <div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap;">
              <label class="btn btn-outline btn-sm" style="cursor:pointer;">
                📷 צלם תמונה
                <input type="file" accept="image/*" capture="environment" style="display:none;"
                  onchange="NoteModal.handleMedia(event,'image')">
              </label>
              <label class="btn btn-outline btn-sm" style="cursor:pointer;">
                🎥 צלם וידאו
                <input type="file" accept="video/*" capture="environment" style="display:none;"
                  onchange="NoteModal.handleMedia(event,'video')">
              </label>
              <label class="btn btn-outline btn-sm" style="cursor:pointer;">
                🖼 גלריה
                <input type="file" accept="image/*,video/*" multiple style="display:none;"
                  onchange="NoteModal.handleMedia(event,'auto')">
              </label>
            </div>
          </div>

          <div class="form-section" style="margin-bottom:12px;">
            <div class="form-section-title">סימון על תוכנית</div>
            <div class="media-grid" id="note-plan-markups-grid">
              ${_planMarkups.map((pm, i) => planMarkupThumbHtml(pm, i)).join('')}
            </div>
            <div style="margin-top:8px;">
              ${planPickerHtml()}
            </div>
          </div>

          <div class="form-actions">
            <button type="button" class="btn btn-outline" onclick="NoteModal.close()">ביטול</button>
            <button type="submit" class="btn btn-primary">שמור ממצא</button>
          </div>
        </form>
      </div>
    `;

    overlay.classList.remove('hidden');
    overlay.onclick = (e) => { if (e.target === overlay) NoteModal.close(); };
    setTimeout(() => document.getElementById('note-description')?.focus(), 80);
  }

  // ── MEDIA HANDLING ───────────────────────────────────────────────────────────
  function _compressImage(dataUrl) {
    return new Promise(resolve => {
      const img = new Image();
      img.onload = () => {
        const MAX = 1200;
        const scale = Math.min(1, MAX / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width  = Math.round(img.width  * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.72));
      };
      img.onerror = () => resolve(dataUrl);  // fallback: keep original
      img.src = dataUrl;
    });
  }

  function handleMedia(e, typeHint) {
    const files = Array.from(e.target.files);
    e.target.value = '';
    files.forEach(file => {
      const type = typeHint === 'auto'
        ? (file.type.startsWith('video/') ? 'video' : 'image')
        : typeHint;
      const reader = new FileReader();
      reader.onload = async ev => {
        let data = ev.target.result;
        if (type === 'image') data = await _compressImage(data);
        _mediaItems.push({ type, data, name: file.name });
        refreshMediaGrid();
      };
      reader.readAsDataURL(file);
    });
  }

  function removeMedia(index) {
    _mediaItems.splice(index, 1);
    refreshMediaGrid();
  }

  function annotateMedia(index) {
    const item = _mediaItems[index];
    if (!item || item.type !== 'image') return;
    PdfMarkup.openForImage({
      imageData: item.data,
      onSave: (annotatedData) => {
        _mediaItems[index] = { ...item, data: annotatedData };
        refreshMediaGrid();
      },
    });
  }

  // ── PLAN MARKUP ──────────────────────────────────────────────────────────────
  function openPlanMarkup(planId) {
    if (!_reportId) return;
    const plan = _projectPlans.find(p => p.id === planId);
    if (!plan) return;

    // Fullscreen + Landscape — חייב להיקרא מ-user gesture
    if (document.documentElement.requestFullscreen) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else if (document.documentElement.webkitRequestFullscreen) {
      document.documentElement.webkitRequestFullscreen();
    }
    if (window.screen?.orientation?.lock) {
      window.screen.orientation.lock('landscape').catch(() => {});
    }

    PdfMarkup.openForNote({
      planId,
      reportId: _reportId,
      onSave: (imageData, pid, planName) => {
        _planMarkups.push({ planId: pid, planName, imageData });
        refreshPlanMarkupsGrid();
      },
    });
  }

  function removePlanMarkup(index) {
    _planMarkups.splice(index, 1);
    refreshPlanMarkupsGrid();
  }

  // ── SUBMIT ───────────────────────────────────────────────────────────────────
  async function submit(e) {
    e.preventDefault();
    const description = document.getElementById('note-description').value.trim();
    if (!description) { App.toast('נא לתאר את הממצא'); return; }

    const allNotes  = await Storage.Notes.getForReport(_reportId);
    const noteNumber = _noteId
      ? (allNotes.findIndex(n => n.id === _noteId) + 1 || allNotes.length)
      : allNotes.length + 1;

    const note = {
      id:          _noteId || Storage.generateId(),
      reportId:    _reportId,
      noteNumber,
      floor:       document.getElementById('note-floor').value.trim(),
      area:        document.getElementById('note-area').value.trim(),
      description,
      responsible: document.getElementById('note-responsible').value.trim(),
      mediaItems:  _mediaItems,
      planMarkups: _planMarkups,
      createdAt:   _noteId ? (allNotes.find(n => n.id === _noteId)?.createdAt ?? Date.now()) : Date.now(),
    };

    await Storage.Notes.save(note);
    close();
    App.toast(_noteId ? 'ממצא עודכן' : 'ממצא נוסף');
    if (_onSave) _onSave();
  }

  function close() {
    document.getElementById('note-modal-overlay')?.classList.add('hidden');
  }

  return { open, handleMedia, removeMedia, annotateMedia, openPlanMarkup, removePlanMarkup, submit, close };
})();
