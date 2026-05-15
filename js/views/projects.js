const ProjectsView = (() => {

  function escHtml(s) {
    return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  function logoHtml(project) {
    if (project.logoData) {
      return `<img class="project-client-logo" src="${project.logoData}" alt="${escHtml(project.clientName)}">`;
    }
    const initials = (project.clientName || project.name || '?')
      .trim().split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase();
    return `<div class="project-client-initials">${initials}</div>`;
  }

  function projectCardHtml(project, reportCount) {
    return `
      <div class="project-card" onclick="Router.navigate('/project/${project.id}')">
        <div class="project-card-header">
          ${logoHtml(project)}
          <div>
            <div class="project-name">${escHtml(project.name)}</div>
            <div class="project-client">${escHtml(project.clientName || '')}</div>
          </div>
          <div style="margin-right:auto;">
            <span class="badge badge-gray">${reportCount} דוחות</span>
          </div>
        </div>
        <div class="project-card-actions" onclick="event.stopPropagation()">
          <button class="btn btn-outline btn-sm" onclick="Router.navigate('/project/${project.id}')">דוחות</button>
          <button class="btn-icon-sm" title="מחק פרויקט" onclick="ProjectsView.deleteProject('${project.id}')">
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

  async function render({ personId }) {
    const person = await Storage.People.get(personId);
    if (!person) { Router.navigate('/'); return; }

    App.setHeader(person.name, true, `
      <button class="btn btn-primary btn-sm" onclick="Router.navigate('/person/${personId}/new-project')">
        + פרויקט
      </button>
    `);

    const projects = await Storage.Projects.getForPerson(personId);
    const counts   = await Promise.all(
      projects.map(p => Storage.Reports.getForProject(p.id).then(l => l.length))
    );

    const container = document.getElementById('view-container');

    if (projects.length === 0) {
      container.innerHTML = `
        <div class="breadcrumb">
          <span class="breadcrumb-item" onclick="Router.navigate('/')">דף הבית</span>
          <span class="breadcrumb-sep">›</span>
          <span class="breadcrumb-current">${escHtml(person.name)}</span>
        </div>
        <div class="empty-state">
          <svg width="50" height="50" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
            <rect x="2" y="3" width="20" height="14" rx="2"/>
            <line x1="8" y1="21" x2="16" y2="21"/>
            <line x1="12" y1="17" x2="12" y2="21"/>
          </svg>
          <h3>אין פרויקטים עדיין</h3>
          <p>לחץ על "+ פרויקט" להתחלה</p>
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <div class="breadcrumb">
        <span class="breadcrumb-item" onclick="Router.navigate('/')">דף הבית</span>
        <span class="breadcrumb-sep">›</span>
        <span class="breadcrumb-current">${escHtml(person.name)}</span>
      </div>
      <div class="screen-title">
        <span>פרויקטים</span>
        <span class="badge badge-gray">${projects.length}</span>
      </div>
      ${projects.map((p, i) => projectCardHtml(p, counts[i])).join('')}
    `;
  }

  async function deleteProject(id) {
    const project = await Storage.Projects.get(id);
    App.confirm(`למחוק את "${project?.name}"? כל הדוחות יימחקו.`, async () => {
      const proj = await Storage.Projects.get(id);
      await Storage.Projects.delete(id);
      App.toast('הפרויקט נמחק');
      Router.navigate(`/person/${proj.personId}`);
    });
  }

  return { render, deleteProject };
})();
