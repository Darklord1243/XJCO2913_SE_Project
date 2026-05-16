const test = require('node:test');
const assert = require('node:assert/strict');
const EventEmitter = require('events');
const net = require('net');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildBooking(overrides = {}) {
  return {
    id: 1,
    scooter_id: 'SCOOT-001',
    duration_code: 'oneHour',
    total_price: 5.5,
    status: 'active',
    ...overrides,
  };
}

function buildUser(overrides = {}) {
  return {
    id: 42,
    full_name: 'Ada Lovelace',
    email: 'ada@example.com',
    user_type: 'standard',
    ...overrides,
  };
}

function buildScooter(overrides = {}) {
  return {
    scooter_id: 'SCOOT-001',
    status: 'in_use',
    ...overrides,
  };
}

/** Create a mock socket that replays a script of SMTP responses for each write. */
function createMockSocket(responseScript) {
  const sock = new EventEmitter();
  let scriptIndex = 0;

  sock.write = function (data, cb) {
    const text = Buffer.isBuffer(data) ? data.toString() : data;
    // Schedule the next scripted response(s)
    if (scriptIndex < responseScript.length) {
      const responses = responseScript[scriptIndex];
      scriptIndex++;
      if (Array.isArray(responses)) {
        for (const r of responses) {
          setImmediate(() => sock.emit('data', r));
        }
      } else {
        setImmediate(() => sock.emit('data', responses));
      }
    }
    if (cb) cb(null);
    return true;
  };

  sock.end = function () {};

  // Start: emit greeting on first data listener
  const originalOn = sock.on.bind(sock);
  sock.on = function (event, handler) {
    return originalOn(event, handler);
  };

  return sock;
}

function clearEmailModule() {
  delete process.env.SMTP_HOST;
  delete require.cache[require.resolve('../src/backend/email-service')];
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test('email-service: when SMTP_HOST is unset email is disabled', async () => {
  delete process.env.SMTP_HOST;
  delete require.cache[require.resolve('../src/backend/email-service')];

  const { emailEnabled, sendBookingConfirmation } = require('../src/backend/email-service');

  assert.equal(emailEnabled(), false);

  // Should be a no-op (no error thrown)
  await sendBookingConfirmation(buildBooking(), buildUser(), buildScooter());

  clearEmailModule();
});

test('email-service: sendBookingConfirmation skips when data is missing', async () => {
  process.env.SMTP_HOST = 'localhost';
  delete require.cache[require.resolve('../src/backend/email-service')];

  const { emailEnabled, sendBookingConfirmation } = require('../src/backend/email-service');

  assert.equal(emailEnabled(), true);

  // Missing user.email — should skip without throwing
  await sendBookingConfirmation(
    buildBooking(),
    { id: 42, full_name: 'No Email', email: '' },
    buildScooter()
  );

  // Missing booking — should skip without throwing
  await sendBookingConfirmation(null, buildUser(), buildScooter());

  clearEmailModule();
});

test('email-service: sends well-formed SMTP message', async () => {
  process.env.SMTP_HOST = 'smtp.test';
  process.env.SMTP_PORT = '25';
  delete require.cache[require.resolve('../src/backend/email-service')];

  let capturedWrites = [];

  const originalCreateConnection = net.createConnection;
  net.createConnection = function (options) {
    const sock = new EventEmitter();
    let scriptIdx = 0;

    // Script: response after each write
    const greetings = ['220 smtp.test ready\r\n'];
    const afterEhlo = ['250-smtp.test\r\n250 HELP\r\n'];
    const afterMail = ['250 OK\r\n'];
    const afterRcpt = ['250 OK\r\n'];
    const afterData = ['354 Start mail input\r\n'];
    const afterBody = ['250 OK queued\r\n'];
    const afterQuit = ['221 Bye\r\n'];

    const script = [
      greetings,  // after connect (emitted immediately)
      afterEhlo,  // after EHLO write
      afterMail,  // after MAIL FROM write
      afterRcpt,  // after RCPT TO write
      afterData,  // after DATA write
      afterBody,  // after message body + dot
      afterQuit,  // after QUIT write
    ];

    // Emit greeting right after connect
    setImmediate(() => {
      if (greetings.length) {
        for (const r of greetings) sock.emit('data', r);
      }
    });

    sock.write = function (data, cb) {
      capturedWrites.push(Buffer.isBuffer(data) ? data.toString() : String(data));
      scriptIdx++;

      const responses = script[scriptIdx];
      if (responses) {
        for (const r of responses) {
          setImmediate(() => sock.emit('data', r));
        }
      }

      if (cb) cb(null);
      return true;
    };

    sock.end = function () {};
    return sock;
  };

  try {
    const { sendBookingConfirmation } = require('../src/backend/email-service');

    await sendBookingConfirmation(
      buildBooking({ duration_code: 'oneDay', total_price: 25.0 }),
      buildUser(),
      buildScooter()
    );

    const all = capturedWrites.join('');

    // Verify SMTP conversation structure
    assert.ok(all.includes('EHLO escooter.local'), 'EHLO');
    assert.ok(all.includes('MAIL FROM:<noreply@escooter.local>'), 'MAIL FROM');
    assert.ok(all.includes('RCPT TO:<ada@example.com>'), 'RCPT TO');
    assert.ok(all.includes('DATA\r\n'), 'DATA command');

    // Verify email content
    assert.ok(all.includes('Subject: Booking confirmed'), 'subject');
    assert.ok(all.includes('Scooter:      SCOOT-001'), 'scooter');
    assert.ok(all.includes('Plan:         1 Day'), 'plan label');
    assert.ok(all.includes('Total price:  £25.00'), 'price');
    assert.ok(all.includes('Hi Ada Lovelace'), 'user name');

    // Message body must contain CRLF dot CRLF (SMTP data terminator)
    assert.ok(all.includes('\r\n.\r\n'), 'message body includes dot terminator');

    // QUIT must be sent after the message body
    const dotIdx = all.lastIndexOf('\r\n.\r\n');
    const quitIdx = all.indexOf('QUIT\r\n');
    assert.ok(quitIdx > dotIdx, 'QUIT sent after message body');
  } finally {
    net.createConnection = originalCreateConnection;
    clearEmailModule();
  }
});

test('email-service: connection error is caught and does not throw', async () => {
  process.env.SMTP_HOST = 'smtp.down';
  delete require.cache[require.resolve('../src/backend/email-service')];

  const originalCreateConnection = net.createConnection;
  net.createConnection = function () {
    const sock = new EventEmitter();
    sock.write = function (data, cb) {
      if (cb) cb(null);
      return true;
    };
    sock.end = function () {};
    setImmediate(() => sock.emit('error', new Error('ECONNREFUSED')));
    return sock;
  };

  try {
    const { sendBookingConfirmation } = require('../src/backend/email-service');
    await sendBookingConfirmation(buildBooking(), buildUser(), buildScooter());
    assert.ok(true, 'does not throw on connection error');
  } finally {
    net.createConnection = originalCreateConnection;
    clearEmailModule();
  }
});

test('email-service: SMTP error response does not throw', async () => {
  process.env.SMTP_HOST = 'smtp.reject';
  delete require.cache[require.resolve('../src/backend/email-service')];

  const originalCreateConnection = net.createConnection;
  net.createConnection = function () {
    const sock = new EventEmitter();
    sock.write = function (data, cb) {
      if (cb) cb(null);
      return true;
    };
    sock.end = function () {};
    setImmediate(() => sock.emit('data', '550 Mailbox unavailable\r\n'));
    return sock;
  };

  try {
    const { sendBookingConfirmation } = require('../src/backend/email-service');
    await sendBookingConfirmation(buildBooking(), buildUser(), buildScooter());
    assert.ok(true, 'does not throw on SMTP error response');
  } finally {
    net.createConnection = originalCreateConnection;
    clearEmailModule();
  }
});
