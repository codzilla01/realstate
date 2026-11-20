import nodemailer from 'nodemailer';
import { emailOK } from './admin-auth.mjs';

export function smtpDelivery(env) {
  const host = env.SMTP_HOST?.trim(), from = env.SMTP_FROM?.trim();
  const user = env.SMTP_USER, pass = env.SMTP_PASSWORD;
  if (!host && !from && !user && !pass) return undefined;
  if (!host || !from || !emailOK(from) || Boolean(user) !== Boolean(pass)) throw new Error('Set SMTP_HOST and a valid SMTP_FROM, and configure SMTP_USER and SMTP_PASSWORD together if your provider uses SMTP authentication');
  const port = Number(env.SMTP_PORT || 587);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('SMTP_PORT must be a valid TCP port');
  const transport = nodemailer.createTransport({
    host, port, secure: port === 465, requireTLS: port !== 465,
    ...(user && { auth: { user, pass } }),
    disableFileAccess: true, disableUrlAccess: true,
    connectionTimeout: 10_000, greetingTimeout: 10_000, socketTimeout: 15_000,
  });
  return async ({ to, code, expiresIn }) => {
    const result = await transport.sendMail({
      from: { name: 'المكتب العقاري', address: from }, to: { address: to, name: '' },
      subject: 'رمز تسجيل الدخول إلى لوحة المكتب العقاري',
      text: `رمز تسجيل الدخول إلى لوحة المكتب العقاري:\n\n${code}\n\nصالح لمدة ${expiresIn / 60} دقائق ويُستخدم مرة واحدة. لا تشارك الرمز مع أي شخص. إذا لم تطلب تسجيل الدخول، تجاهل هذه الرسالة.`,
    });
    if (!result.accepted.length) throw new Error('SMTP did not accept the recipient');
  };
}
