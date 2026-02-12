-- ============================================================
-- Migration: Fix faculty_field_values foreign key constraint
-- Issue: Foreign key references old table name 'faculty_fields'
--        instead of current 'faculty_section_fields'
-- ============================================================

-- Step 1: Drop the old foreign key constraint
ALTER TABLE public.faculty_field_values
DROP CONSTRAINT IF EXISTS faculty_field_values_field_id_fkey;

-- Step 2: Add the correct foreign key constraint
ALTER TABLE public.faculty_field_values
ADD CONSTRAINT faculty_field_values_field_id_fkey
FOREIGN KEY (field_id)
REFERENCES public.faculty_section_fields(id)
ON DELETE CASCADE;

-- Verification query (optional - run this to confirm fix)
-- SELECT
--   tc.constraint_name,
--   tc.table_name,
--   kcu.column_name,
--   ccu.table_name AS foreign_table_name,
--   ccu.column_name AS foreign_column_name
-- FROM information_schema.table_constraints AS tc
-- JOIN information_schema.key_column_usage AS kcu
--   ON tc.constraint_name = kcu.constraint_name
-- JOIN information_schema.constraint_column_usage AS ccu
--   ON ccu.constraint_name = tc.constraint_name
-- WHERE tc.table_name = 'faculty_field_values'
--   AND tc.constraint_type = 'FOREIGN KEY'
--   AND kcu.column_name = 'field_id';
