-- Automated, source-checked biographies for newly added Pheelm directors.
-- Existing people.bio values are not changed by this migration.
CREATE TABLE IF NOT EXISTS public.director_bio_jobs (
  person_id uuid PRIMARY KEY REFERENCES public.people(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued','processing','review','done','skipped','failed')),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  draft_bio text,
  source_urls text[] NOT NULL DEFAULT '{}'::text[],
  evidence text,
  reason text,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS director_bio_jobs_pending_idx
  ON public.director_bio_jobs (status,next_attempt_at,created_at);

ALTER TABLE public.director_bio_jobs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.director_bio_jobs FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.director_bio_jobs TO service_role;
GRANT SELECT ON TABLE public.director_bio_jobs TO authenticated;

DROP POLICY IF EXISTS "Admin-only biography job review" ON public.director_bio_jobs;
CREATE POLICY "Admin-only biography job review"
ON public.director_bio_jobs
FOR SELECT TO authenticated
USING (
 EXISTS (
   SELECT 1 FROM public.profiles AS viewer
   WHERE viewer.id = (SELECT auth.uid()) AND viewer.is_admin = true
 )
);

-- The job queue only targets directors credited on at least one published film,
-- and only if the existing biography is missing or substantially incomplete.
-- A manual bio is never changed by this function.
CREATE OR REPLACE FUNCTION public.pheelm_enqueue_director_biographies()
RETURNS integer
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $function$
DECLARE inserted_count integer;
BEGIN
  -- Recover an interrupted worker without allowing it to run indefinitely.
  UPDATE public.director_bio_jobs
  SET status = CASE WHEN attempts >= 3 THEN 'failed' ELSE 'queued' END,
      reason = 'lease_expired',
      next_attempt_at = now() + interval '30 minutes',
      updated_at = now()
  WHERE status = 'processing' AND started_at < now() - interval '12 minutes';

  WITH incoming AS (
    INSERT INTO public.director_bio_jobs (person_id)
    SELECT p.id
    FROM public.people AS p
    WHERE p.in_directory IS TRUE
      AND (
        length(trim(coalesce(p.bio,''))) < 1500
        OR coalesce(array_length(regexp_split_to_array(trim(coalesce(p.bio,'')), E'\n\n'), 1),0) < 4
      )
      AND EXISTS (
        SELECT 1
        FROM public.credits AS c
        JOIN public.films AS f ON f.id = c.film_id
        WHERE c.person_id = p.id
          AND c.role = 'director'
          AND f.status = 'published'
      )
    ON CONFLICT (person_id) DO NOTHING
    RETURNING person_id
  )
  SELECT count(*) INTO inserted_count FROM incoming;
  RETURN inserted_count;
END
$function$;
REVOKE ALL ON FUNCTION public.pheelm_enqueue_director_biographies() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pheelm_enqueue_director_biographies() TO service_role;
