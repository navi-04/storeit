-- ============================================================
-- StoreIt — Complete Database Schema (Clean Rebuild)
-- Run this in Supabase SQL Editor to set up from scratch
-- ============================================================

-- ============================================================
-- 0) DROP ALL EXISTING TABLES (cascade)
-- ============================================================
drop table if exists public.faculty_field_values cascade;
drop table if exists public.faculty_section_fields cascade;
drop table if exists public.faculty_sections cascade;
drop table if exists public.student_field_values cascade;
drop table if exists public.student_section_fields cascade;
drop table if exists public.student_sections cascade;
drop table if exists public.class_students cascade;
drop table if exists public.class_faculty cascade;
drop table if exists public.classes cascade;
drop table if exists public.profiles cascade;
drop table if exists public.departments cascade;

-- ============================================================
-- 1) TABLES
-- ============================================================

create table public.departments (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz default now()
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique,
  email text not null,
  full_name text not null default '',
  role text not null check (role in ('org_admin','super_admin','faculty','student')),
  department_id uuid references public.departments(id) on delete cascade,
  password text default '',
  created_at timestamptz default now()
);

create table public.classes (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  department_id uuid not null references public.departments(id) on delete cascade,
  created_at timestamptz default now()
);

create table public.class_faculty (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  faculty_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz default now(),
  unique(class_id, faculty_id)
);

create table public.class_students (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz default now(),
  unique(class_id, student_id)
);

create table public.student_sections (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  section_name text not null,
  section_order int default 0,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz default now()
);

create table public.student_section_fields (
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

create table public.student_field_values (
  id uuid primary key default gen_random_uuid(),
  field_id uuid not null references public.student_section_fields(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  value text default '',
  updated_at timestamptz default now(),
  unique(field_id, student_id)
);

create table public.faculty_sections (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  section_name text not null,
  section_order int default 0,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz default now()
);

create table public.faculty_section_fields (
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

create table public.faculty_field_values (
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
-- 3) HELPER FUNCTIONS
-- ============================================================

create or replace function public.get_my_role()
returns text language sql stable security definer set search_path = public
as $$ select role from public.profiles where id = auth.uid(); $$;

create or replace function public.get_my_department()
returns uuid language sql stable security definer set search_path = public
as $$ select department_id from public.profiles where id = auth.uid(); $$;

create or replace function public.faculty_owns_class(p_class_id uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.class_faculty cf
    where cf.class_id = p_class_id and cf.faculty_id = auth.uid()
  );
$$;

create or replace function public.student_in_class(p_class_id uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.class_students cs
    where cs.class_id = p_class_id and cs.student_id = auth.uid()
  );
$$;

-- Delete an auth user entirely (profile cascades via FK).
-- Callable from the client via supabase.rpc('delete_auth_user', { target_user_id: '...' })
create or replace function public.delete_auth_user(target_user_id uuid)
returns void language plpgsql security definer set search_path = public
as $$
begin
  delete from auth.users where id = target_user_id;
end;
$$;

-- ============================================================
-- 4) AUTO-CREATE PROFILE ON SIGNUP
-- ============================================================

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles (id, username, email, full_name, role, department_id, password)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    coalesce(new.raw_user_meta_data->>'role', 'student'),
    (new.raw_user_meta_data->>'department_id')::uuid,
    coalesce(new.raw_user_meta_data->>'password', '')
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
