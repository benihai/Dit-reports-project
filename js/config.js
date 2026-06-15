const CONFIG = {
  SUPABASE_URL: 'https://plmvrqdaxfraizlillgm.supabase.co',
  SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsbXZycWRheGZyYWl6bGlsbGdtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg4NDM5NjksImV4cCI6MjA5NDQxOTk2OX0.eDhnBfZ3wZV2hafgCxhLXJGH1jprz_e_GAzcpfNGS0g',
  // Netlify function that renders the report HTML to a PDF with headless Chrome,
  // so every device (incl. iPhone) gets the exact same file as desktop. While
  // empty, PDF export falls back to the browser's window.print().
  PDF_RENDER_URL: '',
};
