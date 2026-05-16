const ReportView = (() => {
  let _reportId  = null;
  let _projectId = null;
  let _fab       = null;

  function escHtml(s) {
    return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
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
    `);

    const container = document.getElementById('view-container');
    const breadcrumb = readOnly
      ? `<div class="breadcrumb">
           <span class="breadcrumb-item" onclick="Router.navigate('/')">הדוחות שלי</span>
           <span class="breadcrumb-sep">›</span>
           <span class="breadcrumb-current">דוח #${report.reportNumber}</span>
         </div>`
      : `<div class="breadcrumb">
           <span class="breadcrumb-item" onclick="Router.navigate('/')">דף הבית</span>
           <span class="breadcrumb-sep">›</span>
           <span class="breadcrumb-item" onclick="Router.navigate('/person/${person?.id || ''}')">${escHtml(person?.name || '')}</span>
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
      <div class="notes-container" id="notes-list">
        ${notes.length === 0 ? emptyNotesHtml() : notes.map((n, i) => noteCardHtml(n, i + 1)).join('')}
      </div>
    `;
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

    return `
      <div class="note-card" onclick="ReportView.editNote('${note.id}')">
        <div class="note-card-header">
          <span class="note-number">ממצא ${noteNum || note.noteNumber || '?'}</span>
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
      </div>
    `;
  }

  async function refreshNotes() {
    const notes = await Storage.Notes.getForReport(_reportId);
    const list  = document.getElementById('notes-list');
    const badge = document.getElementById('notes-count-badge');
    if (list)  list.innerHTML    = notes.length === 0 ? emptyNotesHtml() : notes.map((n, i) => noteCardHtml(n, i + 1)).join('');
    if (badge) badge.textContent = notes.length;
  }

  function editNote(noteId) {
    NoteModal.open(_reportId, noteId, () => refreshNotes());
  }

  async function deleteNote(noteId) {
    App.confirm('למחוק ממצא זה?', async () => {
      await Storage.Notes.delete(noteId);
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
    openLightbox, exportPdf,
  };
})();
