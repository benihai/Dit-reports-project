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

  // ── Pending writes queue (offline-first sync) ───────────────────────────
  // Each queued op: { type, op, data, attempts, ts, status }
  //   type : 'note' | 'report' | 'project'   (which Supabase table)
  //   op   : 'upsert' | 'delete'
  //
  // Conflict policy: Last-Write-Wins — `upsert` overwrites the whole server
  // row, so the newest write to reach the server wins. Ops are keyed by
  // `${type}_${id}`, so a later edit/delete of the same record collapses onto
  // the earlier one (newest intent wins, queue stays small).
  //
  // Error handling: a network failure mid-flush stops the loop and keeps the
  // queue intact for the next 'online' / Background-Sync tick. A *server*
  // rejection (validation / RLS / conflict) increments `attempts`; after
  // _MAX_ATTEMPTS the op is parked as `status:'failed'` (dead-letter) so a
  // single bad row can never block the rest of the queue forever.
  const _pending = {};
  let _syncing = false;
  const _MAX_ATTEMPTS = 5;

  // type → { table, toRow } for the sync loop.
  const _SYNC_TABLES = {
    note:    { table: 'notes',    toRow: noteToRow },
    report:  { table: 'reports',  toRow: reportToRow },
    project: { table: 'projects', toRow: projectToRow },
  };

  function _syncStats() {
    const all = Object.values(_pending);
    return {
      online:  navigator.onLine,
      syncing: _syncing,
      pending: all.filter(w => w.status !== 'failed').length,
      failed:  all.filter(w => w.status === 'failed').length,
    };
  }

  // Broadcast queue state so the UI (NetStatus) can render "syncing… (N)".
  function _emitSyncState() {
    try { window.dispatchEvent(new CustomEvent('dc:syncstate', { detail: _syncStats() })); }
    catch (_) {}
  }

  function _persistQueue() { localforage.setItem('dc:pending', _pending).catch(() => {}); }

  // Ask the Service Worker to wake us when connectivity returns, even if the
  // tab is backgrounded. Progressive enhancement — unsupported on iOS Safari,
  // where the 'online' listener below is the reliable fallback.
  function _registerBgSync() {
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.ready
      .then(reg => reg.sync && reg.sync.register('dc-sync'))
      .catch(() => {});
  }

  function _enqueuePendingWrite(type, op, data) {
    _pending[`${type}_${data.id}`] = { type, op, data, attempts: 0, ts: Date.now() };
    _persistQueue();
    _emitSyncState();
    _registerBgSync();
  }

  function _dequeuePendingWrite(key) {
    delete _pending[key];
    _persistQueue();
    _emitSyncState();
  }

  async function _flushPendingWrites() {
    if (_syncing || !navigator.onLine) return;
    const keys = Object.keys(_pending).filter(k => _pending[k].status !== 'failed');
    if (keys.length === 0) return;
    _syncing = true;
    _emitSyncState();
    for (const key of keys) {
      const item = _pending[key];
      const cfg  = _SYNC_TABLES[item.type];
      if (!cfg) { _dequeuePendingWrite(key); continue; }
      try {
        const { error } = item.op === 'delete'
          ? await _supabase.from(cfg.table).delete().eq('id', item.data.id)
          : await _supabase.from(cfg.table).upsert(cfg.toRow(item.data));
        if (!error) {
          _dequeuePendingWrite(key);
        } else {
          // Server reachable but rejected the row — count it, park if exhausted.
          item.attempts++;
          if (item.attempts >= _MAX_ATTEMPTS) item.status = 'failed';
          _persistQueue();
        }
      } catch (_) {
        // Network error mid-flush → stop, keep queue, retry on next tick.
        break;
      }
    }
    _syncing = false;
    _emitSyncState();
  }

  // Re-arm parked (failed) ops — for a "retry sync" affordance in the UI.
  function retryFailedWrites() {
    Object.values(_pending).forEach(w => {
      if (w.status === 'failed') { delete w.status; w.attempts = 0; }
    });
    _persistQueue();
    _flushPendingWrites();
  }

  // Load persisted pending writes on startup and flush if online
  localforage.getItem('dc:pending').then(saved => {
    if (saved && typeof saved === 'object') Object.assign(_pending, saved);
    _emitSyncState();
    _flushPendingWrites();
  }).catch(() => {});

  window.addEventListener('online', () => _flushPendingWrites());

  // Background Sync API: the SW posts {type:'dc:flush'} on its 'sync' event.
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('message', e => {
      if (e.data && e.data.type === 'dc:flush') _flushPendingWrites();
    });
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
      // Optimistic local-first (same pattern as Reports/Notes) so creating a
      // project works fully offline; the row syncs when connectivity returns.
      const listKey = `projects_${project.personId}`;
      const itemKey = `project_${project.id}`;
      const cachedList = _mGet(listKey) || await _lfGet(listKey) || [];
      const updatedList = cachedList.some(p => p.id === project.id)
        ? cachedList.map(p => p.id === project.id ? project : p)
        : [project, ...cachedList];
      _mSet(listKey, updatedList);
      _mSet(itemKey, project);
      _lfSet(listKey, updatedList);
      _lfSet(itemKey, project);
      _enqueuePendingWrite('project', 'upsert', project);
      _flushPendingWrites();
      return project;
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
      _enqueuePendingWrite('report', 'upsert', report);
      _flushPendingWrites();
      return report;
    },
    async delete(id, projectId) {
      // Optimistic offline-first: drop from cache, queue the delete.
      if (projectId) {
        const key = `reports_${projectId}`;
        const cached = _mGet(key) || await _lfGet(key) || [];
        const updated = cached.filter(r => r.id !== id);
        _mSet(key, updated);
        _lfSet(key, updated);
      } else {
        _mClear('reports_');
      }
      _mClear(`report_${id}`);
      _enqueuePendingWrite('report', 'delete', { id });
      _flushPendingWrites();
    },
    async getNextNumber(projectId) {
      let max = 0;
      // Check local cache (includes offline-created reports)
      const cached = _mGet(`reports_${projectId}`) || await _lfGet(`reports_${projectId}`) || [];
      cached.forEach(r => { max = Math.max(max, r.reportNumber || 0); });
      // Also check pending writes (skip queued deletes — they carry only {id})
      Object.values(_pending).filter(w => w.type === 'report' && w.op !== 'delete' && w.data.projectId === projectId)
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
      _enqueuePendingWrite('note', 'upsert', note);
      _flushPendingWrites();
      return note;
    },
    async delete(id, reportId) {
      // Optimistic offline-first: drop from cache, queue the delete.
      // reportId lets us update the exact list cache; without it we fall back
      // to clearing all note caches (still correct, just less granular).
      if (reportId) {
        const key = `notes_${reportId}`;
        const cached = _mGet(key) || await _lfGet(key) || [];
        const updated = cached.filter(n => n.id !== id);
        _mSet(key, updated);
        _lfSet(key, updated);
      } else {
        _mClear('notes_');
      }
      _enqueuePendingWrite('note', 'delete', { id });
      _flushPendingWrites();
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

  return { generateId, People, Projects, Reports, Notes, Plans, retryFailedWrites, syncState: _syncStats };
})();
