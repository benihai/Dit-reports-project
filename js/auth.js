const Auth = (() => {
  let _currentUser    = null;
  let _currentProfile = null;

  let _profilePromise = null;
  let _logoutRequested = false;   // true only for an explicit user logout

  function init(onAuthChange) {
    _supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user) {
        _currentUser = session.user;
        _logoutRequested = false;
        if (!_currentProfile || _currentProfile.id !== _currentUser.id) {
          _profilePromise = _loadProfile().catch(() => null);
        }
      } else {
        _currentUser    = null;
        _currentProfile = null;
        _profilePromise = null;
        _clearCachedProfiles();
      }
      if (typeof onAuthChange === 'function') onAuthChange(event, session);
    });
  }

  async function ensureProfile() {
    if (_currentProfile) return _currentProfile;
    if (_profilePromise) {
      try {
        await Promise.race([
          _profilePromise,
          new Promise(resolve => setTimeout(resolve, 8000)),
        ]);
      } catch (_) {}
    }
    // No client-side profile creation: provisioning is handled by the
    // `handle_new_user` DB trigger at signup. If no profile exists here, the
    // account was removed by an admin (or the trigger failed) — do NOT recreate
    // it, otherwise a "deleted" user would silently resurrect with default access.
    return _currentProfile;
  }

  function _metaPersonId() {
    const raw = _currentUser?.user_metadata?.person_id;
    return raw && String(raw).trim() ? String(raw).trim() : null;
  }

  async function _syncMissingFields(profile) {
    if (!profile || !_currentUser) return profile;
    const updates = {};
    const metaPersonId = _metaPersonId();
    if (!profile.person_id && metaPersonId) updates.person_id = metaPersonId;
    if (!profile.email && _currentUser.email) updates.email = _currentUser.email;
    if (!profile.name && (_currentUser.user_metadata?.name || _currentUser.email)) {
      updates.name = _currentUser.user_metadata?.name || _currentUser.email;
    }
    if (Object.keys(updates).length === 0) return profile;
    const { data, error } = await _supabase
      .from('profiles')
      .update(updates)
      .eq('id', profile.id)
      .select()
      .single();
    return (!error && data) ? data : profile;
  }

  // Attach the list of folders (people) the user may access. A user can now be
  // assigned several folders via the profile_folders table; profiles.person_id
  // remains the "primary" one (first selected) and is always included.
  async function _attachFolders(profile) {
    if (!profile) return profile;
    try {
      const { data, error } = await _supabase
        .from('profile_folders')
        .select('person_id')
        .eq('user_id', profile.id);
      if (error) throw error;
      const ids = (data || []).map(r => r.person_id).filter(Boolean);
      if (profile.person_id && !ids.includes(profile.person_id)) ids.unshift(profile.person_id);
      profile.personIds = ids;
    } catch (_) {
      // Offline / RLS hiccup — fall back to the single legacy folder.
      profile.personIds = profile.person_id ? [profile.person_id] : [];
    }
    return profile;
  }

  // ── Offline profile cache ────────────────────────────────────────────────
  // The session itself is persisted by Supabase (persistSession). But the role
  // lives in the `profiles` table, which needs the network. We cache it so a
  // previously-logged-in user reopening OFFLINE keeps their role and routes.
  const _PROFILE_CACHE_PREFIX = 'dc:profile:';
  function _cacheProfile(p) {
    try { if (p && p.id) localStorage.setItem(_PROFILE_CACHE_PREFIX + p.id, JSON.stringify(p)); } catch (_) {}
  }
  function _readCachedProfile(userId) {
    try { const raw = localStorage.getItem(_PROFILE_CACHE_PREFIX + userId); return raw ? JSON.parse(raw) : null; }
    catch (_) { return null; }
  }
  function _clearCachedProfiles() {
    try { Object.keys(localStorage).filter(k => k.startsWith(_PROFILE_CACHE_PREFIX)).forEach(k => localStorage.removeItem(k)); }
    catch (_) {}
  }

  // Read the session Supabase persisted in localStorage (storageKey set in
  // supabase-client.js). Lets us boot OFFLINE even when the SDK reports "no
  // session" because it couldn't refresh the access token without a network.
  function _storedSession() {
    try {
      const raw = localStorage.getItem('dit-reports-auth');
      if (!raw) return null;
      const p = JSON.parse(raw);
      const s = (p && p.user) ? p : ((p && (p.currentSession || p.session)) || null);
      return (s && s.user) ? s : null;
    } catch (_) { return null; }
  }
  // Offline re-entry: adopt the persisted user + cached profile so a previously
  // logged-in user gets back into the app without a connection.
  function adoptStoredUserOffline() {
    const s = _storedSession();
    if (!s || !s.user) return null;
    _currentUser = s.user;
    const cached = _readCachedProfile(_currentUser.id);
    if (cached) _currentProfile = cached;
    return _currentUser;
  }
  function wasLogoutRequested() { return _logoutRequested; }

  async function _loadProfile() {
    if (!_currentUser) return null;
    try {
      const { data, error } = await _supabase
        .from('profiles')
        .select('*')
        .eq('id', _currentUser.id)
        .maybeSingle();
      if (error) throw error;
      if (data) {
        _currentProfile = await _syncMissingFields(data);
        _currentProfile = await _attachFolders(_currentProfile);   // load assigned folders
        _cacheProfile(_currentProfile);   // keep a copy for offline boot
        return _currentProfile;
      }
      // Reachable but no row → account not provisioned / removed. Do not recreate.
      _currentProfile = null;
      return null;
    } catch (err) {
      // Network/offline: restore the cached profile so the user stays logged in
      // with the correct role instead of being downgraded/locked out.
      const cached = _readCachedProfile(_currentUser.id);
      if (cached) { _currentProfile = cached; return _currentProfile; }
      _currentProfile = null;
      return null;
    }
  }

  async function login(email, password) {
    const { data, error } = await _supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  }

  async function logout() {
    _logoutRequested = true;
    _clearCachedProfiles();
    const { error } = await _supabase.auth.signOut();
    if (error) throw error;
  }

  function getUser()    { return _currentUser; }
  function getProfile() { return _currentProfile; }
  function isAdmin()    { return _currentProfile?.role === 'admin'; }
  function isLoggedIn() { return !!_currentUser; }

  // All folders the user can access (multi-folder). Falls back to the single
  // legacy person_id when the folder list hasn't been loaded (e.g. offline).
  function getAssignedPersonIds() {
    const ids = _currentProfile?.personIds;
    if (Array.isArray(ids) && ids.length) return ids;
    return _currentProfile?.person_id ? [_currentProfile.person_id] : [];
  }

  // Primary / default folder — first in the list (back-compat).
  function getAssignedPersonId() {
    return getAssignedPersonIds()[0] || null;
  }

  function canAccessPerson(personId) {
    if (!personId) return false;
    if (isAdmin()) return true;
    return getAssignedPersonIds().includes(personId);
  }

  async function canAccessProject(projectId) {
    if (!projectId) return false;
    if (isAdmin()) return true;
    const project = await Storage.Projects.get(projectId);
    return project ? canAccessPerson(project.personId) : false;
  }

  async function canAccessReport(reportId) {
    if (!reportId) return false;
    if (isAdmin()) return true;
    const report = await Storage.Reports.get(reportId);
    if (!report) return false;
    // Viewers gain access via report_permissions — RLS only returns a report
    // row here if the viewer is permitted, so a non-null result means allowed.
    if (_currentProfile?.role === 'viewer') return true;
    return canAccessProject(report.projectId);
  }

  async function _upsertProfile(row) {
    const { data, error } = await _supabase
      .from('profiles')
      .upsert(row, { onConflict: 'id' })
      .select()
      .single();
    if (error) throw error;
    if (!data) throw new Error('לא ניתן לשמור פרופיל משתמש');
    return data;
  }

  async function syncMyProfile() {
    if (!_currentUser) return;
    const email = _currentUser.email || '';
    const name  = _currentProfile?.name || _currentUser.user_metadata?.name || email;
    const needsEmail = !_currentProfile?.email && email;
    const needsName  = !_currentProfile?.name && name;
    if (!needsEmail && !needsName) return _currentProfile;

    const row = {
      id: _currentUser.id,
      email: email || _currentProfile?.email || null,
      name: name || _currentProfile?.name || null,
      role: _currentProfile?.role || _currentUser.user_metadata?.role || 'user',
    };
    try {
      _currentProfile = await _upsertProfile(row);
    } catch (_) {}
    return _currentProfile;
  }

  // personIds: array of folder (person) ids. The first is stored as the
  // primary profiles.person_id; all of them are written to profile_folders.
  async function createUser(email, password, name, role, personIds = []) {
    const ids = Array.isArray(personIds) ? personIds.filter(Boolean) : (personIds ? [personIds] : []);
    const primaryId = ids[0] || null;

    const tempClient = supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        storageKey: 'dit-reports-auth-temp-' + Date.now(),
      }
    });

    const { data, error } = await tempClient.auth.signUp({
      email,
      password,
      options: {
        data: { name, role, person_id: primaryId || '' }
      }
    });
    if (error) throw error;

    if (!data.user) {
      throw new Error(
        'המשתמש לא נוצר. ב-Supabase: Authentication → Providers → Email — כבה את "Confirm email".'
      );
    }

    await tempClient.auth.signOut();

    const profileRow = {
      id: data.user.id,
      email,
      name: name || email,
      role,
      person_id: primaryId,
    };

    let saved = null;
    for (let attempt = 0; attempt < 6; attempt++) {
      try {
        saved = await _upsertProfile(profileRow);
        break;
      } catch (err) {
        if (attempt === 5) throw err;
        await new Promise(r => setTimeout(r, 350));
      }
    }

    // Write the full folder list (best-effort with a short retry — the profile
    // row must exist first, which the loop above guarantees).
    if (role === 'user' && ids.length) {
      await setUserFolders(data.user.id, ids).catch(() => {});
    }

    return { ...data, profile: saved };
  }

  async function getAllUsers() {
    await syncMyProfile();

    const { data, error } = await _supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: true });
    if (error) throw error;

    const me = _currentUser;
    return (data || []).map(row => {
      if (me && row.id === me.id) {
        return {
          ...row,
          email: row.email || me.email || '',
          name: row.name || me.user_metadata?.name || me.email || '',
        };
      }
      return row;
    });
  }

  async function updateUserRole(userId, role) {
    const { data, error } = await _supabase
      .from('profiles')
      .update({ role })
      .eq('id', userId)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async function updateMyProfile({ name }) {
    if (!_currentUser) throw new Error('לא מחובר');
    const { data, error } = await _supabase
      .from('profiles')
      .update({ name })
      .eq('id', _currentUser.id)
      .select()
      .single();
    if (error) throw error;
    _currentProfile = data;
    return data;
  }

  // ── Multi-folder assignment (admin) ──────────────────────────────────────
  // Folders the given user is assigned to.
  async function getUserFolders(userId) {
    const { data, error } = await _supabase
      .from('profile_folders')
      .select('person_id')
      .eq('user_id', userId);
    if (error) throw error;
    return (data || []).map(r => r.person_id).filter(Boolean);
  }

  // Folder assignments for ALL users, as { userId: [personId, ...] }.
  async function getAllUserFolders() {
    const { data, error } = await _supabase
      .from('profile_folders')
      .select('user_id, person_id');
    if (error) throw error;
    const map = {};
    (data || []).forEach(r => {
      if (!map[r.user_id]) map[r.user_id] = [];
      map[r.user_id].push(r.person_id);
    });
    return map;
  }

  // Replace the user's entire folder set. The first id is also mirrored to
  // profiles.person_id as the primary/default folder.
  async function setUserFolders(userId, personIds) {
    const ids = (personIds || []).filter(Boolean);

    const { error: delError } = await _supabase
      .from('profile_folders')
      .delete()
      .eq('user_id', userId);
    if (delError) throw delError;

    if (ids.length) {
      const rows = ids.map(person_id => ({ user_id: userId, person_id }));
      const { error: insError } = await _supabase.from('profile_folders').insert(rows);
      if (insError) throw insError;
    }

    const { data, error } = await _supabase
      .from('profiles')
      .update({ person_id: ids[0] || null })
      .eq('id', userId)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  // Back-compat single-folder setter (assigns exactly one folder).
  async function updateUserFolder(userId, personId) {
    return setUserFolders(userId, personId ? [personId] : []);
  }

  async function deleteUser(userId) {
    const { error: permError } = await _supabase
      .from('report_permissions')
      .delete()
      .eq('user_id', userId);
    if (permError) throw permError;

    const { error } = await _supabase
      .from('profiles')
      .delete()
      .eq('id', userId);
    if (error) throw error;
  }

  async function getReportPermissions(userId) {
    const { data, error } = await _supabase
      .from('report_permissions')
      .select('report_id')
      .eq('user_id', userId);
    if (error) throw error;
    return (data || []).map(row => row.report_id);
  }

  async function setReportPermissions(userId, reportIds) {
    const { error: delError } = await _supabase
      .from('report_permissions')
      .delete()
      .eq('user_id', userId);
    if (delError) throw delError;

    if (reportIds.length === 0) return;

    const rows = reportIds.map(report_id => ({ report_id, user_id: userId }));
    const { error: insError } = await _supabase
      .from('report_permissions')
      .insert(rows);
    if (insError) throw insError;
  }

  return {
    init,
    ensureProfile,
    login,
    logout,
    getUser,
    getProfile,
    isAdmin,
    isLoggedIn,
    adoptStoredUserOffline,
    wasLogoutRequested,
    getAssignedPersonId,
    getAssignedPersonIds,
    canAccessPerson,
    canAccessProject,
    canAccessReport,
    createUser,
    getAllUsers,
    updateUserRole,
    updateMyProfile,
    updateUserFolder,
    getUserFolders,
    getAllUserFolders,
    setUserFolders,
    deleteUser,
    getReportPermissions,
    setReportPermissions,
  };
})();
