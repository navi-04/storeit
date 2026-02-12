# Department Cascade Delete Implementation

## Overview
This implementation ensures that when an org admin deletes a department, **all related data is automatically deleted**. 

## What Gets Deleted

When a department is deleted, the following cascade deletions occur:

### 1. **Users (Profiles)**
   - All faculty members in that department
   - All students in that department
   - All super admins in that department
   - All org admins in that department (if any)

### 2. **Classes**
   - All classes belonging to that department

### 3. **Class Relationships**
   - All faculty-class assignments (`class_faculty`)
   - All student-class enrollments (`class_students`)

### 4. **Forms and Fields**
   - All student sections and their fields
   - All faculty sections and their fields
   - All field configurations for both student and faculty forms

### 5. **Form Data**
   - All student field values submitted by students
   - All faculty field values submitted by faculty members

## Implementation Details

### Database Changes

The key change is in the `profiles` table foreign key constraint:

**Before:**
```sql
department_id uuid references public.departments(id) on delete set null
```

**After:**
```sql
department_id uuid references public.departments(id) on delete cascade
```

This change means that instead of just setting `department_id` to NULL when a department is deleted, the entire user profile (and consequently all their related data) will be deleted.

### Cascade Chain

The deletion cascade follows this hierarchy:

```
Department
├── Classes (cascade delete)
│   ├── class_faculty (cascade delete)
│   ├── class_students (cascade delete)
│   ├── student_sections (cascade delete)
│   │   ├── student_section_fields (cascade delete)
│   │   │   └── student_field_values (cascade delete)
│   └── faculty_sections (cascade delete)
│       ├── faculty_section_fields (cascade delete)
│       │   └── faculty_field_values (cascade delete)
└── Profiles/Users (cascade delete)
    ├── student_field_values (cascade delete)
    └── faculty_field_values (cascade delete)
```

## Files Modified

1. **supabase/schema.sql**
   - Changed `profiles.department_id` constraint to `on delete cascade`

2. **src/pages/OrgAdminDashboard.js**
   - Updated the deletion confirmation message to clearly state what will be deleted

3. **supabase/migration-cascade-delete-dept.sql** (NEW)
   - Migration script to apply the changes to existing Supabase databases

## How to Apply Changes

### For New Database Setup
If you're setting up a fresh database, simply run the updated `schema.sql` file:

```bash
# In Supabase SQL Editor, run the schema.sql file
```

### For Existing Database
If you have an existing database with data, run the migration script:

```bash
# In Supabase SQL Editor, run the migration-cascade-delete-dept.sql file
```

Or manually execute:

```sql
-- Drop the existing foreign key constraint
ALTER TABLE public.profiles 
DROP CONSTRAINT IF EXISTS profiles_department_id_fkey;

-- Add the new constraint with ON DELETE CASCADE
ALTER TABLE public.profiles
ADD CONSTRAINT profiles_department_id_fkey 
FOREIGN KEY (department_id) 
REFERENCES public.departments(id) 
ON DELETE CASCADE;
```

## Testing

To verify the implementation works correctly:

1. **Create a test department**
   - Log in as org admin
   - Create a new department (e.g., "Test Department")

2. **Add related data**
   - Create a super admin in that department
   - Have the super admin create classes
   - Have the super admin create faculty and students
   - Have faculty/students fill out some forms

3. **Delete the department**
   - As org admin, delete the test department
   - Confirm the deletion with the warning dialog

4. **Verify deletion**
   - Check that the department is gone
   - Check that all users in that department are gone
   - Check that all classes are gone
   - Check that all form data is gone

## Safety Considerations

⚠️ **WARNING**: This is a destructive operation!

- Once a department is deleted, all data is **permanently removed**
- There is no undo functionality
- The confirmation dialog warns users about the consequences
- Consider implementing:
  - Database backups before deletions
  - Soft delete functionality (marking as deleted instead of removing)
  - Export functionality to backup department data before deletion

## Future Enhancements

Consider implementing these features:

1. **Soft Delete**: Add a `deleted_at` timestamp column instead of hard deleting
2. **Backup Export**: Allow exporting all department data before deletion
3. **Audit Log**: Track who deleted what and when
4. **Restore Functionality**: Keep deleted data for a period (e.g., 30 days) before permanent deletion
5. **Warning with Statistics**: Show count of affected users/classes before deletion
