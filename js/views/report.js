const ReportView = (() => {
  let _reportId  = null;
  let _projectId = null;
  let _fab       = null;
  let _allNotes  = [];            // כל הממצאים בדוח (מקור הסינון)
  let _activeTags = new Set();    // התגים הפעילים בסינון

  function escHtml(s) {
    return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  }

  function formatDate(d) {
    if (!d) return '';
    const [y, m, day] = d.split('-');
    return `${day}/${m}/${y}`;
  }

  let _readOnly = false;

  // ── RENDER ──────────────────────────────────────────────────────────────────
  async function render({ reportId }, { readOnly = false } = {}) {
    _reportId = reportId;
    _readOnly = readOnly;

    const report = await Storage.Reports.get(reportId);
    if (!report) { Router.navigate('/'); return; }
    _projectId = report.projectId;

    const [project, notes] = await Promise.all([
      Storage.Projects.get(report.projectId),
      Storage.Notes.getForReport(reportId),
    ]);
    const person = project?.personId ? await Storage.People.get(project.personId) : null;

    _allNotes   = notes;
    _activeTags = new Set();

    App.setHeader(`דוח #${report.reportNumber}`, true, `
      <button class="btn btn-outline btn-sm" onclick="ReportView.exportPdf()">
        <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" viewBox="0 0 24 24">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
          <polyline points="14 2 14 8 20 8"/>
          <line x1="16" y1="13" x2="8" y2="13"/>
          <line x1="16" y1="17" x2="8" y2="17"/>
        </svg>
        PDF
      </button>
      <button class="btn btn-outline btn-sm" onclick="ReportView.shareEmail()">📧 שתף במייל</button>
    `);

    const container = document.getElementById('view-container');
    const breadcrumb = readOnly
      ? `<div class="breadcrumb">
           <span class="breadcrumb-item" onclick="Router.navigate('/')">הדוחות שלי</span>
           <span class="breadcrumb-sep">›</span>
           <span class="breadcrumb-current">דוח #${report.reportNumber}</span>
         </div>`
      : Auth.isAdmin()
        ? `<div class="breadcrumb">
             <span class="breadcrumb-item" onclick="Router.navigate('/')">דף הבית</span>
             <span class="breadcrumb-sep">›</span>
             <span class="breadcrumb-item" onclick="Router.navigate('/person/${person?.id || ''}')">${escHtml(person?.name || '')}</span>
             <span class="breadcrumb-sep">›</span>
             <span class="breadcrumb-item" onclick="Router.navigate('/project/${project?.id || ''}')">${escHtml(project?.name || '')}</span>
             <span class="breadcrumb-sep">›</span>
             <span class="breadcrumb-current">דוח #${report.reportNumber}</span>
           </div>`
        : `<div class="breadcrumb">
             <span class="breadcrumb-item" onclick="Router.navigate('/')">דף הבית</span>
             <span class="breadcrumb-sep">›</span>
             <span class="breadcrumb-item" onclick="Router.navigate('/project/${project?.id || ''}')">${escHtml(project?.name || '')}</span>
             <span class="breadcrumb-sep">›</span>
             <span class="breadcrumb-current">דוח #${report.reportNumber}</span>
           </div>`;

    container.innerHTML = breadcrumb + headerSectionHtml(report) + notesSectionHtml(notes);

    if (!readOnly) attachFab(reportId);
  }

  // ── HEADER SECTION (editable) ────────────────────────────────────────────────
  function headerSectionHtml(report) {
    const editBtn = _readOnly ? '' :
      `<button class="btn btn-ghost btn-sm" onclick="ReportView.toggleEditHeader()" id="edit-header-btn">✏️ ערוך</button>`;
    return `
      <div class="form-section" id="report-header-section">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;">
          <div class="form-section-title" style="margin-bottom:0;">פרטי הדוח</div>
          ${editBtn}
        </div>
        <div id="header-view-mode">
          ${headerViewHtml(report)}
        </div>
        <div id="header-edit-mode" class="hidden">
          ${headerEditHtml(report)}
        </div>
      </div>
    `;
  }

  function headerViewHtml(r) {
    return `
      <table class="info-table">
        <tr><td>תיאור הסיור</td><td>${escHtml(r.description || '—')}</td></tr>
        <tr><td>קומות / אזורים</td><td>${escHtml(r.floors || '—')}</td></tr>
        <tr><td>תאריך</td><td>${formatDate(r.date) || '—'}</td></tr>
        <tr><td>מבצע הסיור מטעם DIT</td><td>${escHtml(r.inspector || '—')}</td></tr>
        <tr><td>משתתפים</td><td>${escHtml(r.participants || '—')}</td></tr>
        <tr><td>סיכום והנחיות להמשך</td><td>${escHtml(r.summary || '—')}</td></tr>
      </table>
    `;
  }

  function headerEditHtml(r) {
    return `
      <div class="form-group">
        <label>תיאור הסיור</label>
        <textarea id="edit-description" rows="3">${escHtml(r.description || '')}</textarea>
      </div>
      <div class="form-group">
        <label>קומות / אזורים</label>
        <input type="text" id="edit-floors" placeholder="קומה 3, גג" value="${escHtml(r.floors || '')}">
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>תאריך</label>
          <input type="date" id="edit-date" value="${escHtml(r.date || '')}">
        </div>
        <div class="form-group">
          <label>מבצע הסיור מטעם DIT</label>
          <input type="text" id="edit-inspector" value="${escHtml(r.inspector || '')}">
        </div>
      </div>
      <div class="form-group">
        <label>משתתפים</label>
        <input type="text" id="edit-participants" placeholder="שמות המשתתפים..." value="${escHtml(r.participants || '')}">
      </div>
      <div class="form-group">
        <label>סיכום והנחיות להמשך</label>
        <textarea id="edit-summary" rows="3" placeholder="הוסף סיכום כללי והנחיות להמשך...">${escHtml(r.summary || '')}</textarea>
      </div>
      <div class="form-actions" style="margin-top:10px;">
        <button type="button" class="btn btn-outline btn-sm" onclick="ReportView.cancelEditHeader()">ביטול</button>
        <button type="button" class="btn btn-primary btn-sm" onclick="ReportView.saveHeader()">שמור</button>
      </div>
    `;
  }

  function toggleEditHeader() {
    document.getElementById('header-view-mode').classList.toggle('hidden');
    document.getElementById('header-edit-mode').classList.toggle('hidden');
    document.getElementById('edit-header-btn').textContent =
      document.getElementById('header-edit-mode').classList.contains('hidden') ? '✏️ ערוך' : '✕';
  }

  function cancelEditHeader() {
    document.getElementById('header-view-mode').classList.remove('hidden');
    document.getElementById('header-edit-mode').classList.add('hidden');
    document.getElementById('edit-header-btn').textContent = '✏️ ערוך';
  }

  async function saveHeader() {
    const report = await Storage.Reports.get(_reportId);
    report.description  = document.getElementById('edit-description')?.value.trim()  || '';
    report.floors       = document.getElementById('edit-floors')?.value.trim()        || '';
    report.date         = document.getElementById('edit-date')?.value                 || '';
    report.inspector    = document.getElementById('edit-inspector')?.value.trim()     || '';
    report.participants = document.getElementById('edit-participants')?.value.trim()  || '';
    report.summary      = document.getElementById('edit-summary')?.value.trim()       || '';
    await Storage.Reports.save(report);
    document.getElementById('header-view-mode').innerHTML = headerViewHtml(report);
    cancelEditHeader();
    App.toast('פרטי הדוח עודכנו');
  }

  // ── NOTES SECTION ────────────────────────────────────────────────────────────
  function notesSectionHtml(notes) {
    return `
      <div class="section-header">
        <div class="section-title">
          <svg width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.2" viewBox="0 0 24 24">
            <path d="M9 11l3 3L22 4"/>
            <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
          </svg>
          ממצאים
        </div>
        <span class="badge badge-green" id="notes-count-badge">${notes.length}</span>
      </div>
      <div id="notes-area">${notesAreaHtml(notes)}</div>
    `;
  }

  // ── סינון: סרגל תגים + רשימה ──────────────────────────────────────────────────
  function notesAreaHtml(notes) {
    return filterBarHtml(notes)
      + `<div class="notes-container" id="notes-list">${listInnerHtml(_filtered(notes))}</div>`;
  }

  function listInnerHtml(notes) {
    if (_allNotes.length === 0) return emptyNotesHtml();
    if (notes.length === 0) {
      return `<div class="empty-state" style="padding:24px 16px;">
        <h3>אין ממצאים בסינון הנוכחי</h3>
        <p>בחר תגים אחרים או נקה את הסינון</p>
      </div>`;
    }
    return notes.map((n, i) => noteCardHtml(n, i + 1)).join('');
  }

  // הצגת רק ממצאים שתואמים את התגים הפעילים (ריק = הכל)
  function _filtered(notes) {
    if (_activeTags.size === 0) return notes;
    return notes.filter(n => _activeTags.has(n.tag));
  }

  function filterBarHtml(notes) {
    // הצג צ'יפ רק לתגים שקיימים בפועל בדוח, לפי סדר קבוע
    const present = NoteModal.ALL_TAGS.filter(t => notes.some(n => n.tag === t));
    if (present.length === 0) return '';

    const chips = present.map(t => {
      const count  = notes.filter(n => n.tag === t).length;
      const active = _activeTags.has(t);
      return `<button type="button" class="filter-chip tag-${NoteModal.tagSlug(t)} ${active ? 'active' : ''}"
                onclick="ReportView.toggleTag('${t}')">
                ${escHtml(t)} <span class="filter-chip-count">${count}</span>
              </button>`;
    }).join('');

    const clearHidden = _activeTags.size ? '' : 'hidden';
    return `
      <div class="notes-filter-bar" id="notes-filter-bar">
        <div class="notes-filter-chips">${chips}</div>
        <div class="notes-filter-actions">
          <button type="button" class="btn btn-ghost btn-sm ${clearHidden}" id="filter-clear-btn"
                  onclick="ReportView.clearTags()">נקה סינון</button>
          <button type="button" class="btn btn-outline btn-sm" onclick="ReportView.exportFiltered()">
            📄 הפק דוח מסונן
          </button>
        </div>
      </div>`;
  }

  function rerenderNotesArea() {
    const area = document.getElementById('notes-area');
    if (area) area.innerHTML = notesAreaHtml(_allNotes);
    const badge = document.getElementById('notes-count-badge');
    if (badge) {
      const shown = _filtered(_allNotes).length;
      badge.textContent = _activeTags.size ? `${shown}/${_allNotes.length}` : _allNotes.length;
    }
  }

  function toggleTag(tag) {
    if (_activeTags.has(tag)) _activeTags.delete(tag);
    else _activeTags.add(tag);
    rerenderNotesArea();
  }

  function clearTags() {
    _activeTags.clear();
    rerenderNotesArea();
  }

  function emptyNotesHtml() {
    return `
      <div class="empty-state" style="padding:30px 16px;">
        <svg width="40" height="40" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
          <path d="M9 11l3 3L22 4"/>
          <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
        </svg>
        <h3>אין ממצאים עדיין</h3>
        <p>לחץ על + להוספת ממצא ראשון</p>
      </div>
    `;
  }

  function noteCardHtml(note, noteNum) {
    // Media thumbnails (images + videos)
    const mediaHtml = note.mediaItems?.length
      ? `<div class="media-grid" style="margin-top:8px;">
           ${note.mediaItems.slice(0, 4).map((m, i) => {
             if (m.type === 'video') {
               return `<div class="media-thumb" onclick="ReportView.openLightbox('${note.id}',${i},'media')">
                 <video src="${m.data}" muted></video>
                 <span class="video-badge">VID</span>
               </div>`;
             }
             return `<div class="media-thumb" onclick="ReportView.openLightbox('${note.id}',${i},'media')">
               <img src="${m.data}" alt="">
             </div>`;
           }).join('')}
           ${note.mediaItems.length > 4
             ? `<div class="media-thumb" style="background:var(--green-light);display:flex;align-items:center;justify-content:center;font-weight:700;color:var(--green-dark);">+${note.mediaItems.length - 4}</div>`
             : ''}
         </div>`
      : '';

    // Plan markup thumbnails
    const planMarkupsHtml = note.planMarkups?.length
      ? `<div class="media-grid" style="margin-top:8px;">
           ${note.planMarkups.map((pm, i) => `
             <div class="media-thumb" onclick="ReportView.openLightbox('${note.id}',${i},'plan')">
               <img src="${pm.imageData}" alt="${escHtml(pm.planName)}">
               <span class="video-badge" style="background:var(--green);">תוכנית</span>
             </div>
           `).join('')}
         </div>`
      : '';

    const done = note.status === 'done';
    const task = !!note.personalTask;

    // Status-tracking footer: complete toggle, personal-task toggle, and a
    // free-text status note. Editable for admins; read-only viewers just see
    // the "done" badge and any status note text.
    const trackHtml = _readOnly ? (note.statusNote
        ? `<div class="note-status-ro">📋 ${escHtml(note.statusNote)}</div>` : '')
      : `
        <div class="note-track" onclick="event.stopPropagation()">
          <div class="note-track-actions">
            <button class="track-btn done-toggle${done ? ' active' : ''}" onclick="ReportView.toggleComplete('${note.id}')">
              ${done ? '✓ הושלם' : 'סמן כהושלם'}
            </button>
            <button class="track-btn task-toggle${task ? ' active' : ''}" onclick="ReportView.togglePersonalTask('${note.id}')">
              ${task ? '★ במעקב אישי' : '☆ הוסף למעקב'}
            </button>
          </div>
          <textarea class="status-note-input" placeholder="סטטוס ביצוע — מה מעכב? דגשים להשלמה…"
            onfocus="event.stopPropagation()"
            onblur="ReportView.saveStatusNote('${note.id}', this.value)">${escHtml(note.statusNote)}</textarea>
        </div>`;

    return `
      <div class="note-card${done ? ' note-card-done' : ''}" onclick="ReportView.editNote('${note.id}')">
        <div class="note-card-header">
          <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
            <span class="note-number">ממצא ${noteNum || note.noteNumber || '?'}</span>
            ${done ? '<span class="done-badge">✓ הושלם</span>' : ''}
            ${note.tag ? `<span class="tag-badge tag-${NoteModal.tagSlug(note.tag)}">${escHtml(note.tag)}</span>` : ''}
          </div>
          ${_readOnly ? '' : `
          <div style="display:flex;gap:4px;" onclick="event.stopPropagation()">
            <button class="btn-icon-sm" title="ערוך" onclick="ReportView.editNote('${note.id}')">
              <svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
            </button>
            <button class="btn-icon-sm" title="מחק" onclick="ReportView.deleteNote('${note.id}')">
              <svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <polyline points="3 6 5 6 21 6"/>
                <path d="M19 6l-1 14H6L5 6"/>
                <path d="M9 6V4h6v2"/>
              </svg>
            </button>
          </div>`}
        </div>
        ${note.floor || note.area ? `
          <div class="note-location">
            ${note.floor ? `<span>📍 ${escHtml(note.floor)}</span>` : ''}
            ${note.area  ? `<span>🚪 ${escHtml(note.area)}</span>`  : ''}
          </div>` : ''}
        <div class="note-description">${escHtml(note.description)}</div>
        ${note.responsible ? `<div class="note-responsible">👷 אחראי: ${escHtml(note.responsible)}</div>` : ''}
        ${mediaHtml}
        ${planMarkupsHtml}
        ${trackHtml}
      </div>
    `;
  }

  // ── STATUS TRACKING (per finding) ────────────────────────────────────────────
  // Each handler mutates the in-memory note (so _allNotes stays current) and
  // persists via Storage.Notes.save — which is fully offline-aware (optimistic
  // local write + queued upsert that syncs when connectivity returns).
  function _findNote(id) { return _allNotes.find(n => n.id === id); }

  async function toggleComplete(noteId) {
    const note = _findNote(noteId);
    if (!note) return;
    note.status = note.status === 'done' ? 'open' : 'done';
    await Storage.Notes.save(note);
    App.toast(note.status === 'done' ? 'סומן כהושלם' : 'הוחזר לפתוח');
    rerenderNotesArea();
  }

  async function togglePersonalTask(noteId) {
    const note = _findNote(noteId);
    if (!note) return;
    note.personalTask = !note.personalTask;
    await Storage.Notes.save(note);
    App.toast(note.personalTask ? 'נוסף למשימות אישיות' : 'הוסר מהמשימות האישיות');
    rerenderNotesArea();
  }

  async function saveStatusNote(noteId, value) {
    const note = _findNote(noteId);
    if (!note || (note.statusNote || '') === (value || '')) return;  // skip no-op
    note.statusNote = value;
    await Storage.Notes.save(note);
  }

  async function refreshNotes() {
    _allNotes = await Storage.Notes.getForReport(_reportId);
    // הסר מהסינון תגים שכבר לא קיימים באף ממצא
    _activeTags.forEach(t => {
      if (!_allNotes.some(n => n.tag === t)) _activeTags.delete(t);
    });
    rerenderNotesArea();
  }

  function editNote(noteId) {
    NoteModal.open(_reportId, noteId, () => refreshNotes());
  }

  async function deleteNote(noteId) {
    App.confirm('למחוק ממצא זה?', async () => {
      await Storage.Notes.delete(noteId, _reportId);
      App.toast('ממצא נמחק');
      await refreshNotes();
    });
  }

  // ── LIGHTBOX ────────────────────────────────────────────────────────────────
  async function openLightbox(noteId, mediaIndex, source) {
    const note = await Storage.Notes.get(noteId);
    let item;
    if (source === 'plan') {
      const pm = note?.planMarkups?.[mediaIndex];
      if (!pm) return;
      item = { type: 'image', data: pm.imageData };
    } else {
      item = note?.mediaItems?.[mediaIndex];
      if (!item) return;
    }

    const lb = document.createElement('div');
    lb.className = 'lightbox';
    lb.innerHTML = item.type === 'video'
      ? `<video src="${item.data}" controls autoplay style="max-width:95vw;max-height:85vh;"></video>`
      : `<img src="${item.data}" alt="">`;
    lb.innerHTML += `<button class="lightbox-close" onclick="this.closest('.lightbox').remove()">✕</button>`;
    lb.onclick = (e) => { if (e.target === lb) lb.remove(); };
    document.body.appendChild(lb);
  }

  // ── PDF EXPORT ───────────────────────────────────────────────────────────────
  async function exportPdf() {
    const report  = await Storage.Reports.get(_reportId);
    const notes   = await Storage.Notes.getForReport(_reportId);
    const project = await Storage.Projects.get(report.projectId);
    await PdfExport.preview(report, notes, project);
  }

  // הפקת דוח רק עבור הממצאים המוצגים כעת לאחר סינון
  async function exportFiltered() {
    const notes = _filtered(_allNotes);
    if (!notes.length) { App.toast('אין ממצאים להצגה בסינון הנוכחי'); return; }
    const report  = await Storage.Reports.get(_reportId);
    const project = await Storage.Projects.get(report.projectId);
    const tagsLabel = _activeTags.size ? [...NoteModal.ALL_TAGS].filter(t => _activeTags.has(t)).join(', ') : '';
    await PdfExport.preview(report, notes, project, { filterTags: tagsLabel });
  }

  // ── EMAIL SHARE ──────────────────────────────────────────────────────────────
  async function shareEmail() {
    const report  = await Storage.Reports.get(_reportId);
    const notes   = await Storage.Notes.getForReport(_reportId);
    const project = await Storage.Projects.get(report.projectId);
    EmailShare.open(report, notes, project);
  }

  // ── FAB ──────────────────────────────────────────────────────────────────────
  function attachFab(reportId) {
    if (_fab) _fab.remove();
    _fab = document.createElement('button');
    _fab.className = 'fab';
    _fab.title     = 'הוסף ממצא';
    _fab.innerHTML = `<svg width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
      <line x1="12" y1="5" x2="12" y2="19"/>
      <line x1="5" y1="12" x2="19" y2="12"/>
    </svg>`;
    _fab.onclick = () => NoteModal.open(reportId, null, () => refreshNotes());
    document.body.appendChild(_fab);
  }

  function cleanup() {
    if (_fab) { _fab.remove(); _fab = null; }
  }

  return {
    render, cleanup,
    toggleEditHeader, cancelEditHeader, saveHeader,
    editNote, deleteNote,
    toggleComplete, togglePersonalTask, saveStatusNote,
    openLightbox, exportPdf, shareEmail,
    toggleTag, clearTags, exportFiltered,
  };
})();
