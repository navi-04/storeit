# Clear Database Feature Documentation

## Overview
The "Clear All Database" feature allows organization administrators to completely wipe all data from the database while preserving their own org admin account. This is a **highly destructive operation** and should be used with extreme caution.

## Purpose
This feature is useful for:
- **Testing and Development**: Quickly reset the database to a clean state
- **Demo Resets**: Clear demo data between presentations
- **Fresh Start**: Start over with a clean database without recreating the org admin account
- **Migration Preparation**: Clear old data before importing new data

## Access
- **Available to**: Organization Administrators only
- **Location**: Org Admin Dashboard → Danger Zone section (at the bottom)
- **Visual Indicator**: Red-bordered section with warning symbols

## What Gets Deleted

When you clear the database, the following data is **permanently deleted**:

### ✅ Deleted Data
1. **All Departments**
2. **All Users**
   - Super Admins
   - Faculty Members
   - Students
3. **All Classes**
4. **All Class Enrollments**
   - Faculty-Class assignments
   - Student-Class enrollments
5. **All Forms**
   - Student sections and fields
   - Faculty sections and fields
6. **All Form Data**
   - All student submissions
   - All faculty submissions

### ⚠️ Preserved Data
- **Your org admin account** (the currently logged-in account)
- Your username, email, and profile information

## How to Use

### Step 1: Navigate to Danger Zone
1. Log in as an organization administrator
2. Scroll to the bottom of the Org Admin Dashboard
3. Find the "Danger Zone" section (red-bordered)

### Step 2: Initiate Clear
1. Click the "🗑️ Clear All Database" button
2. A confirmation dialog will appear

### Step 3: Confirm Action
1. Read the warning message carefully
2. Type exactly: `DELETE EVERYTHING` (case-sensitive)
3. Click OK

### Step 4: Verification
- If successful, you'll see: "✅ Database cleared successfully!"
- If cancelled or wrong text entered, the operation is cancelled
- The page will refresh showing an empty database

## Safety Features

### Multi-Level Confirmation
1. **Visual Warning**: Red-bordered "Danger Zone" section
2. **Descriptive Text**: Clear explanation of consequences
3. **Confirmation Dialog**: Requires typing exact phrase
4. **Case-Sensitive**: Must type "DELETE EVERYTHING" exactly

### Account Preservation
- The system automatically preserves the current org admin's account
- Uses the authenticated user's ID to prevent self-deletion
- You remain logged in after clearing

### Error Handling
- If any error occurs, the operation stops
- Error messages are displayed clearly
- Partial deletions are prevented through database transactions

## Technical Implementation

### Frontend (OrgAdminDashboard.js)
```javascript
const clearDatabase = async () => {
  // 1. Show confirmation prompt requiring exact text match
  // 2. Get current user ID
  // 3. Delete all departments (cascades)
  // 4. Delete all profiles except current user
  // 5. Show success/error message
}
```

### Backend (Supabase)
The cascade deletion works through database constraints:
- `departments` → deletes → `classes` → deletes → all class-related data
- `departments` → deletes → `profiles` (users with department_id)
- Remaining `profiles` are manually deleted except current user

### Database Operations
1. **Delete all departments** → Cascades to:
   - classes
   - student_sections → student_section_fields → student_field_values
   - faculty_sections → faculty_section_fields → faculty_field_values
   - class_faculty
   - class_students
   - profiles (with department_id set)

2. **Delete remaining profiles** → Cascades to:
   - Any remaining field values
   - Any remaining class assignments

## Use Cases

### Development/Testing
```
Scenario: Developer wants to test user creation flow from scratch
Action: Clear database → Test creating departments → Test creating users
Result: Clean slate for testing
```

### Demo Reset
```
Scenario: Sales demo needs to be reset for next client
Action: Clear database → Re-import demo data
Result: Fresh demo environment
```

### Migration
```
Scenario: Moving from test data to production data
Action: Clear database → Import production data
Result: Clean production database
```

## Warnings and Best Practices

### ⚠️ CRITICAL WARNINGS

1. **NO UNDO**: Once cleared, data cannot be recovered
2. **NO BACKUP**: The feature does not create automatic backups
3. **INSTANT EFFECT**: Deletion happens immediately after confirmation
4. **ALL USERS LOST**: All users will be unable to log in (accounts deleted from auth.users)

### ✅ BEST PRACTICES

1. **Backup First**: Always export/backup data before clearing
   ```sql
   -- Example: Export from Supabase SQL Editor
   COPY (SELECT * FROM departments) TO '/tmp/departments_backup.csv' CSV HEADER;
   ```

2. **Verify Environment**: Ensure you're not in production
   - Check the database URL
   - Verify with team before clearing
   - Consider disabling feature in production

3. **Plan Recreation**: Have a plan for recreating necessary data
   - Prepare department list
   - Have user import ready
   - Plan class structure

4. **Test in Staging**: Test the clear operation in staging first
   - Verify cascade works correctly
   - Ensure your org admin account remains
   - Check for any orphaned data

5. **Document Actions**: Keep a log of when/why database was cleared
   - Who performed the action
   - Date and time
   - Reason for clearing
   - What data existed before

## Troubleshooting

### Issue: Button disabled
**Cause**: Another operation is in progress
**Solution**: Wait for current operation to complete

### Issue: "Not authenticated" error
**Cause**: Session expired
**Solution**: Log out and log back in

### Issue: Confirmation not working
**Cause**: Text doesn't match exactly
**Solution**: Type "DELETE EVERYTHING" exactly (case-sensitive, no spaces before/after)

### Issue: Partial data remains
**Cause**: Database constraint issue or RLS policy
**Solution**: Check Supabase logs, may need manual cleanup

## Disabling in Production

To disable this feature in production, you can:

### Option 1: Environment-based hiding
```javascript
// In OrgAdminDashboard.js
const isProduction = process.env.NODE_ENV === 'production';

// Conditionally render:
{!isProduction && (
  <section className="card" style={{ borderColor: '#dc3545', borderWidth: '2px' }}>
    {/* Clear Database UI */}
  </section>
)}
```

### Option 2: Feature flag
```javascript
const ENABLE_CLEAR_DATABASE = process.env.REACT_APP_ENABLE_CLEAR_DB === 'true';
```

### Option 3: RLS Policy
Add a database-level check to prevent clearing in production:
```sql
-- Create a production flag
CREATE TABLE IF NOT EXISTS system_config (
  key TEXT PRIMARY KEY,
  value TEXT
);

INSERT INTO system_config (key, value) VALUES ('environment', 'production');

-- Check before allowing deletions
CREATE POLICY "prevent_clear_in_prod" ON departments
FOR DELETE
USING (
  (SELECT value FROM system_config WHERE key = 'environment') != 'production'
  OR public.get_my_role() = 'org_admin'
);
```

## Alternative: Soft Delete

Consider implementing soft delete instead:
```sql
-- Add deleted_at column
ALTER TABLE departments ADD COLUMN deleted_at TIMESTAMPTZ;

-- Hide deleted items in queries
SELECT * FROM departments WHERE deleted_at IS NULL;

-- "Clear" by setting deleted_at
UPDATE departments SET deleted_at = NOW();

-- Restore if needed
UPDATE departments SET deleted_at = NULL WHERE id = 'xyz';
```

## Support

For issues or questions about this feature:
1. Check this documentation first
2. Review database logs in Supabase
3. Check browser console for frontend errors
4. Contact your development team

---

**Remember**: This is a destructive operation. Always backup before clearing!
