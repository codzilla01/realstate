import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
export function localDatabase(path) {
  if (path !== ':memory:') mkdirSync(dirname(path), {recursive:true, mode:0o700});
  const connection = new DatabaseSync(path);
  connection.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000');
  return {
    local: true,
    get: (sql,args = []) => connection.prepare(sql).get(...args),
    all: (sql,args = []) => connection.prepare(sql).all(...args),
    run: (sql,args = []) => Number(connection.prepare(sql).run(...args).changes),
    batch(statements) {
      connection.exec('BEGIN IMMEDIATE');
      try {
        for (const {sql,args = []} of statements) connection.prepare(sql).run(...args);
        connection.exec('COMMIT');
      } catch (error) { connection.exec('ROLLBACK'); throw error; }
    },
    close: () => connection.close(),
  };
}
