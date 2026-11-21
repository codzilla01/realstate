import { cloudDatabase, initializeDatabase } from '../database.mjs';
import { databaseError } from '../cloud-database-errors.mjs';

let db;
try {
  db = await cloudDatabase(process.env);
  await initializeDatabase(db,false);
  const check = await db.get('SELECT 1 AS ok');
  if (check?.ok !== 1) throw new Error('Unexpected database response');
  console.log('Turso connection and application schema OK. No demo data was added.');
} catch (error) {
  const issue = databaseError(error);
  console.error(`${issue.code}${issue.missing.length ? ` (${issue.missing.join(', ')})` : ''}: ${issue.message}`);
  process.exitCode = 1;
} finally {
  db?.close();
}
