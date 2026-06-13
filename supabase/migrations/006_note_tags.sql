-- ============================================================
-- 006 — Auto-tagging for findings (ממצאים)
-- Adds the responsibility type the user selected and the derived
-- tag used for filtering / smart report export.
-- ============================================================
ALTER TABLE public.notes ADD COLUMN IF NOT EXISTS responsibility_type TEXT;
ALTER TABLE public.notes ADD COLUMN IF NOT EXISTS tag TEXT;

-- Optional: speed up tag filtering when notes grow large
CREATE INDEX IF NOT EXISTS notes_tag_idx ON public.notes (tag);
