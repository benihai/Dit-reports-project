const NoteModal = (() => {
  let _reportId    = null;
  let _projectId   = null;
  let _noteId      = null;
  let _mediaItems  = [];
  let _planMarkups = [];
  let _onSave      = null;
  let _projectPlans = [];

  function escHtml(s) {
    return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  }

  // ── אחריות → תיוג אוטומטי ─────────────────────────────────────────────────────
  // אפשרויות שדה 'אחריות' (Dropdown). 'התאמה אישית' פותח שדה טקסט חופשי.
  const CUSTOM_OPTION = 'התאמה אישית';
  const RESPONSIBILITY_OPTIONS = [
    'פיקוח', 'קבלן ראשי', 'קבלן חשמל', 'קבלן מיזוג',
    'קבלן תקשורת', 'קבלן ביטחון', 'קבלן מולטימדיה', CUSTOM_OPTION,
  ];
  // מיפוי גורם אחראי → תג
  const TAG_MAP = {
    'קבלן ראשי':     'בינוי',
    'קבלן חשמל':     'בינוי',
    'קבלן מיזוג':    'בינוי',
    'קבלן מולטימדיה':'מולטימדיה',
    'קבלן תקשורת':   'תקשורת',
    'קבלן ביטחון':   'ביטחון',
    'פיקוח':         'פיקוח',
  };
  const CUSTOM_TAG = 'אחר';
  // כל התגים האפשריים (לסדר אחיד ברכיב הסינון)
  const ALL_TAGS = ['בינוי', 'תקשורת', 'מולטימדיה', 'ביטחון', 'פיקוח', CUSTOM_TAG];
  // תג → slug באנגלית לצורך מחלקות CSS (צבעים)
  const TAG_SLUG = {
    'בינוי':'binui', 'מולטימדיה':'multimedia', 'תקשורת':'communication',
    'ביטחון':'security', 'פיקוח':'supervision', 'אחר':'other',
  };
  function tagSlug(t) { return TAG_SLUG[t] || 'other'; }
  // קביעת התג לפי הגורם האחראי שנבחר
  function tagForResponsibility(type) {
    if (type === CUSTOM_OPTION) return CUSTOM_TAG;
    return TAG_MAP[type] || '';
  }

  const _MAX_VIDEO_BYTES = 15 * 1024 * 1024;  // 15 MB — videos are stored inline as base64

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

  // ── שדה אחריות (Dropdown + טקסט חופשי + תצוגת תיוג) ──────────────────────────
  function responsibilityFieldHtml(note) {
    const savedType = note?.responsibilityType || '';
    const savedResp = note?.responsible || '';

    // שחזור הבחירה בעת עריכה (כולל ממצאים ישנים ללא responsibilityType)
    let initType = '', initCustom = '';
    if (savedType) {
      initType   = savedType;
      initCustom = (savedType === CUSTOM_OPTION) ? savedResp : '';
    } else if (savedResp) {
      if (RESPONSIBILITY_OPTIONS.includes(savedResp)) { initType = savedResp; }
      else { initType = CUSTOM_OPTION; initCustom = savedResp; }
    }

    const options = [`<option value="" ${initType ? '' : 'selected'}>— בחר גורם אחראי —</option>`]
      .concat(RESPONSIBILITY_OPTIONS.map(o =>
        `<option value="${escHtml(o)}" ${o === initType ? 'selected' : ''}>${escHtml(o)}</option>`))
      .join('');

    const customHidden = (initType === CUSTOM_OPTION) ? '' : 'hidden';
    const tag = tagForResponsibility(initType);
    const previewHidden = initType ? '' : 'hidden';

    return `
      <div class="form-group">
        <label>אחריות</label>
        <select id="note-responsibility-type" onchange="NoteModal.onResponsibilityChange()">
          ${options}
        </select>
      </div>
      <div class="form-group ${customHidden}" id="note-responsible-custom-group">
        <label>פרט את הגורם האחראי <span class="required">*</span></label>
        <input type="text" id="note-responsible-custom" placeholder="הקלד גורם אחראי..."
               value="${escHtml(initCustom)}">
      </div>
      <div class="tag-preview ${previewHidden}" id="note-tag-preview">
        תיוג אוטומטי:
        <span class="tag-badge tag-${tagSlug(tag)}" id="note-tag-badge">${escHtml(tag)}</span>
      </div>
    `;
  }

  // נקרא בכל שינוי ב-Dropdown: פתיחת/סגירת טקסט חופשי + עדכון תצוגת התג
  function onResponsibilityChange() {
    const type        = document.getElementById('note-responsibility-type')?.value || '';
    const customGroup = document.getElementById('note-responsible-custom-group');
    const customInput = document.getElementById('note-responsible-custom');
    if (customGroup) {
      const isCustom = (type === CUSTOM_OPTION);
      customGroup.classList.toggle('hidden', !isCustom);
      if (isCustom) setTimeout(() => customInput?.focus(), 50);
    }
    updateTagPreview();
  }

  // עדכון תצוגת התג האוטומטי בזמן אמת
  function updateTagPreview() {
    const preview = document.getElementById('note-tag-preview');
    const badge   = document.getElementById('note-tag-badge');
    const type    = document.getElementById('note-responsibility-type')?.value || '';
    if (!preview || !badge) return;
    if (!type) { preview.classList.add('hidden'); return; }
    const tag = tagForResponsibility(type);
    badge.textContent = tag;
    badge.className   = `tag-badge tag-${tagSlug(tag)}`;
    preview.classList.remove('hidden');
  }

  // ── OPEN ─────────────────────────────────────────────────────────────────────
  async function open(reportId, noteId = null, onSave = null) {
    _reportId    = reportId;
    _noteId      = noteId;
    _onSave      = onSave;
    _mediaItems  = [];
    _planMarkups = [];

    // Declare note outside try so it's accessible when building the HTML below
    let note = null;

    App.showLoading('טוען...');
    try {
      const report = await Storage.Reports.get(reportId);
      _projectId   = report?.projectId || null;

      // Fetch note and plans in parallel
      const [fetchedNote, plans] = await Promise.all([
        noteId ? Storage.Notes.get(noteId) : Promise.resolve(null),
        _projectId ? Storage.Plans.getForProject(_projectId) : Promise.resolve([]),
      ]);

      note = fetchedNote;
      if (note) {
        _mediaItems  = note.mediaItems  ? [...note.mediaItems]  : [];
        _planMarkups = note.planMarkups ? [...note.planMarkups] : [];
      }
      _projectPlans = plans;
    } catch (err) {
      App.toast('שגיאה בטעינת הממצא');
      App.hideLoading();
      return;
    }
    App.hideLoading();

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
            ${responsibilityFieldHtml(note)}
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
      img.onerror = () => resolve(dataUrl);
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
      // Videos are embedded inline (base64) in the note row — block oversized
      // files that would bloat the DB row and slow every load of this report.
      if (type === 'video' && file.size > _MAX_VIDEO_BYTES) {
        App.toast(`הסרטון "${file.name}" גדול מדי (מעל 15MB) — צלם סרטון קצר יותר`);
        return;
      }
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

    // אחריות + תיוג אוטומטי
    const respType = document.getElementById('note-responsibility-type')?.value || '';
    let responsible = '';
    if (respType === CUSTOM_OPTION) {
      responsible = document.getElementById('note-responsible-custom')?.value.trim() || '';
      if (!responsible) { App.toast('נא לפרט את הגורם האחראי'); return; }
    } else if (respType) {
      responsible = respType;
    }
    const tag = tagForResponsibility(respType);

    App.showLoading('שומר...');
    try {
      const allNotes = await Storage.Notes.getForReport(_reportId);
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
        responsible,
        responsibilityType: respType,
        tag,
        mediaItems:  _mediaItems,
        planMarkups: _planMarkups,
        createdAt:   _noteId ? (allNotes.find(n => n.id === _noteId)?.createdAt ?? Date.now()) : Date.now(),
      };

      await Storage.Notes.save(note);
      close();
      App.toast(_noteId ? 'ממצא עודכן' : 'ממצא נוסף');
      if (_onSave) _onSave();
    } catch (err) {
      App.toast('שגיאה בשמירת הממצא');
    } finally {
      App.hideLoading();
    }
  }

  function close() {
    document.getElementById('note-modal-overlay')?.classList.add('hidden');
  }

  return {
    open, handleMedia, removeMedia, annotateMedia, openPlanMarkup, removePlanMarkup, submit, close,
    onResponsibilityChange, updateTagPreview,
    // נחשפים ל-ReportView לצורך סינון ותצוגת תגים
    ALL_TAGS, tagSlug, tagForResponsibility,
  };
})();
