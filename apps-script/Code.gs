/**
 * Relais d'envoi JRM Autos pour Google Apps Script.
 * Déployer en web app « exécuter en tant que moi » et « toute personne, même
 * anonyme ». L'URL de déploiement doit rester secrète et être stockée côté Vercel.
 * MailApp envoie les messages, sans lire la boîte Gmail du compte expéditeur.
 */

const MAIL_TO = 'jrm.autos33@gmail.com';
const MAIL_FROM_NAME = 'Site JRM Autos';
const MAX_PER_MINUTE = 10;

function doGet() {
  return json_({ ok: true, service: 'JRM Autos mail relay' });
}

function doPost(event) {
  let request;
  try {
    request = JSON.parse(event && event.postData ? event.postData.contents : '{}');
  } catch (_) {
    return json_({ ok: false, raison: 'invalid_request' });
  }

  const subject = cleanLine_(request.subject, 200);
  const body = typeof request.body === 'string' ? request.body.slice(0, 10000) : '';
  const replyTo = cleanLine_(request.replyTo, 254);
  if (!subject || !body || !/^[^\s@<>(),;:"\\]+@[^\s@<>(),;:"\\]+\.[^\s@<>(),;:"\\]{2,}$/.test(replyTo)) {
    return json_({ ok: false, raison: 'invalid_message' });
  }

  if (!takeMinuteSlot_()) return json_({ ok: false, raison: 'rate_limited' });
  if (MailApp.getRemainingDailyQuota() < 1) return json_({ ok: false, raison: 'daily_quota' });

  try {
    MailApp.sendEmail({
      to: MAIL_TO,
      subject: subject,
      body: body,
      name: MAIL_FROM_NAME,
      replyTo: replyTo,
    });
    return json_({ ok: true });
  } catch (_) {
    return json_({ ok: false, raison: 'mail_service_error' });
  }
}

/** Run manually once from the editor to authorize the declared limited scopes. */
function authorizeMailSending() {
  return MailApp.getRemainingDailyQuota();
}

function takeMinuteSlot_() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) return false;
  try {
    const cache = CacheService.getScriptCache();
    const key = 'send-minute-' + Math.floor(Date.now() / 60000);
    const count = Number(cache.get(key) || 0);
    if (count >= MAX_PER_MINUTE) return false;
    cache.put(key, String(count + 1), 120);
    return true;
  } finally {
    lock.releaseLock();
  }
}

function cleanLine_(value, maxLength) {
  return (typeof value === 'string' ? value : '')
    .replace(/[\r\n\0]/g, ' ')
    .trim()
    .slice(0, maxLength);
}

function json_(value) {
  return ContentService.createTextOutput(JSON.stringify(value))
    .setMimeType(ContentService.MimeType.JSON);
}
