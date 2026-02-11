-- ============================================================
-- StoreIt - Supabase SQL Schema + FINAL SAFE RLS
-- (No recursive RLS 42P17)
-- ============================================================

-- ============================================================
-- 1) TABLES
-- ============================================================

-- 1) DEPARTMENTS
create table if not exists public.departments (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz default now()
);

-- 2) PROFILES (extends auth.users)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique,
  email text not null,
  full_name text not null default '',
  role text not null check (role in ('org_admin','super_admin','faculty','student')),
  department_id uuid references public.departments(id) on delete set null,
  created_at timestamptz default now()
);

-- 3) CLASSES
create table if not exists public.classes (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  department_id uuid not null references public.departments(id) on delete cascade,
  created_at timestamptz default now()
);

-- 4) CLASS_FACULTY
create table if not exists public.class_faculty (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  faculty_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz default now(),
  unique(class_id, faculty_id)
);

-- 5) CLASS_STUDENTS
create table if not exists public.class_students (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz default now(),
  unique(class_id, student_id)
);

-- 6) STUDENT_SECTIONS (each "field" is now a section with multiple sub-fields)
create table if not exists public.student_sections (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  section_name text not null,
  section_order int default 0,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz default now()
);

-- 7) STUDENT_SECTION_FIELDS (individual fields within a section)
create table if not exists public.student_section_fields (
  id uuid primary key default gen_random_uuid(),
  section_id uuid not null references public.student_sections(id) on delete cascade,
  field_name text not null,
  field_type text not null check (field_type in ('text','number','date','textarea','dropdown','link','checkbox')),
  field_options jsonb default '[]'::jsonb,
  field_order int default 0,
  required boolean default false,
  upload_link text default '',
  created_at timestamptz default now()
);

-- 8) STUDENT_FIELD_VALUES (values for each section field per student)
create table if not exists public.student_field_values (
  id uuid primary key default gen_random_uuid(),
  field_id uuid not null references public.student_section_fields(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  value text default '',
  updated_at timestamptz default now(),
  unique(field_id, student_id)
);

-- 9) FACULTY_SECTIONS
create table if not exists public.faculty_sections (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  section_name text not null,
  section_order int default 0,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz default now()
);

-- 10) FACULTY_SECTION_FIELDS
create table if not exists public.faculty_section_fields (
  id uuid primary key default gen_random_uuid(),
  section_id uuid not null references public.faculty_sections(id) on delete cascade,
  field_name text not null,
  field_type text not null check (field_type in ('text','number','date','textarea','dropdown','link','checkbox')),
  field_options jsonb default '[]'::jsonb,
  field_order int default 0,
  required boolean default false,
  upload_link text default '',
  created_at timestamptz default now()
);

-- 11) FACULTY_FIELD_VALUES
create table if not exists public.faculty_field_values (
  id uuid primary key default gen_random_uuid(),
  field_id uuid not null references public.faculty_section_fields(id) on delete cascade,
  faculty_id uuid not null references public.profiles(id) on delete cascade,
  value text default '',
  updated_at timestamptz default now(),
  unique(field_id, faculty_id)
);

-- ============================================================
-- 2) DISABLE RLS
-- ============================================================

alter table public.departments disable row level security;
alter table public.profiles disable row level security;
alter table public.classes disable row level security;
alter table public.class_faculty disable row level security;
alter table public.class_students disable row level security;
alter table public.student_sections disable row level security;
alter table public.student_section_fields disable row level security;
alter table public.student_field_values disable row level security;
alter table public.faculty_sections disable row level security;
alter table public.faculty_section_fields disable row level security;
alter table public.faculty_field_values disable row level security;

-- ============================================================
-- 3) SAFE SECURITY DEFINER HELPERS
-- (These DO NOT cause recursion)
-- ============================================================

-- Get my role (bypasses RLS safely)
create or replace function public.get_my_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

-- Get my department (bypasses RLS safely)
create or replace function public.get_my_department()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select department_id from public.profiles where id = auth.uid();
$$;

-- Check if current faculty is assigned to a class
create or replace function public.faculty_owns_class(p_class_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.class_faculty cf
    where cf.class_id = p_class_id
      and cf.faculty_id = auth.uid()
  );
$$;

-- Check if current student belongs to a class
create or replace function public.student_in_class(p_class_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.class_students cs
    where cs.class_id = p_class_id
      and cs.student_id = auth.uid()
  );
$$;

-- ============================================================
-- 4) DROP OLD POLICIES (SAFE RE-RUN)
-- ============================================================

do $$
declare
  r record;
begin
  for r in (
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
  )
  loop
    execute format('drop policy if exists %I on public.%I', r.policyname, r.tablename);
  end loop;
end $$;

-- ============================================================
-- 5) RLS POLICIES (FINAL)
-- ============================================================

-- ---------------- DEPARTMENTS ----------------

-- Org admin full access
create policy "org_admin_departments_all"
on public.departments
for all
to authenticated
using (public.get_my_role() = 'org_admin')
with check (public.get_my_role() = 'org_admin');

-- Super admin read own department
create policy "super_admin_departments_read"
on public.departments
for select
to authenticated
using (
  public.get_my_role() = 'super_admin'
  and id = public.get_my_department()
);

-- Faculty/Student read own department
create policy "user_departments_read"
on public.departments
for select
to authenticated
using (
  public.get_my_role() in ('faculty','student')
  and id = public.get_my_department()
);

-- ---------------- PROFILES ----------------
-- IMPORTANT: NO get_my_role() here (prevents recursion)

-- Everyone reads own profile
create policy "self_profile_read"
on public.profiles
for select
to authenticated
using (id = auth.uid());

-- Org admin full access
create policy "org_admin_profiles_all"
on public.profiles
for all
to authenticated
using (public.get_my_role() = 'org_admin')
with check (public.get_my_role() = 'org_admin');

-- Super admin can manage profiles in own department
create policy "super_admin_profiles_select"
on public.profiles
for select
to authenticated
using (
  public.get_my_role() = 'super_admin'
  and department_id = public.get_my_department()
);

create policy "super_admin_profiles_insert"
on public.profiles
for insert
to authenticated
with check (
  public.get_my_role() = 'super_admin'
  and department_id = public.get_my_department()
);

create policy "super_admin_profiles_update"
on public.profiles
for update
to authenticated
using (
  public.get_my_role() = 'super_admin'
  and department_id = public.get_my_department()
)
with check (
  public.get_my_role() = 'super_admin'
  and department_id = public.get_my_department()
);

create policy "super_admin_profiles_delete"
on public.profiles
for delete
to authenticated
using (
  public.get_my_role() = 'super_admin'
  and department_id = public.get_my_department()
);

-- Faculty can read students in their classes (NO role function inside)
create policy "faculty_read_students_profiles"
on public.profiles
for select
to authenticated
using (
  id = auth.uid()
  or exists (
    select 1
    from public.class_students cs
    join public.class_faculty cf on cf.class_id = cs.class_id
    where cs.student_id = profiles.id
      and cf.faculty_id = auth.uid()
  )
);

-- Students can only read themselves (already covered)
-- No extra needed


-- ---------------- CLASSES ----------------

-- Org admin full access
create policy "org_admin_classes_all"
on public.classes
for all
to authenticated
using (public.get_my_role() = 'org_admin')
with check (public.get_my_role() = 'org_admin');

-- Super admin manage classes in own department
create policy "super_admin_classes_all"
on public.classes
for all
to authenticated
using (
  public.get_my_role() = 'super_admin'
  and department_id = public.get_my_department()
)
with check (
  public.get_my_role() = 'super_admin'
  and department_id = public.get_my_department()
);

-- Faculty read assigned classes
create policy "faculty_classes_read"
on public.classes
for select
to authenticated
using (
  exists (
    select 1
    from public.class_faculty cf
    where cf.class_id = classes.id
      and cf.faculty_id = auth.uid()
  )
);

-- Student read assigned classes
create policy "student_classes_read"
on public.classes
for select
to authenticated
using (
  exists (
    select 1
    from public.class_students cs
    where cs.class_id = classes.id
      and cs.student_id = auth.uid()
  )
);

-- ---------------- CLASS_FACULTY ----------------

-- Org admin full access
create policy "org_admin_class_faculty_all"
on public.class_faculty
for all
to authenticated
using (public.get_my_role() = 'org_admin')
with check (public.get_my_role() = 'org_admin');

-- Super admin manage in department
create policy "super_admin_class_faculty_all"
on public.class_faculty
for all
to authenticated
using (
  public.get_my_role() = 'super_admin'
  and class_id in (select id from public.classes where department_id = public.get_my_department())
)
with check (
  public.get_my_role() = 'super_admin'
  and class_id in (select id from public.classes where department_id = public.get_my_department())
);

-- Faculty read own mappings
create policy "faculty_class_faculty_read"
on public.class_faculty
for select
to authenticated
using (faculty_id = auth.uid());

-- Students read faculty mappings for their classes
create policy "student_class_faculty_read"
on public.class_faculty
for select
to authenticated
using (
  exists (
    select 1
    from public.class_students cs
    where cs.class_id = class_faculty.class_id
      and cs.student_id = auth.uid()
  )
);

-- ---------------- CLASS_STUDENTS ----------------

-- Org admin full access
create policy "org_admin_class_students_all"
on public.class_students
for all
to authenticated
using (public.get_my_role() = 'org_admin')
with check (public.get_my_role() = 'org_admin');

-- Super admin manage in department
create policy "super_admin_class_students_all"
on public.class_students
for all
to authenticated
using (
  public.get_my_role() = 'super_admin'
  and class_id in (select id from public.classes where department_id = public.get_my_department())
)
with check (
  public.get_my_role() = 'super_admin'
  and class_id in (select id from public.classes where department_id = public.get_my_department())
);

-- Faculty read students of their class
create policy "faculty_class_students_read"
on public.class_students
for select
to authenticated
using (
  exists (
    select 1
    from public.class_faculty cf
    where cf.class_id = class_students.class_id
      and cf.faculty_id = auth.uid()
  )
);

-- Students read their own mapping
create policy "student_class_students_read"
on public.class_students
for select
to authenticated
using (student_id = auth.uid());


-- ---------------- STUDENT_SECTIONS ----------------

-- Org admin full access
create policy "org_admin_student_sections_all"
on public.student_sections
for all
to authenticated
using (public.get_my_role() = 'org_admin')
with check (public.get_my_role() = 'org_admin');

-- Super admin manage in department
create policy "super_admin_student_sections_all"
on public.student_sections
for all
to authenticated
using (
  public.get_my_role() = 'super_admin'
  and class_id in (select id from public.classes where department_id = public.get_my_department())
)
with check (
  public.get_my_role() = 'super_admin'
  and class_id in (select id from public.classes where department_id = public.get_my_department())
);

-- Faculty manage sections in assigned classes
create policy "faculty_student_sections_all"
on public.student_sections
for all
to authenticated
using (public.faculty_owns_class(class_id))
with check (public.faculty_owns_class(class_id));

-- Students read sections of their class
create policy "student_student_sections_read"
on public.student_sections
for select
to authenticated
using (public.student_in_class(class_id));


-- ---------------- STUDENT_SECTION_FIELDS ----------------

-- Org admin full access
create policy "org_admin_student_section_fields_all"
on public.student_section_fields
for all
to authenticated
using (public.get_my_role() = 'org_admin')
with check (public.get_my_role() = 'org_admin');

-- Super admin manage in department
create policy "super_admin_student_section_fields_all"
on public.student_section_fields
for all
to authenticated
using (
  public.get_my_role() = 'super_admin'
  and section_id in (
    select ss.id from public.student_sections ss
    join public.classes c on c.id = ss.class_id
    where c.department_id = public.get_my_department()
  )
)
with check (
  public.get_my_role() = 'super_admin'
  and section_id in (
    select ss.id from public.student_sections ss
    join public.classes c on c.id = ss.class_id
    where c.department_id = public.get_my_department()
  )
);

-- Faculty manage fields in sections of their classes
create policy "faculty_student_section_fields_all"
on public.student_section_fields
for all
to authenticated
using (
  section_id in (
    select ss.id from public.student_sections ss
    where public.faculty_owns_class(ss.class_id)
  )
)
with check (
  section_id in (
    select ss.id from public.student_sections ss
    where public.faculty_owns_class(ss.class_id)
  )
);

-- Students read fields of their class sections
create policy "student_student_section_fields_read"
on public.student_section_fields
for select
to authenticated
using (
  section_id in (
    select ss.id from public.student_sections ss
    where public.student_in_class(ss.class_id)
  )
);


-- ---------------- STUDENT_FIELD_VALUES ----------------

-- Org admin full access
create policy "org_admin_sfv_all"
on public.student_field_values
for all
to authenticated
using (public.get_my_role() = 'org_admin')
with check (public.get_my_role() = 'org_admin');

-- Super admin read values in department
create policy "super_admin_sfv_read"
on public.student_field_values
for select
to authenticated
using (
  public.get_my_role() = 'super_admin'
  and field_id in (
    select ssf.id
    from public.student_section_fields ssf
    join public.student_sections ss on ss.id = ssf.section_id
    join public.classes c on c.id = ss.class_id
    where c.department_id = public.get_my_department()
  )
);

-- Faculty read values for their class
create policy "faculty_sfv_read"
on public.student_field_values
for select
to authenticated
using (
  exists (
    select 1
    from public.student_section_fields ssf
    join public.student_sections ss on ss.id = ssf.section_id
    join public.class_faculty cf on cf.class_id = ss.class_id
    where ssf.id = student_field_values.field_id
      and cf.faculty_id = auth.uid()
  )
);

-- Student read own values
create policy "student_sfv_select"
on public.student_field_values
for select
to authenticated
using (student_id = auth.uid());

-- Student insert own values
create policy "student_sfv_insert"
on public.student_field_values
for insert
to authenticated
with check (student_id = auth.uid());

-- Student update own values
create policy "student_sfv_update"
on public.student_field_values
for update
to authenticated
using (student_id = auth.uid())
with check (student_id = auth.uid());


-- ---------------- FACULTY_SECTIONS ----------------

-- Org admin full access
create policy "org_admin_faculty_sections_all"
on public.faculty_sections
for all
to authenticated
using (public.get_my_role() = 'org_admin')
with check (public.get_my_role() = 'org_admin');

-- Super admin manage in department
create policy "super_admin_faculty_sections_all"
on public.faculty_sections
for all
to authenticated
using (
  public.get_my_role() = 'super_admin'
  and class_id in (select id from public.classes where department_id = public.get_my_department())
)
with check (
  public.get_my_role() = 'super_admin'
  and class_id in (select id from public.classes where department_id = public.get_my_department())
);

-- Faculty read sections for their classes
create policy "faculty_faculty_sections_read"
on public.faculty_sections
for select
to authenticated
using (public.faculty_owns_class(class_id));


-- ---------------- FACULTY_SECTION_FIELDS ----------------

-- Org admin full access
create policy "org_admin_faculty_section_fields_all"
on public.faculty_section_fields
for all
to authenticated
using (public.get_my_role() = 'org_admin')
with check (public.get_my_role() = 'org_admin');

-- Super admin manage in department
create policy "super_admin_faculty_section_fields_all"
on public.faculty_section_fields
for all
to authenticated
using (
  public.get_my_role() = 'super_admin'
  and section_id in (
    select fs.id from public.faculty_sections fs
    join public.classes c on c.id = fs.class_id
    where c.department_id = public.get_my_department()
  )
)
with check (
  public.get_my_role() = 'super_admin'
  and section_id in (
    select fs.id from public.faculty_sections fs
    join public.classes c on c.id = fs.class_id
    where c.department_id = public.get_my_department()
  )
);

-- Faculty read fields for their classes
create policy "faculty_faculty_section_fields_read"
on public.faculty_section_fields
for select
to authenticated
using (
  section_id in (
    select fs.id from public.faculty_sections fs
    where public.faculty_owns_class(fs.class_id)
  )
);


-- ---------------- FACULTY_FIELD_VALUES ----------------

-- Org admin full access
create policy "org_admin_ffv_all"
on public.faculty_field_values
for all
to authenticated
using (public.get_my_role() = 'org_admin')
with check (public.get_my_role() = 'org_admin');

-- Super admin read values in department
create policy "super_admin_ffv_read"
on public.faculty_field_values
for select
to authenticated
using (
  public.get_my_role() = 'super_admin'
  and field_id in (
    select fsf.id
    from public.faculty_section_fields fsf
    join public.faculty_sections fs on fs.id = fsf.section_id
    join public.classes c on c.id = fs.class_id
    where c.department_id = public.get_my_department()
  )
);

-- Faculty read own values
create policy "faculty_ffv_select"
on public.faculty_field_values
for select
to authenticated
using (faculty_id = auth.uid());

-- Faculty insert own values
create policy "faculty_ffv_insert"
on public.faculty_field_values
for insert
to authenticated
with check (faculty_id = auth.uid());

-- Faculty update own values
create policy "faculty_ffv_update"
on public.faculty_field_values
for update
to authenticated
using (faculty_id = auth.uid())
with check (faculty_id = auth.uid());


-- ============================================================
-- 6) TRIGGER: AUTO CREATE PROFILE ON SIGNUP
-- ============================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, username, email, full_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    coalesce(new.raw_user_meta_data->>'role', 'student')
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();
