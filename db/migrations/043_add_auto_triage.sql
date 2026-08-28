-- Migration 043: Automatic report triage & validation
-- IMPORTANT: Apply migration 042 first (adds urgency / validation columns).
--
-- When a resident submits a report, the system automatically:
--   1. Scores the report 0-100 based on incident type, description signals,
--      evidence, live-location sharing, GPS availability and time of day.
--   2. Assigns an urgency priority: critical (75+), high (55+), medium (30+), low.
--   3. Auto-validates the report, recording a readable explanation
--      (validation_notes) and the triage score for the admin web.
-- Admins can still manually adjust priority / dismiss afterward.

-- 1) Add the numeric triage score column
ALTER TABLE public.crime_reports
  ADD COLUMN IF NOT EXISTS triage_score INTEGER;

-- 2) Shared scoring function (pure / deterministic per row)
CREATE OR REPLACE FUNCTION public.compute_triage_score(
  p_crime_type TEXT,
  p_description TEXT,
  p_share_live_location BOOLEAN,
  p_photo_url TEXT,
  p_latitude NUMERIC,
  p_longitude NUMERIC,
  p_created_at TIMESTAMPTZ
) RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_score INTEGER;
  v_type   TEXT := coalesce(lower(p_crime_type), '');
  v_desc   TEXT := coalesce(lower(p_description), '');
  v_hour   INTEGER;
BEGIN
  -- Base weight per incident category (most dangerous = first response)
  v_score := CASE v_type
    WHEN 'emergency'       THEN 95
    WHEN 'hit-and-run'     THEN 85
    WHEN 'robbery'         THEN 80
    WHEN 'assault'         THEN 70
    WHEN 'burglary'        THEN 65
    WHEN 'theft'           THEN 45
    WHEN 'vandalism'       THEN 30
    WHEN 'lost-item'       THEN 25
    WHEN 'noise'           THEN 25
    WHEN 'complaint'       THEN 25
    WHEN 'accident'        THEN 25
    ELSE 45 -- others / unknown
  END;

  IF v_desc <> '' THEN
    -- Life-threatening / violent indicators (largest boost)
    IF EXISTS (
      SELECT 1 FROM unnest(ARRAY[
        'gun','firearm','knife','weapon','armed','shooting','shots','shot',
        'stabbed','stabbing','dead','killed','killing','murder','unconscious',
        'bleeding','blood','hostage','kidnapp','abduct','drowning','explosion',
        'bomb','burning','carjacking','hijack']) x
      WHERE strpos(v_desc, x) > 0
    ) THEN
      v_score := v_score + 15;
    END IF;

    -- In-progress / urgent on-going incident
    IF EXISTS (
      SELECT 1 FROM unnest(ARRAY[
        'in progress','in-progress','right now','immediately','urgent',
        'emergency','danger','threat','asap','ongoing','on-going','happening now']) x
      WHERE strpos(v_desc, x) > 0
    ) THEN
      v_score := v_score + 10;
    END IF;

    -- Vulnerable persons mentioned
    IF EXISTS (
      SELECT 1 FROM unnest(ARRAY[
        'child','children','student','school ','elderly','disabled','pregnant']) x
      WHERE strpos(v_desc, x) > 0
    ) THEN
      v_score := v_score + 8;
    END IF;

    -- Credibility doubt (lowers priority so admins verify first)
    IF EXISTS (
      SELECT 1 FROM unnest(ARRAY[
        'false report','joke','prank','hoax','just checking','already resolved',
        'mistaken','accidentally submitted','never happened','not real']) x
      WHERE strpos(v_desc, x) > 0
    ) THEN
      v_score := v_score - 25;
    END IF;

    -- Detailed description = more credible
    IF length(p_description) >= 40 THEN
      v_score := v_score + 3;
    END IF;
  ELSE
    v_score := v_score - 8; -- no description at all
  END IF;

  -- Evidence / context signals
  IF p_share_live_location IS TRUE THEN v_score := v_score + 8; END IF;
  IF p_photo_url IS NOT NULL AND p_photo_url <> '' THEN v_score := v_score + 5; END IF;
  IF p_latitude IS NOT NULL AND p_longitude IS NOT NULL THEN
    v_score := v_score + 3;
  ELSE
    v_score := v_score - 6;
  END IF;

  -- Late-night reports (22:00 - 04:59) carry higher risk
  IF p_created_at IS NOT NULL THEN
    v_hour := EXTRACT(HOUR FROM p_created_at)::INTEGER;
    IF v_hour >= 22 OR v_hour < 5 THEN
      v_score := v_score + 5;
    END IF;
  END IF;

  IF v_score > 100 THEN v_score := 100; END IF;
  IF v_score < 0 THEN v_score := 0; END IF;

  RETURN v_score;
END;
$$;

-- 3) Map a score to an urgency level
CREATE OR REPLACE FUNCTION public.triage_urgency_for_score(p_score INTEGER)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_score >= 75 THEN 'critical'
    WHEN p_score >= 55 THEN 'high'
    WHEN p_score >= 30 THEN 'medium'
    ELSE 'low'
  END;
$$;

-- 4) Auto-triage trigger: fires on every INSERT of a crime report
CREATE OR REPLACE FUNCTION public.auto_triage_crime_report()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_score   INTEGER;
  v_base    INTEGER;
  v_type    TEXT := coalesce(lower(NEW.crime_type), '');
  v_desc    TEXT := coalesce(lower(NEW.description), '');
  v_signals TEXT[] := '{}'::TEXT[];
BEGIN
  v_base := CASE v_type
    WHEN 'emergency'       THEN 95
    WHEN 'hit-and-run'     THEN 85
    WHEN 'robbery'         THEN 80
    WHEN 'assault'         THEN 70
    WHEN 'burglary'        THEN 65
    WHEN 'theft'           THEN 45
    WHEN 'vandalism'       THEN 30
    WHEN 'lost-item'       THEN 25
    WHEN 'noise'           THEN 25
    WHEN 'complaint'       THEN 25
    WHEN 'accident'        THEN 25
    ELSE 45
  END;

  v_score := public.compute_triage_score(
    NEW.crime_type,
    NEW.description,
    NEW.share_live_location,
    NEW.photo_url,
    NEW.latitude::numeric,
    NEW.longitude::numeric,
    NEW.created_at
  );

  -- Human-readable explanation of detected signals
  IF v_desc <> '' THEN
    IF EXISTS (SELECT 1 FROM unnest(ARRAY['gun','firearm','knife','weapon','armed','shooting','shots','stabbed','stabbing','dead','killed','killing','murder','unconscious','bleeding','blood','hostage','kidnapp','abduct','drowning','explosion','bomb','burning','carjacking','hijack']) x WHERE strpos(v_desc, x) > 0) THEN
      v_signals := v_signals || ARRAY['life-threatening keywords'];
    END IF;
    IF EXISTS (SELECT 1 FROM unnest(ARRAY['in progress','in-progress','right now','immediately','urgent','emergency','danger','threat','asap','ongoing','on-going','happening now']) x WHERE strpos(v_desc, x) > 0) THEN
      v_signals := v_signals || ARRAY['incident reported as in-progress'];
    END IF;
    IF EXISTS (SELECT 1 FROM unnest(ARRAY['child','children','student','school ','elderly','disabled','pregnant']) x WHERE strpos(v_desc, x) > 0) THEN
      v_signals := v_signals || ARRAY['vulnerable persons mentioned'];
    END IF;
    IF EXISTS (SELECT 1 FROM unnest(ARRAY['false report','joke','prank','hoax','just checking','already resolved','mistaken','accidentally submitted','never happened','not real']) x WHERE strpos(v_desc, x) > 0) THEN
      v_signals := v_signals || ARRAY['credibility doubt signals - verify first'];
    END IF;
    IF length(NEW.description) >= 40 THEN
      v_signals := v_signals || ARRAY['detailed description'];
    END IF;
  ELSE
    v_signals := v_signals || ARRAY['no description provided'];
  END IF;

  IF NEW.share_live_location IS TRUE THEN v_signals := v_signals || ARRAY['live location shared']; END IF;
  IF NEW.photo_url IS NOT NULL AND NEW.photo_url <> '' THEN v_signals := v_signals || ARRAY['media/evidence attached']; END IF;
  IF NEW.latitude IS NULL OR NEW.longitude IS NULL THEN v_signals := v_signals || ARRAY['no GPS location']; END IF;
  IF EXTRACT(HOUR FROM NEW.created_at)::INTEGER >= 22 OR EXTRACT(HOUR FROM NEW.created_at)::INTEGER < 5 THEN
    v_signals := v_signals || ARRAY['reported in late hours'];
  END IF;

  -- Persist auto-triage results
  NEW.urgency        := public.triage_urgency_for_score(v_score);
  NEW.triage_score   := v_score;
  NEW.is_validated   := TRUE; -- auto-validated by system
  NEW.validated_by   := NULL; -- system, not a human admin
  NEW.validated_at   := COALESCE(NEW.validated_at, now());
  NEW.validation_notes := 'Auto-validated by system. Type: ' || coalesce(NEW.crime_type, '-')
    || ' (base ' || v_base || '). Priority: ' || NEW.urgency
    || '. Score: ' || v_score || '/100.'
    || CASE WHEN cardinality(v_signals) > 0
       THEN ' Signals: ' || array_to_string(v_signals, ', ') || '.'
       ELSE '' END;

  RETURN NEW;
END;
$$;

-- 5) Attach the trigger to crime_reports inserts
DROP TRIGGER IF EXISTS trg_auto_triage ON public.crime_reports;
CREATE TRIGGER trg_auto_triage
  BEFORE INSERT ON public.crime_reports
  FOR EACH ROW EXECUTE FUNCTION public.auto_triage_crime_report();

-- 6) Backfill existing records with triage score + urgency
UPDATE public.crime_reports cr
SET
  triage_score = public.compute_triage_score(
    cr.crime_type, cr.description, cr.share_live_location,
    cr.photo_url, cr.latitude::numeric, cr.longitude::numeric, cr.created_at
  ),
  urgency = public.triage_urgency_for_score(public.compute_triage_score(
    cr.crime_type, cr.description, cr.share_live_location,
    cr.photo_url, cr.latitude::numeric, cr.longitude::numeric, cr.created_at
  ));

-- Helpful index for the priority queue in the admin web
CREATE INDEX IF NOT EXISTS idx_crime_reports_triage_score
  ON public.crime_reports (triage_score DESC NULLS LAST);