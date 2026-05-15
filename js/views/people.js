const PeopleView = (() => {

  function initials(name) {
    return name.trim().split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase();
  }

  function escHtml(s) {
    return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  function personCardHtml(person, projectCount) {
    return `
      <div class="person-card" onclick="Router.navigate('/person/${person.id}')">
        <div class="person-avatar">${initials(person.name)}</div>
        <div class="person-name">${escHtml(person.name)}</div>
        <div class="person-meta">${projectCount} פרויקטים</div>
        <div class="person-card-actions" onclick="event.stopPropagation()">
          <button class="btn-icon-sm" title="מחק" onclick="PeopleView.deletePerson('${person.id}')">
            <svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <polyline points="3 6 5 6 21 6"/>
              <path d="M19 6l-1 14H6L5 6"/>
              <path d="M9 6V4h6v2"/>
            </svg>
          </button>
        </div>
      </div>
    `;
  }

  async function render({ headerActionsHtml } = {}) {
    const addBtn = `
      <button class="btn-icon" onclick="PeopleView.openAddPerson()" title="הוסף מנהל פרויקטים">
        <svg width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
          <circle cx="9" cy="7" r="4"/>
          <line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/>
        </svg>
      </button>`;
    App.setHeader('', false, (headerActionsHtml || '') + addBtn);

    const people = await Storage.People.getAll();
    const counts = await Promise.all(
      people.map(p => Storage.Projects.getForPerson(p.id).then(l => l.length))
    );

    const container = document.getElementById('view-container');

    const welcomeBanner = `
      <div class="welcome-banner" style="text-align:center;">
        <div class="welcome-text" style="margin:0 auto;">
          <h1 style="text-align:center;">ברוכים הבאים ל-DIT Report</h1>
          <p style="text-align:center;">מערכת ניהול דוחות פיקוח וסיור</p>
        </div>
      </div>
    `;

    if (people.length === 0) {
      container.innerHTML = welcomeBanner + `
        <div class="empty-state">
          <svg width="60" height="60" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
            <circle cx="9" cy="7" r="4"/>
            <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
            <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
          </svg>
          <h3>אין מנהלי פרויקטים עדיין</h3>
          <p>לחץ על + להוספת איש קשר ראשון</p>
        </div>
      `;
      return;
    }

    container.innerHTML = welcomeBanner + `
      <div class="screen-title">
        <span>מנהלי פרויקטים</span>
        <span class="badge badge-gray">${people.length}</span>
      </div>
      <div class="people-grid">
        ${people.map((p, i) => personCardHtml(p, counts[i])).join('')}
      </div>
    `;
  }

  function openAddPerson() {
    let overlay = document.getElementById('add-person-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'add-person-overlay';
      overlay.className = 'modal-overlay';
      document.body.appendChild(overlay);
    }
    overlay.innerHTML = `
      <div class="modal-box" onclick="event.stopPropagation()" style="max-width:400px;">
        <div class="modal-handle"></div>
        <div class="modal-title">הוספת מנהל פרויקטים</div>
        <form onsubmit="PeopleView.submitAddPerson(event)" novalidate>
          <div class="form-group">
            <label>שם מלא <span class="required">*</span></label>
            <input type="text" id="person-name-input" placeholder="לדוגמה: דני כהן" autofocus required>
          </div>
          <div class="form-actions">
            <button type="button" class="btn btn-outline" onclick="PeopleView.closeAddPerson()">ביטול</button>
            <button type="submit" class="btn btn-primary">הוסף</button>
          </div>
        </form>
      </div>
    `;
    overlay.classList.remove('hidden');
    overlay.onclick = (e) => { if (e.target === overlay) PeopleView.closeAddPerson(); };
    setTimeout(() => document.getElementById('person-name-input')?.focus(), 80);
  }

  function closeAddPerson() {
    document.getElementById('add-person-overlay')?.classList.add('hidden');
  }

  async function submitAddPerson(e) {
    e.preventDefault();
    const name = document.getElementById('person-name-input').value.trim();
    if (!name) { App.toast('נא להזין שם'); return; }
    const person = { id: Storage.generateId(), name, createdAt: Date.now() };
    await Storage.People.save(person);
    closeAddPerson();
    App.toast(`${name} נוסף/ה`);
    await render();
  }

  async function deletePerson(id) {
    const person = await Storage.People.get(id);
    App.confirm(`למחוק את ${person?.name}? כל הפרויקטים והדוחות שלו יימחקו.`, async () => {
      await Storage.People.delete(id);
      App.toast('נמחק');
      await render();
    });
  }

  return { render, openAddPerson, closeAddPerson, submitAddPerson, deletePerson };
})();
