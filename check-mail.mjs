import { mailErrorSummary, setupAdminMail } from './mail.mjs';

try {
  const { sendTest } = await setupAdminMail(process.env);
  await sendTest();
  console.log('SMTP accepted a test message for the configured admin inbox. Check the inbox and spam folder.');
} catch (error) {
  console.error(`Admin email check failed: ${mailErrorSummary(error)}`);
  process.exitCode = 1;
}
