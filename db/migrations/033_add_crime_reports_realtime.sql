-- Migration: Enable realtime for crime_reports so the admin web gets instant INSERT/UPDATE events

ALTER PUBLICATION supabase_realtime ADD TABLE public.crime_reports;
