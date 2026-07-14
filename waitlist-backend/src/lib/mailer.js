import nodemailer from 'nodemailer';

let transporter;

// Lazily build the transport from env. Returns null when SMTP isn't
// configured, so the app can run locally without a mail server.
function getTransporter() {
  if (transporter !== undefined) return transporter;

  const host = process.env.SMTP_HOST;
  if (!host) {
    transporter = null;
    return transporter;
  }

  const port = Number(process.env.SMTP_PORT) || 587;
  transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465, // implicit TLS on 465, STARTTLS otherwise
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
      : undefined,
  });
  return transporter;
}

const ROLE_LABEL = { client: 'Клієнт / Client', cook: 'Кухар / Cook' };

// Fire-and-forget owner notification. Never throws — a failed email must
// not fail the user's signup. Returns true if a message was sent.
export async function sendNewEntryNotification(entry) {
  const t = getTransporter();
  const notify = process.env.NOTIFY_EMAIL;

  if (!t || !notify) {
    console.warn(
      '[mailer] SMTP_HOST or NOTIFY_EMAIL not set — skipping notification for',
      entry.email,
    );
    return false;
  }

  const when = new Date(entry.createdAt).toLocaleString('uk-UA', {
    timeZone: 'Europe/Kyiv',
  });
  const role = ROLE_LABEL[entry.role] || entry.role;

  const text = [
    'Нова заявка у список очікування Ohnyk:',
    '',
    `Ім'я:     ${entry.name}`,
    `Телефон:  ${entry.phone}`,
    `Email:    ${entry.email}`,
    `Роль:     ${role}`,
    `Час:      ${when}`,
  ].join('\n');

  try {
    await t.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER || notify,
      to: notify,
      subject: `Ohnyk waitlist: ${entry.name} (${entry.role})`,
      text,
    });
    return true;
  } catch (err) {
    console.error('[mailer] failed to send notification:', err.message);
    return false;
  }
}
