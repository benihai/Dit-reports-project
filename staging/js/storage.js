const Storage = (() => {

  // ── Session memory cache ────────────────────────────────────────────────────
  const _mem = {};
  const _MEM_TTL = 90_000;  // 90 s

  function _mGet(k) {
    const e = _mem[k];
    return (e && Date.now() - e.t < _MEM_TTL) ? e.d : null;
  }
  function _mSet(k, d) { _mem[k] = { d, t: Date.now() }; }
  function _mClear(...prefixes) {
    prefixes.forEach(p =>
      Object.keys(_mem).filter(k => k.startsWith(p)).forEach(k => delete _mem[k])
    );
  }

  // ── LocalForage offline layer ───────────────────────────────────────────────
  async function _lfGet(k) {
    try { return await localforage.getItem('dc:' + k); } catch { return null; }
  }
  function _lfSet(k, d) { localforage.setItem('dc:' + k, d).catch(() => {}); }

  // Try memory → network (cache result) → localforage offline fallback
  async function _query(key, fn) {
    const mem = _mGet(key);
    if (mem) return mem;
    try {
      const r = await fn();
      _mSet(key, r);
      _lfSet(key, r);
      return r;
    } catch (err) {
      const lf = await _lfGet(key);
      if (lf != null) { _mSet(key, lf); return lf; }
      throw err;
    }
  }

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
    return {
      id: r.id,
      personId: r.person_id,
      name: r.name,
      clientName: r.client_name || '',
      domain: r.domain || '',
      logoData: r.logo_url || '',   // logo_url stores base64 or URL
      createdAt: r.created_at,
    };
  }
  function projectToRow(p) {
    const row = {
      id: p.id,
      person_id: p.personId,
      name: p.name,
      domain: p.domain || null,
      logo_url: p.logoData || null,
      created_at: p.createdAt,
      created_by: Auth.getUser()?.id,
    };
    // client_name requires migration 001 — include only if column exists in schema
    if (p.clientName !== undefined) row.client_name = p.clientName || null;
    return row;
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
    return { id: r.id, reportId: r.report_id, noteNumber: r.note_number || null, floor: r.floor || '', area: r.area || '', description: r.description || '', responsible: r.responsible || '', urgency: r.urgency || 'medium', status: r.status || 'open', mediaItems: r.media_items || [], planMarkups: r.plan_markups || [], createdAt: r.created_at };
  }
  function noteToRow(n) {
    return { id: n.id, report_id: n.reportId, note_number: n.noteNumber || null, floor: n.floor || null, area: n.area || null, description: n.description || null, responsible: n.responsible || null, urgency: n.urgency || 'medium', status: n.status || 'open', media_items: n.mediaItems || [], plan_markups: n.planMarkups || [], created_at: n.createdAt };
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
      return _query('people', async () => {
        const { data, error } = await _supabase.from('people').select('*').order('name');
        throwIf(error);
        return (data || []).map(mapPerson);
      });
    },
    async get(id) {
      return _query(`person_${id}`, async () => {
        const { data, error } = await _supabase.from('people').select('*').eq('id', id).maybeSingle();
        throwIf(error);
        return mapPerson(data);
      });
    },
    async save(person) {
      _mClear('people', `person_${person.id}`);
      const { data, error } = await _supabase.from('people').upsert(personToRow(person)).select().single();
      throwIf(error);
      return mapPerson(data);
    },
    async delete(id) {
      _mClear('people', `person_${id}`);
      const { error } = await _supabase.from('people').delete().eq('id', id);
      throwIf(error);
    }
  };

  // ── PROJECTS ──────────────────────────────────────────────────────────────
  const Projects = {
    async getForPerson(personId) {
      return _query(`projects_${personId}`, async () => {
        const { data, error } = await _supabase.from('projects').select('*').eq('person_id', personId).order('created_at', { ascending: false });
        throwIf(error);
        return (data || []).map(mapProject);
      });
    },
    async get(id) {
      return _query(`project_${id}`, async () => {
        const { data, error } = await _supabase.from('projects').select('*').eq('id', id).maybeSingle();
        throwIf(error);
        return mapProject(data);
      });
    },
    async save(project) {
      _mClear(`projects_${project.personId}`, `project_${project.id}`);
      const row = projectToRow(project);
      // If client_name column not yet migrated, try without it
      let { data, error } = await _supabase.from('projects').upsert(row).select().single();
      if (error?.message?.includes('client_name')) {
        const { client_name: _, ...rowWithout } = row;
        ({ data, error } = await _supabase.from('projects').upsert(rowWithout).select().single());
      }
      throwIf(error);
      return mapProject(data);
    },
    async delete(id) {
      _mClear(`projects_`, `project_${id}`);
      const { error } = await _supabase.from('projects').delete().eq('id', id);
      throwIf(error);
    }
  };

  // ── REPORTS ───────────────────────────────────────────────────────────────
  const Reports = {
    async getForProject(projectId) {
      return _query(`reports_${projectId}`, async () => {
        const { data, error } = await _supabase.from('reports').select('*').eq('project_id', projectId).order('created_at', { ascending: false });
        throwIf(error);
        return (data || []).map(mapReport);
      });
    },
    async get(id) {
      return _query(`report_${id}`, async () => {
        const { data, error } = await _supabase.from('reports').select('*').eq('id', id).maybeSingle();
        throwIf(error);
        return mapReport(data);
      });
    },
    async save(report) {
      _mClear(`reports_${report.projectId}`, `report_${report.id}`);
      const { data, error } = await _supabase.from('reports').upsert(reportToRow(report)).select().single();
      throwIf(error);
      return mapReport(data);
    },
    async delete(id) {
      _mClear(`reports_`, `report_${id}`);
      const { error } = await _supabase.from('reports').delete().eq('id', id);
      throwIf(error);
    },
    async getNextNumber(projectId) {
      const { data } = await _supabase.from('reports').select('report_number').eq('project_id', projectId).order('report_number', { ascending: false }).limit(1);
      return ((data?.[0]?.report_number) || 0) + 1;
    },
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
      return _query(`notes_${reportId}`, async () => {
        const { data, error } = await _supabase.from('notes').select('*').eq('report_id', reportId).order('created_at', { ascending: true });
        throwIf(error);
        return (data || []).map(mapNote);
      });
    },
    async get(id) {
      const { data, error } = await _supabase.from('notes').select('*').eq('id', id).maybeSingle();
      throwIf(error);
      return mapNote(data);
    },
    async save(note) {
      _mClear(`notes_${note.reportId}`);
      const { data, error } = await _supabase.from('notes').upsert(noteToRow(note)).select().single();
      throwIf(error);
      const result = mapNote(data);
      // Refresh localforage cache in background
      _lfGet(`notes_${note.reportId}`).then(cached => {
        if (cached) {
          _lfSet(`notes_${note.reportId}`, cached.map(n => n.id === result.id ? result : n));
        }
      });
      return result;
    },
    async delete(id) {
      // We don't know reportId here, so clear all note caches
      _mClear('notes_');
      const { error } = await _supabase.from('notes').delete().eq('id', id);
      throwIf(error);
    }
  };

  // ── PLANS ─────────────────────────────────────────────────────────────────
  const Plans = {
    async getForProject(projectId) {
      return _query(`plans_${projectId}`, async () => {
        const { data, error } = await _supabase.from('plans').select('*').eq('project_id', projectId).order('created_at', { ascending: true });
        throwIf(error);
        return (data || []).map(mapPlan);
      });
    },
    async get(id) {
      return _query(`plan_${id}`, async () => {
        const { data, error } = await _supabase.from('plans').select('*').eq('id', id).maybeSingle();
        throwIf(error);
        return mapPlan(data);
      });
    },
    async save(plan) {
      _mClear(`plans_${plan.projectId}`, `plan_${plan.id}`);
      const { data, error } = await _supabase.from('plans').upsert(planToRow(plan)).select().single();
      throwIf(error);
      return mapPlan(data);
    },
    async delete(id) {
      _mClear('plans_', `plan_${id}`);
      const { error } = await _supabase.from('plans').delete().eq('id', id);
      throwIf(error);
    }
  };

  return { generateId, People, Projects, Reports, Notes, Plans };
})();
