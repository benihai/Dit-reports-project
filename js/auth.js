const Auth = (() => {
  let _currentUser    = null;
  let _currentProfile = null;

  // ── PUBLIC API ──────────────────────────────────────────────────────────────

  // Promise for the currently-in-flight profile load (so _startApp can await it)
  let _profilePromise = null;

  function init(onAuthChange) {
    _supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user) {
        _currentUser = session.user;
        // Start profile load in background — don't block the auth event.
        // _startApp() will call ensureProfile() to wait for it.
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

  // Wait for the in-flight profile load to finish (max 8 s).
  // Called by _startApp() before deciding admin vs viewer routes.
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
    return _currentProfile;
  }

  async function _loadProfile() {
    if (!_currentUser) return null;
    const { data, error } = await _supabase
      .from('profiles')
      .select('*')
      .eq('id', _currentUser.id)
      .single();
    if (!error && data) _currentProfile = data;
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

  // Creates a new user without disturbing the current admin session.
  async function createUser(email, password, name, role) {
    const tempClient = supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY, {
      auth: {
        persistSession: false,
        storageKey: 'dit-reports-auth-temp-' + Date.now(),
      }
    });

    const { data, error } = await tempClient.auth.signUp({
      email,
      password,
      options: {
        data: { name, role }
      }
    });
    if (error) throw error;

    // Sign out the temporary client to clean up any ephemeral session
    await tempClient.auth.signOut();

    return data;
  }

  async function getAllUsers() {
    const { data, error } = await _supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: true });
    if (error) throw error;
    return data || [];
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

  async function getReportPermissions(userId) {
    const { data, error } = await _supabase
      .from('report_permissions')
      .select('report_id')
      .eq('user_id', userId);
    if (error) throw error;
    return (data || []).map(row => row.report_id);
  }

  async function setReportPermissions(userId, reportIds) {
    // Remove all existing permissions for this user
    const { error: delError } = await _supabase
      .from('report_permissions')
      .delete()
      .eq('user_id', userId);
    if (delError) throw delError;

    // Insert new permissions (skip if empty array)
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
    createUser,
    getAllUsers,
    updateUserRole,
    getReportPermissions,
    setReportPermissions,
  };
})();
