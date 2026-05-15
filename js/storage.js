const Storage = (() => {

  // ── Mapping helpers ────────────────────────────────────────────────────────

  function mapPerson(r) {
    if (!r) return null;
    return { id: r.id, name: r.name, company: r.company || '', email: r.email || '', phone: r.phone || '', logoUrl: r.logo_url || '', createdAt: r.created_at };
  }
  function personToRow(p) {
    return { id: p.id, name: p.name, company: p.company || null, email: p.email || null, phone: p.phone || null, logo_url: p.logoUrl || null, created_at: p.createdAt, created_by: Auth.getUser()?.id };
  }

  function mapProject(r) {
    if (!r) return null;
    return { id: r.id, personId: r.person_id, name: r.name, domain: r.domain || '', logoUrl: r.logo_url || '', createdAt: r.created_at };
  }
  function projectToRow(p) {
    return { id: p.id, person_id: p.personId, name: p.name, domain: p.domain || null, logo_url: p.logoUrl || null, created_at: p.createdAt, created_by: Auth.getUser()?.id };
  }

  function mapReport(r) {
    if (!r) return null;
    return { id: r.id, projectId: r.project_id, reportNumber: r.report_number, siteName: r.site_name || '', description: r.description || '', date: r.date || '', inspector: r.inspector || '', participants: r.participants || '', floors: r.floors || '', summary: r.summary || '', status: r.status || 'draft', createdAt: r.created_at };
  }
  function reportToRow(r) {
    return { id: r.id, project_id: r.projectId, report_number: r.reportNumber, site_name: r.siteName || null, description: r.description || null, date: r.date || null, inspector: r.inspector || null, participants: r.participants || null, floors: r.floors || null, summary: r.summary || null, status: r.status || 'draft', created_at: r.createdAt, created_by: Auth.getUser()?.id };
  }

  function mapNote(r) {
    if (!r) return null;
    return { id: r.id, reportId: r.report_id, floor: r.floor || '', area: r.area || '', description: r.description || '', responsible: r.responsible || '', urgency: r.urgency || 'medium', status: r.status || 'open', mediaItems: r.media_items || [], planMarkups: r.plan_markups || [], createdAt: r.created_at };
  }
  function noteToRow(n) {
    return { id: n.id, report_id: n.reportId, floor: n.floor || null, area: n.area || null, description: n.description || null, responsible: n.responsible || null, urgency: n.urgency || 'medium', status: n.status || 'open', media_items: n.mediaItems || [], plan_markups: n.planMarkups || [], created_at: n.createdAt };
  }

  function mapPlan(r) {
    if (!r) return null;
    const raw = r.pdf_data || '';
    let pdfData = '', pages = null;
    if (raw.startsWith('[')) {
      try { pages = JSON.parse(raw); } catch(e) { pdfData = raw; }
    } else {
      pdfData = raw;
    }
    return { id: r.id, projectId: r.project_id, name: r.name || '', pdfData, pages, thumbData: r.thumb_data || '', createdAt: r.created_at };
  }
  function planToRow(p) {
    const pdfVal = p.pages ? JSON.stringify(p.pages) : (p.pdfData || null);
    return { id: p.id, project_id: p.projectId, name: p.name || null, pdf_data: pdfVal, thumb_data: p.thumbData || null, created_at: p.createdAt };
  }

  function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 6);
  }

  function throwIf(error) { if (error) throw error; }

  // ── PEOPLE ────────────────────────────────────────────────────────────────

  const People = {
    async getAll() {
      const { data, error } = await _supabase.from('people').select('*').order('name');
      throwIf(error);
      return (data || []).map(mapPerson);
    },
    async get(id) {
      const { data, error } = await _supabase.from('people').select('*').eq('id', id).maybeSingle();
      throwIf(error);
      return mapPerson(data);
    },
    async save(person) {
      const { data, error } = await _supabase.from('people').upsert(personToRow(person)).select().single();
      throwIf(error);
      return mapPerson(data);
    },
    async delete(id) {
      const { error } = await _supabase.from('people').delete().eq('id', id);
      throwIf(error);
    }
  };

  // ── PROJECTS ──────────────────────────────────────────────────────────────

  const Projects = {
    async getForPerson(personId) {
      const { data, error } = await _supabase.from('projects').select('*').eq('person_id', personId).order('created_at', { ascending: false });
      throwIf(error);
      return (data || []).map(mapProject);
    },
    async get(id) {
      const { data, error } = await _supabase.from('projects').select('*').eq('id', id).maybeSingle();
      throwIf(error);
      return mapProject(data);
    },
    async save(project) {
      const { data, error } = await _supabase.from('projects').upsert(projectToRow(project)).select().single();
      throwIf(error);
      return mapProject(data);
    },
    async delete(id) {
      const { error } = await _supabase.from('projects').delete().eq('id', id);
      throwIf(error);
    }
  };

  // ── REPORTS ───────────────────────────────────────────────────────────────

  const Reports = {
    async getForProject(projectId) {
      const { data, error } = await _supabase.from('reports').select('*').eq('project_id', projectId).order('created_at', { ascending: false });
      throwIf(error);
      return (data || []).map(mapReport);
    },
    async get(id) {
      const { data, error } = await _supabase.from('reports').select('*').eq('id', id).maybeSingle();
      throwIf(error);
      return mapReport(data);
    },
    async save(report) {
      const { data, error } = await _supabase.from('reports').upsert(reportToRow(report)).select().single();
      throwIf(error);
      return mapReport(data);
    },
    async delete(id) {
      const { error } = await _supabase.from('reports').delete().eq('id', id);
      throwIf(error);
    },
    async getNextNumber(projectId) {
      const { data } = await _supabase.from('reports').select('report_number').eq('project_id', projectId).order('report_number', { ascending: false }).limit(1);
      return ((data?.[0]?.report_number) || 0) + 1;
    },
    // Viewer: returns all accessible reports with joined project+person names
    async getPermitted() {
      const { data, error } = await _supabase
        .from('reports')
        .select('*, projects!inner(name, logo_url, people!inner(name))')
        .order('created_at', { ascending: false });
      throwIf(error);
      return (data || []).map(row => ({
        ...mapReport(row),
        projectName:    row.projects?.name        || '',
        projectLogoUrl: row.projects?.logo_url    || '',
        personName:     row.projects?.people?.name || '',
      }));
    }
  };

  // ── NOTES ─────────────────────────────────────────────────────────────────

  const Notes = {
    async getForReport(reportId) {
      const { data, error } = await _supabase.from('notes').select('*').eq('report_id', reportId).order('created_at', { ascending: true });
      throwIf(error);
      return (data || []).map(mapNote);
    },
    async get(id) {
      const { data, error } = await _supabase.from('notes').select('*').eq('id', id).maybeSingle();
      throwIf(error);
      return mapNote(data);
    },
    async save(note) {
      const { data, error } = await _supabase.from('notes').upsert(noteToRow(note)).select().single();
      throwIf(error);
      return mapNote(data);
    },
    async delete(id) {
      const { error } = await _supabase.from('notes').delete().eq('id', id);
      throwIf(error);
    }
  };

  // ── PLANS ─────────────────────────────────────────────────────────────────

  const Plans = {
    async getForProject(projectId) {
      const { data, error } = await _supabase.from('plans').select('*').eq('project_id', projectId).order('created_at', { ascending: true });
      throwIf(error);
      return (data || []).map(mapPlan);
    },
    async get(id) {
      const { data, error } = await _supabase.from('plans').select('*').eq('id', id).maybeSingle();
      throwIf(error);
      return mapPlan(data);
    },
    async save(plan) {
      const { data, error } = await _supabase.from('plans').upsert(planToRow(plan)).select().single();
      throwIf(error);
      return mapPlan(data);
    },
    async delete(id) {
      const { error } = await _supabase.from('plans').delete().eq('id', id);
      throwIf(error);
    }
  };

  // ── SETTINGS (local only, no need to sync) ────────────────────────────────

  const Settings = {
    async get() {
      return (await localforage.getItem('dit_settings')) || {};
    },
    async save(settings) {
      await localforage.setItem('dit_settings', settings);
      return settings;
    }
  };

  return { generateId, People, Projects, Reports, Notes, Plans, Settings };
})();
