const messages = {
  TURSO_CONFIG_MISSING: 'ربط قاعدة البيانات غير مكتمل. اضبط TURSO_DATABASE_URL وTURSO_AUTH_TOKEN في إعدادات Vercel للبيئة المستخدمة، ثم أعد النشر.',
  TURSO_URL_INVALID: 'رابط قاعدة Turso غير صالح. انسخ رابط قاعدة البيانات الذي يبدأ بـ libsql:// أو https://، ثم أعد النشر.',
  TURSO_ACCESS_DENIED: 'رفضت Turso الاتصال. اضبط رمز وصول صالحًا لهذه القاعدة بصلاحية القراءة والكتابة، ثم أعد النشر.',
  TURSO_DATABASE_NOT_FOUND: 'لم يتم العثور على قاعدة Turso. تحقّق من وجودها ومن أن TURSO_DATABASE_URL هو رابط القاعدة نفسها.',
  TURSO_UNAVAILABLE: 'تعذّر الاتصال بقاعدة Turso الآن. تحقّق من حالة القاعدة وسجل وظائف Vercel، ثم أعد المحاولة.',
};

export class CloudDatabaseError extends Error {
  constructor(code, missing = []) {
    super(messages[code]);
    this.code = code;
    this.status = 503;
    this.missing = missing;
  }
}

export function databaseError(error) {
  if (error instanceof CloudDatabaseError) return error;
  const providerCodes = new Set();
  const statuses = new Set();
  for (let cause = error, depth = 0; cause && depth < 5; cause = cause.cause, depth++) {
    if (cause instanceof CloudDatabaseError) return cause;
    providerCodes.add(cause.code);
    statuses.add(cause.status);
  }
  if (statuses.has(401) || statuses.has(403) || [...providerCodes].some(code => /^(?:SQLITE_AUTH|SQLITE_PERM|SQLITE_READONLY|AUTHORIZATION|UNAUTHORIZED|FORBIDDEN)(?:_|$)/.test(String(code)))) return new CloudDatabaseError('TURSO_ACCESS_DENIED');
  if (statuses.has(404) || providerCodes.has('DATABASE_NOT_FOUND')) return new CloudDatabaseError('TURSO_DATABASE_NOT_FOUND');
  if (providerCodes.has('URL_INVALID') || providerCodes.has('URL_SCHEME_NOT_SUPPORTED')) return new CloudDatabaseError('TURSO_URL_INVALID');
  return new CloudDatabaseError('TURSO_UNAVAILABLE');
}

export function databaseErrorBody(error) {
  return {error:error.message,code:error.code,...(error.missing.length && {missing:error.missing})};
}
