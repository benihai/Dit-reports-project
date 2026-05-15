const Storage = (() => {
  const K = {
    people:   'dit_people',
    projects: 'dit_projects',
    reports:  'dit_reports',
    notes:    'dit_notes',
    plans:    'dit_plans',      // project-level plan library
    settings: 'dit_settings',
  };

  function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 6);
  }

  async function getList(key)       { return (await localforage.getItem(key)) || []; }
  async function saveList(key, arr) { await localforage.setItem(key, arr); }

  // ── PEOPLE ──────────────────────────────────────────────────────────────────
  const People = {
    async getAll() {
      const list = await getList(K.people);
      return list.sort((a, b) => a.name.localeCompare(b.name, 'he'));
    },
    async get(id) {
      return (await getList(K.people)).find(p => p.id === id) || null;
    },
    async save(person) {
      const list = await getList(K.people);
      const idx  = list.findIndex(p => p.id === person.id);
      if (idx >= 0) list[idx] = person; else list.push(person);
      await saveList(K.people, list);
      return person;
    },
    async delete(id) {
      const projects = await Projects.getForPerson(id);
      for (const p of projects) await Projects.delete(p.id);
      const list = await getList(K.people);
      await saveList(K.people, list.filter(p => p.id !== id));
    }
  };

  // ── PROJECTS ─────────────────────────────────────────────────────────────────
  const Projects = {
    async getForPerson(personId) {
      const list = await getList(K.projects);
      return list
        .filter(p => p.personId === personId)
        .sort((a, b) => b.createdAt - a.createdAt);
    },
    async get(id) {
      return (await getList(K.projects)).find(p => p.id === id) || null;
    },
    async save(project) {
      const list = await getList(K.projects);
      const idx  = list.findIndex(p => p.id === project.id);
      if (idx >= 0) list[idx] = project; else list.push(project);
      await saveList(K.projects, list);
      return project;
    },
    async delete(id) {
      const reports = await Reports.getForProject(id);
      for (const r of reports) await Reports.delete(r.id);
      const plans = await Plans.getForProject(id);
      for (const pl of plans) await Plans.delete(pl.id);
      const list = await getList(K.projects);
      await saveList(K.projects, list.filter(p => p.id !== id));
    }
  };

  // ── REPORTS ──────────────────────────────────────────────────────────────────
  const Reports = {
    async getForProject(projectId) {
      const list = await getList(K.reports);
      return list
        .filter(r => r.projectId === projectId)
        .sort((a, b) => b.createdAt - a.createdAt);
    },
    async get(id) {
      return (await getList(K.reports)).find(r => r.id === id) || null;
    },
    async save(report) {
      const list = await getList(K.reports);
      const idx  = list.findIndex(r => r.id === report.id);
      if (idx >= 0) list[idx] = report; else list.push(report);
      await saveList(K.reports, list);
      return report;
    },
    async delete(id) {
      const list = await getList(K.reports);
      await saveList(K.reports, list.filter(r => r.id !== id));
      const notes = await getList(K.notes);
      await saveList(K.notes, notes.filter(n => n.reportId !== id));
    },
    async getNextNumber(projectId) {
      const list = await Reports.getForProject(projectId);
      const max  = list.reduce((m, r) => Math.max(m, r.reportNumber || 0), 0);
      return max + 1;
    }
  };

  // ── NOTES ────────────────────────────────────────────────────────────────────
  // note.mediaItems  = [{ type:'image'|'video', data:base64, name }]
  // note.planMarkups = [{ planId, planName, imageData:base64 }]  ← annotated image per note
  const Notes = {
    async getForReport(reportId) {
      const list = await getList(K.notes);
      return list
        .filter(n => n.reportId === reportId)
        .sort((a, b) => a.createdAt - b.createdAt);
    },
    async get(id) {
      return (await getList(K.notes)).find(n => n.id === id) || null;
    },
    async save(note) {
      const list = await getList(K.notes);
      const idx  = list.findIndex(n => n.id === note.id);
      if (idx >= 0) list[idx] = note; else list.push(note);
      await saveList(K.notes, list);
      return note;
    },
    async delete(id) {
      const list = await getList(K.notes);
      await saveList(K.notes, list.filter(n => n.id !== id));
    }
  };

  // ── PLANS (project-level library) ────────────────────────────────────────────
  // { id, projectId, name, pdfData(base64), thumbData(base64), createdAt }
  const Plans = {
    async getForProject(projectId) {
      const list = await getList(K.plans);
      return list
        .filter(p => p.projectId === projectId)
        .sort((a, b) => a.createdAt - b.createdAt);
    },
    async get(id) {
      return (await getList(K.plans)).find(p => p.id === id) || null;
    },
    async save(plan) {
      const list = await getList(K.plans);
      const idx  = list.findIndex(p => p.id === plan.id);
      if (idx >= 0) list[idx] = plan; else list.push(plan);
      await saveList(K.plans, list);
      return plan;
    },
    async delete(id) {
      const list = await getList(K.plans);
      await saveList(K.plans, list.filter(p => p.id !== id));
    }
  };

  // ── SETTINGS ─────────────────────────────────────────────────────────────────
  const Settings = {
    async get() {
      return (await localforage.getItem(K.settings)) || {};
    },
    async save(settings) {
      await localforage.setItem(K.settings, settings);
      return settings;
    }
  };

  return { generateId, People, Projects, Reports, Notes, Plans, Settings };
})();
