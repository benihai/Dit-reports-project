const Auth = (() => {
  let _currentUser    = null;
  let _currentProfile = null;

  let _profilePromise = null;

  function init(onAuthChange) {
    _supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user) {
        _currentUser = session.user;
        if (!_currentProfile || _currentProfile.id !== _currentUser.id) {
          _profilePromise = _loadProfile().catch(() => null);
        }
      } else {
        _currentUser    = null;
        _currentProfile = null;
        _profilePromise = null;
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
    if (!_currentProfile && _currentUser) {
      _currentProfile = await _bootstrapProfile();
    }
    return _currentProfile;
  }

  function _metaPersonId() {
    const raw = _currentUser?.user_metadata?.person_id;
    return raw && String(raw).trim() ? String(raw).trim() : null;
  }

  function _profileFromUser() {
    const meta = _currentUser.user_metadata || {};
    const role = ['admin', 'user', 'viewer'].includes(meta.role) ? meta.role : 'user';
    return {
      id: _currentUser.id,
      email: _currentUser.email || null,
      name: meta.name || _currentUser.email || 'משתמש',
      role,
      person_id: _metaPersonId(),
    };
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

  async function _bootstrapProfile() {
    if (!_currentUser) return null;
    const row = _profileFromUser();
    const { data, error } = await _supabase
      .from('profiles')
      .insert(row)
      .select()
      .single();
    if (!error && data) return data;
    const { data: existing } = await _supabase
      .from('profiles')
      .select('*')
      .eq('id', _currentUser.id)
      .maybeSingle();
    return existing ? _syncMissingFields(existing) : null;
  }

  async function _loadProfile() {
    if (!_currentUser) return null;
    const { data, error } = await _supabase
      .from('profiles')
      .select('*')
      .eq('id', _currentUser.id)
      .maybeSingle();
    if (!error && data) {
      _currentProfile = await _syncMissingFields(data);
      return _currentProfile;
    }
    _currentProfile = await _bootstrapProfile();
    return _currentProfile;
  }

  async function login(email, password) {
    const { data, error } = await _supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  }

  async function logout() {
    const { error } = await _supabase.auth.signOut();
    if (error) throw error;
  }

  function getUser()    { return _currentUser; }
  function getProfile() { return _currentProfile; }
  function isAdmin()    { return _currentProfile?.role === 'admin'; }
  function isLoggedIn() { return !!_currentUser; }

  function getAssignedPersonId() {
    return _currentProfile?.person_id || null;
  }

  function canAccessPerson(personId) {
    if (!personId) return false;
    if (isAdmin()) return true;
    return getAssignedPersonId() === personId;
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

  async function createUser(email, password, name, role, personId) {
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
        data: { name, role, person_id: personId || '' }
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
      person_id: personId || null,
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

  async function updateUserFolder(userId, personId) {
    const { data, error } = await _supabase
      .from('profiles')
      .update({ person_id: personId || null })
      .eq('id', userId)
      .select()
      .single();
    if (error) throw error;
    return data;
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
    getAssignedPersonId,
    canAccessPerson,
    canAccessProject,
    canAccessReport,
    createUser,
    getAllUsers,
    updateUserRole,
    updateMyProfile,
    updateUserFolder,
    deleteUser,
    getReportPermissions,
    setReportPermissions,
  };
})();
