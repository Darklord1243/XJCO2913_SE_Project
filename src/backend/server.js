require('dotenv').config();

const { app } = require('./app');
const { emailEnabled } = require('./email-service');

const port = process.env.PORT || 3000;

app.listen(port, () => {
  console.log(`Backend listening on port ${port}`);

  if (!emailEnabled()) {
    console.warn(
      'Email notifications are disabled. Set SMTP_USER+SMTP_PASS or SMTP_HOST ' +
        '(Mailpit) — see .env.example.'
    );
  }
});
