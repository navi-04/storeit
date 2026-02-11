/* eslint-disable no-console */
const deps = ['@supabase/supabase-js'];

const missing = deps.filter((dep) => {
  try {
    require.resolve(dep);
    return false;
  } catch (error) {
    return true;
  }
});

if (missing.length > 0) {
  console.error('Missing required packages:');
  missing.forEach((dep) => console.error(` - ${dep}`));
  console.error('\nRun one of the following commands and try again:');
  console.error(' - npm ci');
  console.error(' - npm install');
  process.exit(1);
}

console.log('Dependency check passed.');
