-- ==============================================================================
-- Migration 002: Adiciona o oficiato 'Pastor' (atribuível apenas por Admin)
-- Execute este script no SQL Editor do seu projeto Supabase existente.
-- ==============================================================================

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT con.conname
        FROM pg_constraint con
        JOIN pg_class rel ON rel.oid = con.conrelid
        JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
        WHERE nsp.nspname = 'public'
          AND rel.relname = 'members'
          AND con.contype = 'c'
          AND pg_get_constraintdef(con.oid) ILIKE '%oficiato%'
    LOOP
        EXECUTE format('ALTER TABLE public.members DROP CONSTRAINT %I', r.conname);
    END LOOP;
END $$;

ALTER TABLE public.members
    ADD CONSTRAINT members_oficiato_check
    CHECK (oficiato IN ('Não oficial', 'Diácono', 'Presbítero', 'Pastor'));
