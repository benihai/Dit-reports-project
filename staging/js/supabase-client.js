const _supabase = supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    storageKey: 'dit-reports-auth',
  }
});
