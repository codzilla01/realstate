import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { Writable } from 'node:stream';
import { hashAdminPassword } from '../admin-auth.mjs';

if (!stdin.isTTY) {
  console.error('Run this command in an interactive terminal. Do not put the password in a command or log.');
  process.exitCode = 1;
} else {
  const output = new Writable({write: (_data, _encoding, done) => done()});
  const prompt = createInterface({input:stdin, output, terminal:true, historySize:0});
  const cancel = new AbortController();
  prompt.on('SIGINT', () => cancel.abort());
  try {
    stdout.write('New admin password (hidden): ');
    const password = await prompt.question('',{signal:cancel.signal});
    stdout.write('\nRepeat password (hidden): ');
    const confirmation = await prompt.question('',{signal:cancel.signal});
    stdout.write('\n');
    if (password !== confirmation) throw new Error('Passwords did not match.');
    stdout.write(`ADMIN_PASSWORD_HASH=${await hashAdminPassword(password)}\n`);
  } catch (error) {
    console.error(error.name === 'AbortError' ? '\nCancelled.' : error.message);
    process.exitCode = 1;
  } finally { prompt.close(); }
}
