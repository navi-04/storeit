-- Migration: Add cascade delete for department to profiles relationship
-- This ensures that when a department is deleted, all related users (faculty, students, super admins) are also deleted

-- Step 1: Drop the existing foreign key constraint
ALTER TABLE public.profiles 
DROP CONSTRAINT IF EXISTS profiles_department_id_fkey;

-- Step 2: Add the new constraint with ON DELETE CASCADE
ALTER TABLE public.profiles
ADD CONSTRAINT profiles_department_id_fkey 
FOREIGN KEY (department_id) 
REFERENCES public.departments(id) 
ON DELETE CASCADE;

-- Now when a department is deleted:
-- 1. All classes in that department will be deleted (already had cascade)
-- 2. All users (profiles) in that department will be deleted (NOW with cascade)
-- 3. All class-related data (class_faculty, class_students, sections, fields, values) will cascade delete
-- 4. All field values for those users will cascade delete
