const ReportsView = (() => {
  let _projectId = null;

  function escHtml(s) {
    return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  function formatDate(d) {
    if (!d) return '';
    const [y, m, day] = d.split('-');
    return `${day}/${m}/${y}`;
  }

  function reportCardHtml(report, noteCount) {
    return `
      <div class="report-card" onclick="Router.navigate('/report/${report.id}')">
        <div class="report-card-header">
          <span class="report-number-badge">דוח #${report.reportNumber}</span>
          <span class="report-card-title">${escHtml(report.siteName || report.description || 'דוח סיור')}</span>
          <span class="badge badge-gray">${noteCount} ממצאים</span>
        </div>
        <div class="report-card-meta">
          ${report.date      ? `<span class="meta-item">📅 ${formatDate(report.date)}</span>`    : ''}
          ${report.inspector ? `<span class="meta-item">👤 ${escHtml(report.inspector)}</span>` : ''}
          ${report.floors    ? `<span class="meta-item">🏢 ${escHtml(report.floors)}</span>`    : ''}
        </div>
        <div class="report-card-actions" onclick="event.stopPropagation()">
          <button class="btn btn-outline btn-sm" onclick="Router.navigate('/report/${report.id}')">פתח</button>
          <button class="btn btn-outline btn-sm" onclick="ReportsView.exportPdf('${report.id}',event)">ייצא PDF</button>
          <button class="btn-icon-sm" title="מחק" onclick="ReportsView.deleteReport('${report.id}',event)">
            <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <polyline points="3 6 5 6 21 6"/>
              <path d="M19 6l-1 14H6L5 6"/>
              <path d="M9 6V4h6v2"/>
            </svg>
          </button>
        </div>
      </div>
    `;
  }

  function planThumbHtml(plan) {
    return `
      <div class="plan-card">
        ${plan.thumbData
          ? `<img class="plan-thumb" src="${plan.thumbData}" alt="תוכנית">`
          : `<div class="plan-thumb-placeholder">
               <svg width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
                 <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                 <polyline points="14 2 14 8 20 8"/>
               </svg>
             </div>`}
        <div class="plan-info">
          <div class="plan-name">${escHtml(plan.name)}</div>
        </div>
        <div class="plan-actions">
          <button class="btn-icon-sm" title="מחק תוכנית" onclick="ReportsView.deletePlan('${plan.id}')">
            <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <polyline points="3 6 5 6 21 6"/>
              <path d="M19 6l-1 14H6L5 6"/>
              <path d="M9 6V4h6v2"/>
            </svg>
          </button>
        </div>
      </div>
    `;
  }

  function planLibrarySectionHtml(plans) {
    return `
      <div class="section-header" style="margin-top:20px;">
        <div class="section-title">
          <svg width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.2" viewBox="0 0 24 24">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
          </svg>
          מאגר תוכניות
        </div>
        <label class="btn btn-outline btn-sm" style="cursor:pointer;">
          + העלה תוכנית
          <input type="file" accept="application/pdf" multiple style="display:none;"
            onchange="ReportsView.uploadPlan(event)">
        </label>
      </div>
      <div id="plans-library-list" style="padding-bottom:24px;">
        ${plans.length === 0
          ? `<p class="text-sm text-muted" style="padding:12px 0;">אין תוכניות במאגר — העלה קובץ PDF לשימוש בהערות</p>`
          : plans.map(planThumbHtml).join('')}
      </div>
    `;
  }

  async function render({ projectId }) {
    _projectId = projectId;
    const project = await Storage.Projects.get(projectId);
    if (!project) { Router.navigate('/'); return; }
    const person = await Storage.People.get(project.personId);

    App.setHeader(project.name, true, `
      <button class="btn btn-primary btn-sm" onclick="ReportsView.newReport('${projectId}')">
        + דוח
      </button>
    `);

    const [reports, plans] = await Promise.all([
      Storage.Reports.getForProject(projectId),
      Storage.Plans.getForProject(projectId),
    ]);
    const noteCounts = await Promise.all(
      reports.map(r => Storage.Notes.getForReport(r.id).then(l => l.length))
    );

    const container = document.getElementById('view-container');

    const logoHtml = project.logoData
      ? `<img src="${project.logoData}" alt="${escHtml(project.clientName)}"
           style="height:32px;max-width:80px;object-fit:contain;border:1px solid var(--border-light);
                  border-radius:4px;padding:2px 6px;background:white;margin-bottom:10px;">`
      : '';

    const breadcrumb = `
      <div class="breadcrumb">
        <span class="breadcrumb-item" onclick="Router.navigate('/')">דף הבית</span>
        <span class="breadcrumb-sep">›</span>
        <span class="breadcrumb-item" onclick="Router.navigate('/person/${project.personId}')">${escHtml(person?.name || '')}</span>
        <span class="breadcrumb-sep">›</span>
        <span class="breadcrumb-current">${escHtml(project.name)}</span>
      </div>
    `;

    const reportsHtml = reports.length === 0
      ? `<div class="empty-state" style="padding:30px 16px;">
           <svg width="40" height="40" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
             <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
             <polyline points="14 2 14 8 20 8"/>
           </svg>
           <h3>אין דוחות עדיין</h3>
           <p>לחץ על "+ דוח" ליצירת דוח סיור ראשון</p>
         </div>`
      : `<div class="screen-title">
           <span>דוחות סיור</span>
           <span class="badge badge-gray">${reports.length}</span>
         </div>
         ${reports.map((r, i) => reportCardHtml(r, noteCounts[i])).join('')}`;

    container.innerHTML = breadcrumb + logoHtml + reportsHtml + planLibrarySectionHtml(plans);
  }

  async function uploadPlan(e) {
    const files = Array.from(e.target.files);
    e.target.value = '';
    if (!files.length || !_projectId) return;

    App.showLoading('טוען תוכניות...');
    try {
      for (const file of files) {
        const arrayBuffer = await file.arrayBuffer();
        const uint8Array  = new Uint8Array(arrayBuffer);
        const base64      = btoa(uint8Array.reduce((d, b) => d + String.fromCharCode(b), ''));
        const pdfData     = `data:application/pdf;base64,${base64}`;

        const pdfDoc  = await pdfjsLib.getDocument({ data: uint8Array }).promise;
        const page    = await pdfDoc.getPage(1);
        const viewport = page.getViewport({ scale: 0.5 });
        const canvas  = document.createElement('canvas');
        canvas.width  = viewport.width;
        canvas.height = viewport.height;
        await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
        const thumbData = canvas.toDataURL('image/jpeg', 0.7);

        const plan = {
          id:        Storage.generateId(),
          projectId: _projectId,
          name:      file.name.replace(/\.pdf$/i, ''),
          pdfData,
          thumbData,
          createdAt: Date.now(),
        };
        await Storage.Plans.save(plan);
      }
      App.toast(files.length > 1 ? `${files.length} תוכניות הועלו` : 'תוכנית הועלתה');
      await refreshPlanLibrary();
    } catch (err) {
      App.toast('שגיאה בטעינת התוכנית');
      console.error(err);
    } finally {
      App.hideLoading();
    }
  }

  async function deletePlan(planId) {
    App.confirm('למחוק תוכנית זו מהמאגר?', async () => {
      await Storage.Plans.delete(planId);
      App.toast('התוכנית נמחקה');
      await refreshPlanLibrary();
    });
  }

  async function refreshPlanLibrary() {
    if (!_projectId) return;
    const plans = await Storage.Plans.getForProject(_projectId);
    const list  = document.getElementById('plans-library-list');
    if (list) list.innerHTML = plans.length === 0
      ? `<p class="text-sm text-muted" style="padding:12px 0;">אין תוכניות במאגר — העלה קובץ PDF לשימוש בהערות</p>`
      : plans.map(planThumbHtml).join('');
  }

  async function newReport(projectId) {
    const reportNumber = await Storage.Reports.getNextNumber(projectId);
    const report = {
      id: Storage.generateId(),
      projectId,
      reportNumber,
      siteName:     '',
      description:  '',
      floors:       '',
      date:         new Date().toISOString().slice(0, 10),
      inspector:    '',
      participants: '',
      createdAt:    Date.now(),
    };
    await Storage.Reports.save(report);
    Router.navigate(`/report/${report.id}`);
  }

  async function exportPdf(reportId, e) {
    if (e) e.stopPropagation();
    const report  = await Storage.Reports.get(reportId);
    const notes   = await Storage.Notes.getForReport(reportId);
    const project = await Storage.Projects.get(report.projectId);
    await PdfExport.preview(report, notes, project);
  }

  async function deleteReport(id, e) {
    if (e) e.stopPropagation();
    const report = await Storage.Reports.get(id);
    App.confirm(`למחוק דוח #${report?.reportNumber}? הפעולה בלתי הפיכה.`, async () => {
      const projectId = report.projectId;
      await Storage.Reports.delete(id);
      App.toast('הדוח נמחק');
      await render({ projectId });
    });
  }

  return { render, newReport, exportPdf, deleteReport, uploadPlan, deletePlan };
})();
