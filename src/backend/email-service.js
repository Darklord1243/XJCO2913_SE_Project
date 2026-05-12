const nodemailer = require('nodemailer');

const PLATFORM_NAME = 'E-Scooter Rental Platform';
const DEFAULT_SMTP_HOST = 'smtp.qq.com';
const DEFAULT_SMTP_PORT = 465;
const DEFAULT_SMTP_SECURE = true;

const DURATION_LABELS = {
  oneHour: '1 hour',
  fourHours: '4 hours',
  oneDay: '1 day',
  oneWeek: '1 week',
};

function cleanText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function parseSmtpPort(value) {
  const parsed = Number.parseInt(cleanText(value), 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : DEFAULT_SMTP_PORT;
}

function parseSmtpSecure(value) {
  const normalized = cleanText(value).toLowerCase();

  if (!normalized) {
    return DEFAULT_SMTP_SECURE;
  }

  return ['1', 'true', 'yes', 'on'].includes(normalized);
}

function buildSmtpConfig(env = process.env) {
  const user = cleanText(env.SMTP_USER);
  const pass = cleanText(env.SMTP_PASS);

  if (!user || !pass) {
    return { enabled: false };
  }

  const host = cleanText(env.SMTP_HOST) || DEFAULT_SMTP_HOST;
  const port = parseSmtpPort(env.SMTP_PORT);
  const secure = parseSmtpSecure(env.SMTP_SECURE);
  const from = cleanText(env.SMTP_FROM) || `${PLATFORM_NAME} <${user}>`;

  return {
    enabled: true,
    from,
    transport: {
      host,
      port,
      secure,
      auth: {
        user,
        pass,
      },
    },
  };
}

function getUserName(user) {
  return cleanText(user?.full_name) || cleanText(user?.fullName) || 'Rider';
}

function getUserEmail(user) {
  return cleanText(user?.email);
}

function getUserType(user) {
  return cleanText(user?.user_type) || cleanText(user?.userType) || 'standard';
}

function formatDuration(durationCode) {
  return DURATION_LABELS[durationCode] || cleanText(durationCode) || 'Unknown';
}

function formatCurrency(value) {
  const amount = Number(value);
  return `GBP ${Number.isFinite(amount) ? amount.toFixed(2) : '0.00'}`;
}

function formatTimestamp(value) {
  const text = cleanText(value);

  if (!text) {
    return 'Not available';
  }

  return text.replace('T', ' ').replace('Z', ' UTC');
}

function getBookingField(booking, camelName, snakeName) {
  return booking?.[camelName] ?? booking?.[snakeName] ?? '';
}

function buildRegistrationEmail(user) {
  const fullName = getUserName(user);
  const email = getUserEmail(user);
  const userType = getUserType(user);

  return {
    to: email,
    subject: `Welcome to ${PLATFORM_NAME}`,
    text: [
      `Hello ${fullName},`,
      '',
      `Your ${PLATFORM_NAME} account has been created successfully.`,
      '',
      `Name: ${fullName}`,
      `Email: ${email}`,
      `Account type: ${userType}`,
      '',
      `Thank you for using ${PLATFORM_NAME}.`,
    ].join('\n'),
  };
}

function buildBookingConfirmationEmail({ user, booking }) {
  const fullName = getUserName(user);
  const bookingId = getBookingField(booking, 'bookingId', 'id');
  const scooterId = getBookingField(booking, 'scooterId', 'scooter_id');
  const durationCode = getBookingField(
    booking,
    'durationCode',
    'duration_code'
  );
  const totalPrice = getBookingField(booking, 'totalPrice', 'total_price');
  const paymentReference = getBookingField(
    booking,
    'paymentReference',
    'payment_reference'
  );
  const createdAt = getBookingField(booking, 'createdAt', 'created_at');

  return {
    to: getUserEmail(user),
    subject: `Booking #${bookingId} confirmed`,
    text: [
      `Hello ${fullName},`,
      '',
      'Your booking has been confirmed.',
      '',
      `Booking ID: #${bookingId}`,
      `Scooter: ${scooterId}`,
      `Duration: ${formatDuration(durationCode)}`,
      `Total price: ${formatCurrency(totalPrice)}`,
      `Payment reference: ${paymentReference || 'Not available'}`,
      `Booked at: ${formatTimestamp(createdAt)}`,
      '',
      `Thank you for using ${PLATFORM_NAME}.`,
    ].join('\n'),
  };
}

function buildBookingCompletedEmail({ user, booking }) {
  const fullName = getUserName(user);
  const bookingId = getBookingField(booking, 'bookingId', 'id');
  const scooterId = getBookingField(booking, 'scooterId', 'scooter_id');
  const durationCode = getBookingField(
    booking,
    'durationCode',
    'duration_code'
  );
  const totalPrice = getBookingField(booking, 'totalPrice', 'total_price');
  const status = getBookingField(booking, 'status', 'status');
  const updatedAt = getBookingField(booking, 'updatedAt', 'updated_at');

  return {
    to: getUserEmail(user),
    subject: `Booking #${bookingId} completed`,
    text: [
      `Hello ${fullName},`,
      '',
      'Your booking has been completed.',
      '',
      `Booking ID: #${bookingId}`,
      `Scooter: ${scooterId}`,
      `Duration: ${formatDuration(durationCode)}`,
      `Total price: ${formatCurrency(totalPrice)}`,
      `Status: ${status || 'completed'}`,
      `Completed at: ${formatTimestamp(updatedAt)}`,
      '',
      `Thank you for using ${PLATFORM_NAME}.`,
    ].join('\n'),
  };
}

async function sendMailBestEffort(
  mail,
  {
    env = process.env,
    createTransport = nodemailer.createTransport,
    logger = console,
  } = {}
) {
  const config = buildSmtpConfig(env);

  if (!config.enabled) {
    return { skipped: true, reason: 'smtp_not_configured' };
  }

  if (!mail || !cleanText(mail.to) || !cleanText(mail.subject)) {
    return { skipped: true, reason: 'invalid_message' };
  }

  try {
    const transporter = createTransport(config.transport);
    await transporter.sendMail({
      ...mail,
      from: mail.from || config.from,
    });

    return { sent: true };
  } catch (error) {
    logger.error('Email notification failed:', error);
    return { sent: false, error };
  }
}

async function sendRegistrationEmail(user, options) {
  return sendMailBestEffort(buildRegistrationEmail(user), options);
}

async function sendBookingConfirmationEmail({ user, booking }, options) {
  return sendMailBestEffort(
    buildBookingConfirmationEmail({ user, booking }),
    options
  );
}

async function sendBookingCompletedEmail({ user, booking }, options) {
  return sendMailBestEffort(
    buildBookingCompletedEmail({ user, booking }),
    options
  );
}

module.exports = {
  buildBookingCompletedEmail,
  buildBookingConfirmationEmail,
  buildRegistrationEmail,
  buildSmtpConfig,
  sendBookingCompletedEmail,
  sendBookingConfirmationEmail,
  sendMailBestEffort,
  sendRegistrationEmail,
};
