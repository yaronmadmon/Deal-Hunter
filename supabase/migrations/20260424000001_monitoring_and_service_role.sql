-- ─── Service role full access on owner_contacts ──────────────────────────────
-- Needed so run-deal-analyze (service-role key) can INSERT auto-traced contacts
CREATE POLICY "Service role full access owner_contacts"
  ON public.owner_contacts FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- ─── Area monitoring columns on saved_searches ────────────────────────────────
ALTER TABLE public.saved_searches
  ADD COLUMN IF NOT EXISTS is_monitored          boolean      NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS monitor_frequency_hours int         NOT NULL DEFAULT 24,
  ADD COLUMN IF NOT EXISTS last_monitored_at     timestamptz,
  ADD COLUMN IF NOT EXISTS seen_attom_ids        text[]       NOT NULL DEFAULT '{}';
