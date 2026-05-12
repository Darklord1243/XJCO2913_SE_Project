const assert = require('node:assert/strict');
const { describe, test } = require('node:test');

const {
  buildBookingCompletedEmail,
  buildBookingConfirmationEmail,
  buildRegistrationEmail,
  buildSmtpConfig,
  sendMailBestEffort,
} = require('../src/backend/email-service');

describe('email service', () => {
  test('skips sending when SMTP credentials are not configured', async () => {
    let createTransportCalled = false;

    const result = await sendMailBestEffort(
      {
        to: 'rider@test.local',
        subject: 'Test',
        text: 'Test body',
      },
      {
        env: {},
        createTransport: () => {
          createTransportCalled = true;
        },
      }
    );

    assert.equal(result.skipped, true);
    assert.equal(result.reason, 'smtp_not_configured');
    assert.equal(createTransportCalled, false);
  });

  test('uses QQ SMTP defaults when credentials are configured', () => {
    const config = buildSmtpConfig({
      SMTP_USER: '2833085151@qq.com',
      SMTP_PASS: 'smtp-code',
    });

    assert.equal(config.enabled, true);
    assert.equal(config.from, 'E-Scooter Rental Platform <2833085151@qq.com>');
    assert.equal(config.transport.host, 'smtp.qq.com');
    assert.equal(config.transport.port, 465);
    assert.equal(config.transport.secure, true);
    assert.deepEqual(config.transport.auth, {
      user: '2833085151@qq.com',
      pass: 'smtp-code',
    });
  });

  test('sends through injected transport when SMTP is configured', async () => {
    let capturedTransport = null;
    let capturedMail = null;

    const result = await sendMailBestEffort(
      {
        to: 'rider@test.local',
        subject: 'Test',
        text: 'Test body',
      },
      {
        env: {
          SMTP_USER: '2833085151@qq.com',
          SMTP_PASS: 'smtp-code',
        },
        createTransport: (transport) => {
          capturedTransport = transport;
          return {
            sendMail: async (mail) => {
              capturedMail = mail;
            },
          };
        },
      }
    );

    assert.equal(result.sent, true);
    assert.equal(capturedTransport.host, 'smtp.qq.com');
    assert.equal(
      capturedMail.from,
      'E-Scooter Rental Platform <2833085151@qq.com>'
    );
    assert.equal(capturedMail.to, 'rider@test.local');
  });

  test('registration email includes account details', () => {
    const mail = buildRegistrationEmail({
      full_name: 'Happy Rider',
      email: 'happy@test.local',
      user_type: 'student',
    });

    assert.equal(mail.to, 'happy@test.local');
    assert.match(mail.subject, /Welcome/);
    assert.match(mail.text, /Happy Rider/);
    assert.match(mail.text, /happy@test\.local/);
    assert.match(mail.text, /student/);
  });

  test('booking confirmation email includes booking and payment details', () => {
    const mail = buildBookingConfirmationEmail({
      user: {
        full_name: 'Happy Rider',
        email: 'happy@test.local',
      },
      booking: {
        bookingId: 42,
        scooterId: 'ESC-001',
        durationCode: 'oneHour',
        totalPrice: 5,
        paymentReference: 'PAY-1234',
        createdAt: '2026-05-12T10:00:00Z',
      },
    });

    assert.equal(mail.to, 'happy@test.local');
    assert.match(mail.subject, /Booking #42 confirmed/);
    assert.match(mail.text, /ESC-001/);
    assert.match(mail.text, /1 hour/);
    assert.match(mail.text, /GBP 5\.00/);
    assert.match(mail.text, /PAY-1234/);
  });

  test('booking completed email includes completion details', () => {
    const mail = buildBookingCompletedEmail({
      user: {
        full_name: 'Happy Rider',
        email: 'happy@test.local',
      },
      booking: {
        bookingId: 43,
        scooterId: 'ESC-002',
        durationCode: 'fourHours',
        totalPrice: 15,
        status: 'completed',
        updatedAt: '2026-05-12T11:00:00Z',
      },
    });

    assert.equal(mail.to, 'happy@test.local');
    assert.match(mail.subject, /Booking #43 completed/);
    assert.match(mail.text, /ESC-002/);
    assert.match(mail.text, /4 hours/);
    assert.match(mail.text, /completed/);
    assert.match(mail.text, /2026-05-12 11:00:00 UTC/);
  });
});
