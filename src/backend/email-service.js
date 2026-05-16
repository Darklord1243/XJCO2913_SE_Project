/**
 * Booking confirmation email sender.
 *
 * Configured via SMTP_* environment variables. If SMTP_HOST is unset the
 * module disables itself gracefully — no email is sent and a warning is
 * logged at startup. For local dev point a catch-all SMTP server (Mailpit,
 * Ethereal) at localhost:1025.
 *
 * Uses Node's built-in `net` module (no external dependencies) to speak
 * minimal SMTP. This is coursework-appropriate; a production service would
 * use a dedicated library (e.g. nodemailer) for retry, pooling, and DKIM.
 */
const net = require('net');

const SMTP_HOST = (process.env.SMTP_HOST || '').trim();
const SMTP_PORT = Number(process.env.SMTP_PORT) || 1025;
const SMTP_USER = (process.env.SMTP_USER || '').trim();
const SMTP_PASS = (process.env.SMTP_PASS || '').trim();
const SMTP_FROM =
  (process.env.SMTP_FROM || '').trim() || 'noreply@escooter.local';

const enabled = Boolean(SMTP_HOST);

function emailEnabled() {
  return enabled;
}

// ---------------------------------------------------------------------------
// Minimal SMTP client (plain-text SASL AUTH LOGIN only)
// ---------------------------------------------------------------------------

/**
 * Read one SMTP response line (may be multi-line when code is followed by
 * a hyphen, e.g. "250-SIZE"). Resolves with the last line whose trailing
 * code matches `expectedCode`.
 */
function readResponse(socket, expectedCode) {
  return new Promise((resolve, reject) => {
    let lastLine = '';
    let lastCode = 0;
    let buffer = '';

    function onData(chunk) {
      buffer += chunk.toString();

      // SMTP responses end with CRLF; multi-line lines have code-hyphen.
      // Process all complete lines in the buffer.
      let idx;
      while ((idx = buffer.indexOf('\r\n')) !== -1) {
        const line = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 2);
        lastLine = line;
        lastCode = Number(line.slice(0, 3)) || 0;

        // Lines with "CODE-" are continuations; "CODE " ends the response.
        if (line.length >= 4 && line[3] === ' ') {
          socket.removeListener('data', onData);
          socket.removeListener('error', onError);

          if (lastCode >= 400) {
            reject(
              new Error(`SMTP error (${lastCode}): ${lastLine.slice(4)}`)
            );
            return;
          }

          if (expectedCode !== undefined && lastCode !== expectedCode) {
            reject(
              new Error(
                `SMTP unexpected response ${lastCode} (expected ${expectedCode}): ${lastLine.slice(4)}`
              )
            );
            return;
          }

          resolve(lastLine);
          return;
        }
      }
    }

    function onError(err) {
      socket.removeListener('data', onData);
      socket.removeListener('error', onError);
      reject(err);
    }

    socket.on('data', onData);
    socket.once('error', onError);
  });
}

function sendCommand(socket, text) {
  return new Promise((resolve, reject) => {
    socket.write(text + '\r\n', (err) => {
      if (err) {
        reject(err);
        return;
      }
      resolve();
    });
  });
}

async function smtpSend(mailOptions) {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection({
      host: SMTP_HOST,
      port: SMTP_PORT,
    });

    let finished = false;

    function finish(err) {
      if (finished) return;
      finished = true;
      try {
        socket.end();
      } catch (_) {
        // Best-effort close.
      }
      if (err) reject(err);
      else resolve();
    }

    socket.once('error', (err) => {
      if (!finished) {
        finished = true;
        reject(new Error(`SMTP connection failed: ${err.message}`));
      }
    });

    (async () => {
      try {
        // 1. Greeting
        await readResponse(socket, 220);

        // 2. EHLO
        await sendCommand(socket, 'EHLO escooter.local');
        await readResponse(socket, 250);

        // 3. AUTH LOGIN if credentials provided
        if (SMTP_USER) {
          await sendCommand(socket, 'AUTH LOGIN');
          await readResponse(socket, 334);
          await sendCommand(
            socket,
            Buffer.from(SMTP_USER).toString('base64')
          );
          await readResponse(socket, 334);
          await sendCommand(
            socket,
            Buffer.from(SMTP_PASS).toString('base64')
          );
          await readResponse(socket, 235);
        }

        // 4. MAIL FROM
        await sendCommand(socket, `MAIL FROM:<${SMTP_FROM}>`);
        await readResponse(socket, 250);

        // 5. RCPT TO
        await sendCommand(socket, `RCPT TO:<${mailOptions.to}>`);
        await readResponse(socket, 250);

        // 6. DATA
        await sendCommand(socket, 'DATA');
        await readResponse(socket, 354);

        // Compose RFC 2822 message
        const message =
          `From: ${SMTP_FROM}\r\n` +
          `To: ${mailOptions.to}\r\n` +
          `Subject: ${mailOptions.subject}\r\n` +
          `Content-Type: text/plain; charset=utf-8\r\n` +
          `Content-Transfer-Encoding: 7bit\r\n` +
          `\r\n` +
          `${mailOptions.text}\r\n` +
          `.`;

        await sendCommand(socket, message);
        await readResponse(socket, 250);

        // 7. QUIT
        await sendCommand(socket, 'QUIT');
        finish(null);
      } catch (err) {
        finish(err);
      }
    })();
  });
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Fire-and-forget: send a booking confirmation email.
 * Errors are logged but never thrown — email failure must not
 * affect the HTTP response.
 */
async function sendBookingConfirmation(booking, user, scooter) {
  if (!enabled) {
    return;
  }

  if (!booking || !user || !user.email || !scooter) {
    console.warn(
      'Email: skipped send — missing booking, user email, or scooter data.'
    );
    return;
  }

  const planLabels = {
    oneHour: '1 Hour',
    fourHours: '4 Hours',
    oneDay: '1 Day',
    oneWeek: '1 Week',
  };

  const planLabel = planLabels[booking.duration_code] || booking.duration_code;
  const scooterLabel = scooter.scooter_id || 'Unknown';

  try {
    await smtpSend({
      to: user.email,
      subject: `Booking confirmed — ${scooterLabel} (${planLabel})`,
      text:
        `Hi ${user.full_name || 'Customer'},\n\n` +
        `Your booking has been confirmed.\n\n` +
        `  Scooter:      ${scooterLabel}\n` +
        `  Plan:         ${planLabel}\n` +
        `  Total price:  £${(booking.total_price ?? 0).toFixed(2)}\n` +
        `  Status:       ${booking.status || 'active'}\n\n` +
        `View your bookings at any time from the My Bookings page.\n\n` +
        `E-Scooter Hire`,
    });
  } catch (error) {
    console.error(
      'Email: failed to send booking confirmation:',
      error.message
    );
    // Never throw — email failure must not affect the HTTP response.
  }
}

module.exports = {
  emailEnabled,
  sendBookingConfirmation,
};
