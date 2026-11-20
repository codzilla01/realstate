import { emailOK } from './admin-auth.mjs';

class MailConfigurationError extends Error {}

export function mailErrorSummary(error) {
  if (error instanceof MailConfigurationError) return error.message;
  switch (error?.code) {
    case 'EDNS': return 'SMTP host could not be resolved. Check SMTP_HOST.';
    case 'ETIMEDOUT':
    case 'ECONNECTION':
    case 'ESOCKET': return 'Could not establish an SMTP connection. Check the host, port, TLS, and outbound firewall.';
    case 'ETLS': return 'SMTP TLS negotiation failed. Check STARTTLS/implicit TLS and the server certificate.';
    case 'EAUTH': return 'SMTP authentication failed. Check the provider settings for SMTP_USER and SMTP_PASSWORD.';
    case 'EENVELOPE': return 'SMTP rejected the sender or recipient. Check that SMTP_FROM is verified and ADMIN_EMAIL is permitted.';
    case 'EMESSAGE': return 'SMTP rejected the message. Check the provider’s sending policy and logs.';
    default: return 'SMTP operation failed. Check the provider’s service and logs.';
  }
}

export async function setupAdminMail(env) {
  const adminEmail = env.ADMIN_EMAIL?.trim().toLowerCase(), host = env.SMTP_HOST?.trim(), from = env.SMTP_FROM?.trim();
  const user = env.SMTP_USER, pass = env.SMTP_PASSWORD;
  const missing = [['ADMIN_EMAIL', adminEmail], ['SMTP_HOST', host], ['SMTP_FROM', from]].filter(([, value]) => !value).map(([name]) => name);
  if (missing.length) throw new MailConfigurationError(`Set ${missing.join(', ')} on the server.`);
  if (adminEmail.length > 180 || !emailOK(adminEmail)) throw new MailConfigurationError('ADMIN_EMAIL must be a valid email address.');
  if (!emailOK(from)) throw new MailConfigurationError('SMTP_FROM must be a verified sender email address.');
  if (Boolean(user) !== Boolean(pass)) throw new MailConfigurationError('Set SMTP_USER and SMTP_PASSWORD together when the provider requires authentication.');
  const port = Number(env.SMTP_PORT || 587);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new MailConfigurationError('SMTP_PORT must be a valid TCP port.');
  let nodemailer;
  try { ({ default: nodemailer } = await import('nodemailer')); }
  catch (error) {
    if (error.code !== 'ERR_MODULE_NOT_FOUND') throw error;
    throw new MailConfigurationError('SMTP dependency not installed. Run npm ci on the server.');
  }
  const transport = nodemailer.createTransport({
    host, port, secure: port === 465, requireTLS: port !== 465,
    ...(user && { auth: { user, pass } }),
    disableFileAccess: true, disableUrlAccess: true,
    connectionTimeout: 10_000, greetingTimeout: 10_000, socketTimeout: 15_000,
  });
  async function send(subject, text) {
    const result = await transport.sendMail({
      from: { name: 'المكتب العقاري', address: from }, to: { address: adminEmail, name: '' }, subject, text,
    });
    if (!result.accepted.length) throw Object.assign(new Error('SMTP did not accept the recipient'), { code: 'EENVELOPE' });
  }
  return {
    adminEmail,
    deliverCode: ({ code, expiresIn }) => send('رمز تسجيل الدخول إلى لوحة المكتب العقاري', `رمز تسجيل الدخول إلى لوحة المكتب العقاري:\n\n${code}\n\nصالح لمدة ${expiresIn / 60} دقائق ويُستخدم مرة واحدة. لا تشارك الرمز مع أي شخص. إذا لم تطلب تسجيل الدخول، تجاهل هذه الرسالة.`),
    sendTest: () => send('اختبار البريد الإداري | المكتب العقاري', 'هذه رسالة اختبار لإعداد البريد الإداري. لا تحتوي على رمز دخول ولا تحتاج إلى أي إجراء.'),
  };
}
