const NewProjectView = (() => {
  let _logoData    = null;
  let _personId    = null;
  let _searching   = false;
  let _debounceTimer = null;

  function escHtml(s) {
    return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  async function render({ personId }) {
    _personId  = personId;
    _logoData  = null;
    _searching = false;

    const person = await Storage.People.get(personId);
    if (!person) { Router.navigate('/'); return; }

    App.setHeader('פרויקט חדש', true, '');

    document.getElementById('view-container').innerHTML = `
      <div class="breadcrumb">
        <span class="breadcrumb-item" onclick="Router.navigate('/')">דף הבית</span>
        <span class="breadcrumb-sep">›</span>
        <span class="breadcrumb-item" onclick="Router.navigate('/person/${personId}')">${escHtml(person.name)}</span>
        <span class="breadcrumb-sep">›</span>
        <span class="breadcrumb-current">פרויקט חדש</span>
      </div>

      <form onsubmit="NewProjectView.submit(event)" novalidate>

        <div class="form-section">
          <div class="form-section-title">פרטי הפרויקט</div>

          <div class="form-group">
            <label>שם הפרויקט <span class="required">*</span></label>
            <input type="text" id="proj-name" placeholder="לדוגמה: מגדל רמות" required>
          </div>

          <div class="form-group">
            <label>שם החברה / לקוח <span class="required">*</span></label>
            <input type="text" id="proj-client" placeholder="לדוגמה: קבוצת ABC" required
              oninput="NewProjectView.onClientInput(this.value)">
          </div>
        </div>

        <div class="form-section">
          <div class="form-section-title">לוגו לקוח</div>

          <div class="form-group">
            <label>דומיין לחיפוש לוגו אוטומטי</label>
            <div style="display:flex;gap:8px;align-items:center;">
              <input type="text" id="proj-domain" placeholder="example.com או example"
                oninput="NewProjectView.onDomainInput(this.value)"
                style="flex:1;">
              <button type="button" class="btn btn-outline btn-sm" id="logo-search-btn"
                onclick="NewProjectView.searchLogo()">חפש לוגו</button>
            </div>

            <div id="logo-status"></div>
          </div>

          <div class="form-group">
            <label>או העלה לוגו ידנית</label>
            <label class="image-upload-area" id="logo-upload-label">
              <input type="file" id="logo-file-input" accept="image/*"
                onchange="NewProjectView.handleLogoUpload(event)">
              <svg width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24" style="margin-bottom:6px;">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="17 8 12 3 7 8"/>
                <line x1="12" y1="3" x2="12" y2="15"/>
              </svg>
              <span id="logo-upload-text">לחץ לבחירת תמונה</span>
            </label>
          </div>

          <div id="logo-preview-wrap" class="hidden">
            <div class="logo-search-preview">
              <img id="logo-preview-img" src="" alt="לוגו">
              <div>
                <div class="logo-found-label">לוגו נבחר</div>
                <button type="button" class="btn btn-ghost btn-sm" onclick="NewProjectView.clearLogo()" style="color:#dc2626;padding:2px 8px;">הסר</button>
              </div>
            </div>
          </div>
        </div>

        <div class="form-actions">
          <button type="button" class="btn btn-outline" onclick="history.back()">ביטול</button>
          <button type="submit" class="btn btn-primary">צור פרויקט</button>
        </div>
      </form>
    `;
  }

  function onClientInput(val) {
    clearTimeout(_debounceTimer);
    if (val.trim().length >= 3) {
      _debounceTimer = setTimeout(() => searchLogoByCompany(val), 1200);
    }
  }

  function onDomainInput(val) {
    clearTimeout(_debounceTimer);
    if (val.trim().length >= 4 && val.includes('.')) {
      _debounceTimer = setTimeout(() => searchLogo(), 1000);
    }
  }

  async function searchLogoByCompany(company) {
    if (_searching || !company.trim()) return;
    _searching = true;
    const statusEl = document.getElementById('logo-status');
    statusEl.innerHTML = `<div class="logo-searching"><span class="spinner"></span>מחפש לוגו...</div>`;

    try {
      const url = await LogoSearch.searchByDomain(company);
      if (url) {
        const data = await LogoSearch.toDataUrl(url);
        setLogo(data);
        statusEl.innerHTML = '';
        App.toast('לוגו נמצא!');
      } else {
        statusEl.innerHTML = '';
      }
    } catch (err) {
      statusEl.innerHTML = '';
    } finally {
      _searching = false;
    }
  }

  async function searchLogo() {
    if (_searching) return;
    const domain = document.getElementById('proj-domain')?.value.trim();
    if (!domain) { App.toast('הזן דומיין לחיפוש'); return; }

    _searching = true;
    const btn = document.getElementById('logo-search-btn');
    const statusEl = document.getElementById('logo-status');
    if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner"></span>'; }
    statusEl.innerHTML = `<div class="logo-searching"><span class="spinner"></span>מחפש לוגו...</div>`;

    try {
      const url = await LogoSearch.searchByDomain(domain);
      if (url) {
        const data = await LogoSearch.toDataUrl(url);
        setLogo(data);
        statusEl.innerHTML = '';
        App.toast('לוגו נמצא!');
      } else {
        statusEl.innerHTML = `<p class="text-sm text-muted" style="margin-top:6px;">לא נמצא לוגו — נסה לחיפוש ידני</p>`;
      }
    } finally {
      _searching = false;
      if (btn) { btn.disabled = false; btn.textContent = 'חפש לוגו'; }
    }
  }

  function handleLogoUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      setLogo(ev.target.result);
      document.getElementById('logo-upload-text').textContent = file.name;
    };
    reader.readAsDataURL(file);
  }

  function setLogo(dataUrl) {
    _logoData = dataUrl;
    const wrap = document.getElementById('logo-preview-wrap');
    const img  = document.getElementById('logo-preview-img');
    if (wrap && img) { img.src = dataUrl; wrap.classList.remove('hidden'); }
  }

  function clearLogo() {
    _logoData = null;
    const wrap = document.getElementById('logo-preview-wrap');
    if (wrap) wrap.classList.add('hidden');
    const fileInput = document.getElementById('logo-file-input');
    if (fileInput) fileInput.value = '';
    document.getElementById('logo-upload-text').textContent = 'לחץ לבחירת תמונה';
  }

  async function submit(e) {
    e.preventDefault();
    const name       = document.getElementById('proj-name').value.trim();
    const clientName = document.getElementById('proj-client').value.trim();
    const domain     = document.getElementById('proj-domain').value.trim();

    if (!name)       { App.toast('נא להזין שם פרויקט'); return; }
    if (!clientName) { App.toast('נא להזין שם חברה/לקוח'); return; }

    const project = {
      id: Storage.generateId(),
      personId: _personId,
      name,
      clientName,
      domain,
      logoData: _logoData,
      createdAt: Date.now(),
    };
    await Storage.Projects.save(project);
    App.toast(`פרויקט "${name}" נוצר`);
    Router.navigate(`/project/${project.id}`);
  }

  return { render, onClientInput, onDomainInput, searchLogo, searchLogoByCompany, handleLogoUpload, clearLogo, submit };
})();
