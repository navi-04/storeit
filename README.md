# StoreIt — Student Detail Management System

A frontend-only web app built with **Create React App** + **Supabase** (Auth, Database, RLS). No backend server needed.

## Roles

| Role | Capabilities |
|------|-------------|
| **Org Admin** | Create departments, create Super Admin accounts |
| **Super Admin** | Create classes, faculty, students; assign faculty to classes; add students to classes |
| **Faculty** | Build dynamic student detail forms per class; create faculty-only fields; view student submissions |
| **Student** | View assigned class form fields; fill in and submit/update their details |

## Tech Stack

- React 19 (Create React App)
- Supabase JS Client (Auth + Database)
- React Router v6
- Plain CSS (responsive, mobile-first)

## Setup

### 1. Supabase Project

1. Go to [supabase.com](https://supabase.com) and create a new project.
2. In the SQL Editor, run the contents of **`supabase/schema.sql`** to create all tables, functions, and RLS policies.
3. Copy your **Project URL** and **anon/public key** from Settings → API.

### 2. Environment Variables

Edit `.env.local` in the project root:

```env
REACT_APP_SUPABASE_URL=https://your-project.supabase.co
REACT_APP_SUPABASE_ANON_KEY=your-anon-key-here
# Optional: domain used when users type only a username at login
REACT_APP_AUTH_EMAIL_DOMAIN=storeit.com
```

### 3. Install & Run

```bash
npm install
npm start
```

The app runs at `http://localhost:3000`.

### Troubleshooting local setup

If you see this error:

```
Module not found: Error: Can't resolve '@supabase/supabase-js'
```

run:

```bash
npm ci
```

(or `npm install`), then start again. The project now includes a preflight dependency check before `npm start`/`npm run build` that will tell you exactly which package is missing.

### 4. Create the First Org Admin

1. In Supabase Dashboard → Authentication → Users → **Add User**.
   - Email: `orgadmin@storeit.com`
   - Password: `OrgAdmin123!`
2. In SQL Editor, update the profile:
   ```sql
   UPDATE public.profiles
   SET role = 'org_admin', full_name = 'Org Administrator'
   WHERE email = 'orgadmin@storeit.com';
   ```
3. Log in at `http://localhost:3000/login` with those credentials.

### 5. Seed Data Walkthrough

1. **Org Admin**: Create a department (e.g., "Computer Science"), then create a Super Admin for it.
2. **Super Admin**: Create classes, faculty, and students. Assign faculty to classes and add students.
3. **Faculty**: Select a class → create form fields (Name, Roll No, Phone, etc.). Optionally create faculty-only fields.
4. **Student**: Login → see assigned class → fill in the dynamic form → save.

See `supabase/seed.sql` for more details.

## Project Structure

```
src/
  supabaseClient.js          # Supabase client init
  context/AuthContext.js      # Auth provider + session listener
  routes/ProtectedRoute.js    # Role-based route guard
  pages/
    LoginPage.js              # Login form
    OrgAdminDashboard.js      # Dept + Super Admin management
    SuperAdminDashboard.js    # Class, Faculty, Student management
    FacultyDashboard.js       # Form builder + view students
    StudentDashboard.js       # Dynamic form fill
  components/
    Navbar.js                 # Top nav with role + logout
    FormBuilder.js            # Dynamic field creator
    FieldRenderer.js          # Dynamic field renderer
  App.js                      # Router setup
  App.css                     # All styles
supabase/
  schema.sql                  # Tables + RLS policies
  seed.sql                    # Seed data instructions
```

## Database Tables

| Table | Purpose |
|-------|---------|
| `departments` | Organization departments |
| `profiles` | User profiles with role + department |
| `classes` | Classes within departments |
| `class_faculty` | Faculty ↔ Class assignment |
| `class_students` | Student ↔ Class assignment |
| `student_fields` | Dynamic form fields for students |
| `student_field_values` | Student-submitted values |
| `faculty_fields` | Dynamic form fields for faculty |
| `faculty_field_values` | Faculty-submitted values |

## RLS Policies Summary

- **Org Admin**: Full access to all tables
- **Super Admin**: CRUD within their own department only
- **Faculty**: Manage fields for assigned classes; read students in those classes
- **Student**: Read own profile + assigned class fields; insert/update own field values

## Important Notes

- Supabase email confirmation may be enabled by default. To skip during development, go to Supabase Dashboard → Authentication → Settings → disable "Enable email confirmations".
- All user creation uses `supabase.auth.signUp()` from the frontend with metadata, then updates the profile row.
- Login accepts either full email or username. Username login tries the configured domain (`REACT_APP_AUTH_EMAIL_DOMAIN`) and then fallback domains to reduce auth mismatch errors.
- The trigger `handle_new_user` auto-creates a profile row on signup.
