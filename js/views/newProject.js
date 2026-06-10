const NewProjectView = (() => {
  let _logoData      = null;
  let _personId      = null;
  let _searching     = false;
  let _debounceTimer = null;
  let _contacts      = [];

  function escHtml(s) {
    return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  }

  async function render({ personId }) {
    _personId  = personId;
    _logoData  = null;
    _searching = false;
    _contacts  = [];

    const person = await Storage.People.get(personId);
    if (!person) { Router.navigate('/'); return; }

    App.setHeader('פרויקט חדש', true, '');

    const personCrumb = Auth.isAdmin()
      ? `<span class="breadcrumb-sep">›</span>
         <span class="breadcrumb-item" onclick="Router.navigate('/person/${personId}')">${escHtml(person.name)}</span>`
      : '';

    document.getElementById('view-container').innerHTML = `
      <div class="breadcrumb">
        <span class="breadcrumb-item" onclick="Router.navigate('/')">דף הבית</span>
        ${personCrumb}
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
            <label>שם חברת פיקוח <span class="required">*</span></label>
            <input type="text" id="proj-client" placeholder="לדוגמה: DIT פיקוח" required
              oninput="NewProjectView.onClientInput(this.value)">
          </div>
        </div>

        <div class="form-section">
          <div class="form-section-title">לוגו של החברה</div>

          <div class="form-group">
            <label>דומיין האתר של החברה (אופציונלי)</label>
            <div style="display:flex;gap:8px;align-items:center;">
              <input type="text" id="proj-domain" placeholder="לדוגמה: abc.co.il"
                style="flex:1;" oninput="NewProjectView.onDomainInput(this.value)">
              <button type="button" class="btn btn-outline btn-sm" id="logo-search-btn"
                onclick="NewProjectView.searchLogo()">🔍 חפש לוגו</button>
            </div>
            <div id="logo-status" style="margin-top:8px;"></div>
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

        <div class="form-section">
          <div class="form-section-title">אנשי קשר</div>
          <div id="contacts-list"></div>
          <button type="button" class="btn btn-outline btn-sm" onclick="NewProjectView.addContact()">+ הוסף איש קשר</button>
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
    if (val.trim().length >= 2) {
      _debounceTimer = setTimeout(() => _searchLogoSilent(), 1400);
    }
  }

  function onDomainInput(val) {
    clearTimeout(_debounceTimer);
    if (val.trim().length >= 3) {
      _debounceTimer = setTimeout(() => _searchLogoSilent(), 1000);
    }
  }

  // Auto-search triggered by typing — silent (no toast on failure)
  async function _searchLogoSilent() {
    if (_searching || _logoData) return;
    const company = document.getElementById('proj-client')?.value.trim() || '';
    const domain  = document.getElementById('proj-domain')?.value.trim()  || '';
    if (!company && !domain) return;

    _searching = true;
    const statusEl = document.getElementById('logo-status');
    if (statusEl) statusEl.innerHTML = `<span style="color:var(--text-light);font-size:.85rem;">מחפש לוגו...</span>`;

    try {
      // Domain is most reliable — try it first
      let url = domain ? await LogoSearch.searchByDomain(domain) : null;
      if (!url && company) url = await LogoSearch.searchByName(company);
      if (url) {
        setLogo(await LogoSearch.toDataUrl(url) || url);
        if (statusEl) statusEl.innerHTML = '';
        App.toast('לוגו נמצא!');
      } else {
        if (statusEl) statusEl.innerHTML = '';
      }
    } catch (_) {
      if (statusEl) statusEl.innerHTML = '';
    } finally {
      _searching = false;
    }
  }

  // Manual search triggered by button click
  async function searchLogo() {
    if (_searching) return;
    const company = document.getElementById('proj-client')?.value.trim() || '';
    const domain  = document.getElementById('proj-domain')?.value.trim()  || '';
    if (!company && !domain) { App.toast('הזן שם חברה או דומיין'); return; }

    _searching = true;
    const btn      = document.getElementById('logo-search-btn');
    const statusEl = document.getElementById('logo-status');
    if (btn) { btn.disabled = true; btn.textContent = 'מחפש...'; }
    if (statusEl) statusEl.innerHTML = '';

    try {
      let url = domain ? await LogoSearch.searchByDomain(domain) : null;
      if (!url && company) url = await LogoSearch.searchByName(company);
      if (url) {
        setLogo(await LogoSearch.toDataUrl(url) || url);
        App.toast('לוגו נמצא!');
      } else {
        App.toast('לא נמצא לוגו — הזן דומיין אתר החברה (לדוגמה: abc.co.il) או העלה ידנית');
      }
    } finally {
      _searching = false;
      if (btn) { btn.disabled = false; btn.textContent = '🔍 חפש לוגו'; }
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

  function _gatherContacts() {
    const items = document.querySelectorAll('.contact-row');
    return Array.from(items).map((row, i) => ({
      name:  row.querySelector(`[data-ci="${i}-name"]`)?.value.trim()  || '',
      email: row.querySelector(`[data-ci="${i}-email"]`)?.value.trim() || '',
      role:  row.querySelector(`[data-ci="${i}-role"]`)?.value.trim()  || '',
      phone: row.querySelector(`[data-ci="${i}-phone"]`)?.value.trim() || '',
    })).filter(c => c.name && c.email);
  }

  function _renderContacts() {
    const list = document.getElementById('contacts-list');
    if (!list) return;
    list.innerHTML = _contacts.map((c, i) => `
      <div class="contact-row" data-row="${i}">
        <button type="button" class="contact-row-del" onclick="NewProjectView.removeContact(${i})">✕</button>
        <div class="form-group" style="margin:0;">
          <label style="font-size:.8rem;">שם <span class="required">*</span></label>
          <input type="text" data-ci="${i}-name" value="${escHtml(c.name)}" placeholder="שם מלא">
        </div>
        <div class="form-group" style="margin:0;">
          <label style="font-size:.8rem;">מייל <span class="required">*</span></label>
          <input type="email" data-ci="${i}-email" value="${escHtml(c.email)}" placeholder="example@mail.com">
        </div>
        <div class="form-group" style="margin:0;">
          <label style="font-size:.8rem;">תפקיד</label>
          <input type="text" data-ci="${i}-role" value="${escHtml(c.role)}" placeholder="תפקיד (רשות)">
        </div>
        <div class="form-group" style="margin:0;">
          <label style="font-size:.8rem;">טלפון</label>
          <input type="tel" data-ci="${i}-phone" value="${escHtml(c.phone)}" placeholder="050-0000000 (רשות)">
        </div>
      </div>
    `).join('');
  }

  function addContact() {
    _contacts = _gatherContacts();
    _contacts.push({ name: '', email: '', role: '', phone: '' });
    _renderContacts();
  }

  function removeContact(idx) {
    _contacts = _gatherContacts();
    _contacts.splice(idx, 1);
    _renderContacts();
  }

  async function submit(e) {
    e.preventDefault();
    const name       = document.getElementById('proj-name').value.trim();
    const clientName = document.getElementById('proj-client').value.trim();

    if (!name)       { App.toast('נא להזין שם פרויקט'); return; }
    if (!clientName) { App.toast('נא להזין שם חברת פיקוח'); return; }

    _contacts = _gatherContacts();

    const project = {
      id: Storage.generateId(),
      personId: _personId,
      name,
      clientName,
      domain: '',
      logoData: _logoData,
      contacts: _contacts,
      createdAt: Date.now(),
    };
    App.showLoading('יוצר פרויקט...');
    try {
      await Storage.Projects.save(project);
      App.toast(`פרויקט "${name}" נוצר`);
      Router.navigate(`/project/${project.id}`);
    } catch (err) {
      App.toast('שגיאה ביצירת פרויקט');
    } finally {
      App.hideLoading();
    }
  }

  return { render, onClientInput, onDomainInput, searchLogo, handleLogoUpload, clearLogo, submit, addContact, removeContact };
})();
