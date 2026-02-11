-- ============================================================
-- StoreIt - Supabase SQL Schema
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor)
-- ============================================================

-- 1) DEPARTMENTS
create table public.departments (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz default now()
);

-- 2) PROFILES (extends auth.users)
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique,
  email text not null,
  full_name text not null default '',
  role text not null check (role in ('org_admin','super_admin','faculty','student')),
  department_id uuid references public.departments(id) on delete set null,
  created_at timestamptz default now()
);

-- 3) CLASSES
create table public.classes (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  department_id uuid not null references public.departments(id) on delete cascade,
  created_at timestamptz default now()
);

-- 4) CLASS_FACULTY (mapping faculty -> class)
create table public.class_faculty (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  faculty_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz default now(),
  unique(class_id, faculty_id)
);

-- 5) CLASS_STUDENTS (mapping student -> class)
create table public.class_students (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz default now(),
  unique(class_id, student_id)
);

-- 6) STUDENT_FIELDS (dynamic fields created by faculty for student forms)
create table public.student_fields (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  field_name text not null,
  field_type text not null check (field_type in ('text','number','date','textarea','dropdown')),
  field_options jsonb default '[]'::jsonb,  -- for dropdown options
  field_order int default 0,
  required boolean default false,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz default now()
);

-- 7) STUDENT_FIELD_VALUES (student submitted values)
create table public.student_field_values (
  id uuid primary key default gen_random_uuid(),
  field_id uuid not null references public.student_fields(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  value text default '',
  updated_at timestamptz default now(),
  unique(field_id, student_id)
);

-- 8) FACULTY_FIELDS (fields for faculty details)
create table public.faculty_fields (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  field_name text not null,
  field_type text not null check (field_type in ('text','number','date','textarea','dropdown')),
  field_options jsonb default '[]'::jsonb,
  field_order int default 0,
  required boolean default false,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz default now()
);

-- 9) FACULTY_FIELD_VALUES
create table public.faculty_field_values (
  id uuid primary key default gen_random_uuid(),
  field_id uuid not null references public.faculty_fields(id) on delete cascade,
  faculty_id uuid not null references public.profiles(id) on delete cascade,
  value text default '',
  updated_at timestamptz default now(),
  unique(field_id, faculty_id)
);

-- ============================================================
-- Enable RLS on all tables
-- ============================================================
alter table public.departments enable row level security;
alter table public.profiles enable row level security;
alter table public.classes enable row level security;
alter table public.class_faculty enable row level security;
alter table public.class_students enable row level security;
alter table public.student_fields enable row level security;
alter table public.student_field_values enable row level security;
alter table public.faculty_fields enable row level security;
alter table public.faculty_field_values enable row level security;

-- ============================================================
-- Helper: get current user's role
-- ============================================================
create or replace function public.get_my_role()
returns text
language sql
stable
security definer
as $$
  select role from public.profiles where id = auth.uid();
$$;

-- Helper: get current user's department
create or replace function public.get_my_department()
returns uuid
language sql
stable
security definer
as $$
  select department_id from public.profiles where id = auth.uid();
$$;

-- ============================================================
-- RLS POLICIES
-- ============================================================

-- ---------- DEPARTMENTS ----------
-- Org admin: full access
create policy "org_admin_departments_all" on public.departments
  for all using (public.get_my_role() = 'org_admin');

-- Super admin: read own department
create policy "super_admin_departments_read" on public.departments
  for select using (
    public.get_my_role() = 'super_admin'
    and id = public.get_my_department()
  );

-- Faculty/Student: read own department
create policy "user_departments_read" on public.departments
  for select using (
    public.get_my_role() in ('faculty','student')
    and id = public.get_my_department()
  );

-- ---------- PROFILES ----------
-- Any authenticated user can always read their own profile row
-- (prevents circular RLS dependency with get_my_role)
create policy "self_profile_read" on public.profiles
  for select using (id = auth.uid());

-- Org admin: full access
create policy "org_admin_profiles_all" on public.profiles
  for all using (public.get_my_role() = 'org_admin');

-- Super admin: manage users in own department
create policy "super_admin_profiles_read" on public.profiles
  for select using (
    public.get_my_role() = 'super_admin'
    and department_id = public.get_my_department()
  );

create policy "super_admin_profiles_insert" on public.profiles
  for insert with check (
    public.get_my_role() = 'super_admin'
    and department_id = public.get_my_department()
  );

create policy "super_admin_profiles_update" on public.profiles
  for update using (
    public.get_my_role() = 'super_admin'
    and department_id = public.get_my_department()
  );

create policy "super_admin_profiles_delete" on public.profiles
  for delete using (
    public.get_my_role() = 'super_admin'
    and department_id = public.get_my_department()
  );

-- Faculty: read students in their classes + own profile
create policy "faculty_profiles_read" on public.profiles
  for select using (
    public.get_my_role() = 'faculty'
    and (
      id = auth.uid()
      or id in (
        select cs.student_id from public.class_students cs
        join public.class_faculty cf on cf.class_id = cs.class_id
        where cf.faculty_id = auth.uid()
      )
    )
  );

-- Student: read own profile
create policy "student_profiles_read" on public.profiles
  for select using (
    public.get_my_role() = 'student'
    and id = auth.uid()
  );

-- ---------- CLASSES ----------
-- Org admin: full access
create policy "org_admin_classes_all" on public.classes
  for all using (public.get_my_role() = 'org_admin');

-- Super admin: manage classes in own department
create policy "super_admin_classes_all" on public.classes
  for all using (
    public.get_my_role() = 'super_admin'
    and department_id = public.get_my_department()
  );

-- Faculty: read assigned classes
create policy "faculty_classes_read" on public.classes
  for select using (
    public.get_my_role() = 'faculty'
    and id in (select class_id from public.class_faculty where faculty_id = auth.uid())
  );

-- Student: read assigned classes
create policy "student_classes_read" on public.classes
  for select using (
    public.get_my_role() = 'student'
    and id in (select class_id from public.class_students where student_id = auth.uid())
  );

-- ---------- CLASS_FACULTY ----------
create policy "org_admin_class_faculty_all" on public.class_faculty
  for all using (public.get_my_role() = 'org_admin');

create policy "super_admin_class_faculty_all" on public.class_faculty
  for all using (
    public.get_my_role() = 'super_admin'
    and class_id in (select id from public.classes where department_id = public.get_my_department())
  );

create policy "faculty_class_faculty_read" on public.class_faculty
  for select using (
    public.get_my_role() = 'faculty'
    and faculty_id = auth.uid()
  );

create policy "student_class_faculty_read" on public.class_faculty
  for select using (
    public.get_my_role() = 'student'
    and class_id in (select class_id from public.class_students where student_id = auth.uid())
  );

-- ---------- CLASS_STUDENTS ----------
create policy "org_admin_class_students_all" on public.class_students
  for all using (public.get_my_role() = 'org_admin');

create policy "super_admin_class_students_all" on public.class_students
  for all using (
    public.get_my_role() = 'super_admin'
    and class_id in (select id from public.classes where department_id = public.get_my_department())
  );

create policy "faculty_class_students_read" on public.class_students
  for select using (
    public.get_my_role() = 'faculty'
    and class_id in (select class_id from public.class_faculty where faculty_id = auth.uid())
  );

create policy "student_class_students_read" on public.class_students
  for select using (
    public.get_my_role() = 'student'
    and student_id = auth.uid()
  );

-- ---------- STUDENT_FIELDS ----------
create policy "org_admin_student_fields_all" on public.student_fields
  for all using (public.get_my_role() = 'org_admin');

create policy "super_admin_student_fields_all" on public.student_fields
  for all using (
    public.get_my_role() = 'super_admin'
    and class_id in (select id from public.classes where department_id = public.get_my_department())
  );

create policy "faculty_student_fields_all" on public.student_fields
  for all using (
    public.get_my_role() = 'faculty'
    and class_id in (select class_id from public.class_faculty where faculty_id = auth.uid())
  );

create policy "student_student_fields_read" on public.student_fields
  for select using (
    public.get_my_role() = 'student'
    and class_id in (select class_id from public.class_students where student_id = auth.uid())
  );

-- ---------- STUDENT_FIELD_VALUES ----------
create policy "org_admin_sfv_all" on public.student_field_values
  for all using (public.get_my_role() = 'org_admin');

create policy "super_admin_sfv_read" on public.student_field_values
  for select using (
    public.get_my_role() = 'super_admin'
    and field_id in (
      select sf.id from public.student_fields sf
      join public.classes c on c.id = sf.class_id
      where c.department_id = public.get_my_department()
    )
  );

create policy "faculty_sfv_read" on public.student_field_values
  for select using (
    public.get_my_role() = 'faculty'
    and field_id in (
      select sf.id from public.student_fields sf
      join public.class_faculty cf on cf.class_id = sf.class_id
      where cf.faculty_id = auth.uid()
    )
  );

create policy "student_sfv_select" on public.student_field_values
  for select using (
    public.get_my_role() = 'student'
    and student_id = auth.uid()
  );

create policy "student_sfv_insert" on public.student_field_values
  for insert with check (
    public.get_my_role() = 'student'
    and student_id = auth.uid()
  );

create policy "student_sfv_update" on public.student_field_values
  for update using (
    public.get_my_role() = 'student'
    and student_id = auth.uid()
  );

-- ---------- FACULTY_FIELDS ----------
create policy "org_admin_faculty_fields_all" on public.faculty_fields
  for all using (public.get_my_role() = 'org_admin');

create policy "super_admin_faculty_fields_all" on public.faculty_fields
  for all using (
    public.get_my_role() = 'super_admin'
    and class_id in (select id from public.classes where department_id = public.get_my_department())
  );

create policy "faculty_faculty_fields_all" on public.faculty_fields
  for all using (
    public.get_my_role() = 'faculty'
    and class_id in (select class_id from public.class_faculty where faculty_id = auth.uid())
  );

-- ---------- FACULTY_FIELD_VALUES ----------
create policy "org_admin_ffv_all" on public.faculty_field_values
  for all using (public.get_my_role() = 'org_admin');

create policy "super_admin_ffv_read" on public.faculty_field_values
  for select using (
    public.get_my_role() = 'super_admin'
    and field_id in (
      select ff.id from public.faculty_fields ff
      join public.classes c on c.id = ff.class_id
      where c.department_id = public.get_my_department()
    )
  );

create policy "faculty_ffv_select" on public.faculty_field_values
  for select using (
    public.get_my_role() = 'faculty'
    and faculty_id = auth.uid()
  );

create policy "faculty_ffv_insert" on public.faculty_field_values
  for insert with check (
    public.get_my_role() = 'faculty'
    and faculty_id = auth.uid()
  );

create policy "faculty_ffv_update" on public.faculty_field_values
  for update using (
    public.get_my_role() = 'faculty'
    and faculty_id = auth.uid()
  );

-- ============================================================
-- Trigger: auto-create profile on signup (for org_admin bootstrap)
-- For admin-created users, profiles are inserted via the app
-- ============================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
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

-- Drop if exists then create
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- Service role function for creating users (called via supabase.auth.admin)
-- In frontend-only apps, user creation uses supabase-js signUp
-- with metadata, then profile is created via trigger + updated after.
-- ============================================================
