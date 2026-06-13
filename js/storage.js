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
  // Skip persisting very large payloads (plans with full-page images, notes with
  // embedded media) to IndexedDB — they would grow offline storage unbounded.
  // Such data stays in the session memory cache and is re-fetched from the
  // network when needed; only lighter data is kept for true offline use.
  const _LF_MAX_CHARS = 3_000_000;  // ~3 MB serialized per key
  function _lfSet(k, d) {
    try {
      const s = (d == null) ? '' : (typeof d === 'string' ? d : JSON.stringify(d));
      if (s.length > _LF_MAX_CHARS) return;
    } catch (_) { /* unserialisable — fall through and let localforage try */ }
    localforage.setItem('dc:' + k, d).catch(() => {});
  }

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
      contacts: r.contacts || [],
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
      contacts: p.contacts || [],
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
    return { id: r.id, reportId: r.report_id, noteNumber: r.note_number || null, floor: r.floor || '', area: r.area || '', description: r.description || '', responsible: r.responsible || '', responsibilityType: r.responsibility_type || '', tag: r.tag || '', urgency: r.urgency || 'medium', status: r.status || 'open', mediaItems: r.media_items || [], planMarkups: r.plan_markups || [], createdAt: r.created_at };
  }
  function noteToRow(n) {
    return { id: n.id, report_id: n.reportId, floor: n.floor || null, area: n.area || null, description: n.description || null, responsible: n.responsible || null, responsibility_type: n.responsibilityType || null, tag: n.tag || null, urgency: n.urgency || 'medium', status: n.status || 'open', media_items: n.mediaItems || [], plan_markups: n.planMarkups || [], created_at: n.createdAt };
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

  // ── Pending writes queue (offline-first sync) ───────────────────────────
  const _pending = {};
  let _syncing = false;
  const _MAX_SYNC_ATTEMPTS = 3;
  let _notifiedSyncFailure = false;

  function _persistPending() { localforage.setItem('dc:pending', _pending).catch(() => {}); }

  function _enqueuePendingWrite(type, data) {
    _pending[`${type}_${data.id}`] = { type, data, attempts: 0, failed: false };
    _persistPending();
  }

  function _dequeuePendingWrite(key) {
    delete _pending[key];
    _persistPending();
  }

  // Surface a sync failure to the user once (debounced) — so they know that a
  // change which appeared saved did NOT actually persist on the server.
  function _notifySyncFailure() {
    if (_notifiedSyncFailure) return;
    _notifiedSyncFailure = true;
    if (typeof App !== 'undefined' && App.toast) {
      App.toast('⚠️ חלק מהשינויים לא נשמרו בשרת — בדוק חיבור או הרשאות');
    }
    setTimeout(() => { _notifiedSyncFailure = false; }, 30_000);
  }

  async function _flushPendingWrites() {
    if (_syncing || !navigator.onLine) return;
    _syncing = true;
    try {
      for (const [key, item] of Object.entries(_pending)) {
        const table = item.type === 'note' ? 'notes'
                    : item.type === 'report' ? 'reports' : null;
        if (!table) { _dequeuePendingWrite(key); continue; }
        const row = item.type === 'note' ? noteToRow(item.data) : reportToRow(item.data);

        let serverError = null;
        try {
          const { error } = await _supabase.from(table).upsert(row);
          serverError = error;
        } catch (_) {
          // Network/transport failure — stop; retry on the next online event.
          break;
        }

        if (!serverError) {
          _dequeuePendingWrite(key);          // synced successfully
        } else {
          // Server rejected the write (RLS, constraint, …). Retry a few times,
          // then flag it and tell the user it is NOT saved on the server.
          item.attempts = (item.attempts || 0) + 1;
          if (item.attempts >= _MAX_SYNC_ATTEMPTS && !item.failed) {
            item.failed = true;
            _persistPending();
            _notifySyncFailure();
          }
        }
      }
    } finally {
      _syncing = false;
    }
  }

  // Load persisted pending writes on startup and flush if online
  localforage.getItem('dc:pending').then(saved => {
    if (saved && typeof saved === 'object') Object.assign(_pending, saved);
    _flushPendingWrites();
  }).catch(() => {});

  window.addEventListener('online', () => _flushPendingWrites());

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
      const { data, error } = await _supabase.from('projects').upsert(row).select().single();
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
    // Lightweight report-count-per-project in ONE query (avoids N+1 + pulling
    // full report rows just to count). Falls back to per-project on error.
    async countsForProjects(projectIds) {
      const ids = (projectIds || []).filter(Boolean);
      const counts = {};
      ids.forEach(id => { counts[id] = 0; });
      if (!ids.length) return counts;
      try {
        const { data, error } = await _supabase.from('reports').select('project_id').in('project_id', ids);
        throwIf(error);
        (data || []).forEach(r => { counts[r.project_id] = (counts[r.project_id] || 0) + 1; });
        return counts;
      } catch (_) {
        await Promise.all(ids.map(async id => { counts[id] = (await Reports.getForProject(id)).length; }));
        return counts;
      }
    },
    async get(id) {
      return _query(`report_${id}`, async () => {
        const { data, error } = await _supabase.from('reports').select('*').eq('id', id).maybeSingle();
        throwIf(error);
        return mapReport(data);
      });
    },
    async save(report) {
      // Optimistic local-first
      const listKey = `reports_${report.projectId}`;
      const itemKey = `report_${report.id}`;
      const cachedList = _mGet(listKey) || await _lfGet(listKey) || [];
      const updatedList = cachedList.some(r => r.id === report.id)
        ? cachedList.map(r => r.id === report.id ? report : r)
        : [...cachedList, report];
      _mSet(listKey, updatedList);
      _mSet(itemKey, report);
      _lfSet(listKey, updatedList);
      _lfSet(itemKey, report);
      // Sync to Supabase in background
      _enqueuePendingWrite('report', report);
      _flushPendingWrites();
      return report;
    },
    async delete(id) {
      _mClear(`reports_`, `report_${id}`);
      // Drop any queued writes for this report (and its notes) so a background
      // sync cannot recreate what the user just deleted.
      _dequeuePendingWrite('report_' + id);
      Object.entries(_pending)
        .filter(([, w]) => w.type === 'note' && w.data?.reportId === id)
        .forEach(([k]) => _dequeuePendingWrite(k));
      const { error } = await _supabase.from('reports').delete().eq('id', id);
      throwIf(error);
    },
    async getNextNumber(projectId) {
      let max = 0;
      // Check local cache (includes offline-created reports)
      const cached = _mGet(`reports_${projectId}`) || await _lfGet(`reports_${projectId}`) || [];
      cached.forEach(r => { max = Math.max(max, r.reportNumber || 0); });
      // Also check pending writes
      Object.values(_pending).filter(w => w.type === 'report' && w.data.projectId === projectId)
        .forEach(w => { max = Math.max(max, w.data.reportNumber || 0); });
      if (navigator.onLine) {
        try {
          const { data } = await _supabase.from('reports').select('report_number')
            .eq('project_id', projectId).order('report_number', { ascending: false }).limit(1);
          max = Math.max(max, (data?.[0]?.report_number) || 0);
        } catch (_) {}
      }
      return max + 1;
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
    // Lightweight note-count-per-report in ONE query — selects only report_id, so
    // it does NOT pull the heavy media payloads just to count. Falls back per-report.
    async countsForReports(reportIds) {
      const ids = (reportIds || []).filter(Boolean);
      const counts = {};
      ids.forEach(id => { counts[id] = 0; });
      if (!ids.length) return counts;
      try {
        const { data, error } = await _supabase.from('notes').select('report_id').in('report_id', ids);
        throwIf(error);
        (data || []).forEach(n => { counts[n.report_id] = (counts[n.report_id] || 0) + 1; });
        return counts;
      } catch (_) {
        await Promise.all(ids.map(async id => { counts[id] = (await Notes.getForReport(id)).length; }));
        return counts;
      }
    },
    async get(id) {
      const { data, error } = await _supabase.from('notes').select('*').eq('id', id).maybeSingle();
      throwIf(error);
      return mapNote(data);
    },
    async save(note) {
      // Optimistic local-first: update memory + localforage immediately
      const key = `notes_${note.reportId}`;
      const cached = _mGet(key) || await _lfGet(key) || [];
      const updated = cached.some(n => n.id === note.id)
        ? cached.map(n => n.id === note.id ? note : n)
        : [...cached, note];
      _mSet(key, updated);
      _lfSet(key, updated);
      // Sync to Supabase in background
      _enqueuePendingWrite('note', note);
      _flushPendingWrites();
      return note;
    },
    async delete(id) {
      // We don't know reportId here, so clear all note caches
      _mClear('notes_');
      _dequeuePendingWrite('note_' + id);   // prevent a queued write from recreating it
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
