const test = require('node:test');
const assert = require('node:assert/strict');

const {
  computeBookingPricing,
  isSimulatorSupportedPan,
  simulatePayment,
  validateCvv,
  validatePaymentPayload,
} = require('../src/backend/booking-service');

function buildValidPayment(overrides = {}) {
  return {
    cardholderName: 'Ada Lovelace',
    cardNumber: '4242 4242 4242 4242',
    expiryDate: '12/30',
    cvv: '123',
    ...overrides,
  };
}

test('validatePaymentPayload: accepts valid payment and returns normalized fields', () => {
  const result = validatePaymentPayload(buildValidPayment());

  assert.equal(result.ok, true);
  assert.deepEqual(result.value, {
    cardholderName: 'Ada Lovelace',
    cardNumber: '4242424242424242',
    expiryDate: '12/30',
    cvv: '123',
  });
});

test('validatePaymentPayload: trims cardholder/cvv and strips card-number whitespace', () => {
  const result = validatePaymentPayload(
    buildValidPayment({
      cardholderName: '  Ada Lovelace  ',
      cardNumber: '  4242  4242 4242   4242  ',
      cvv: ' 1234 ',
    })
  );

  assert.equal(result.ok, true);
  assert.equal(result.value.cardholderName, 'Ada Lovelace');
  assert.equal(result.value.cardNumber, '4242424242424242');
  assert.equal(result.value.cvv, '1234');
});

test('validatePaymentPayload: rejects non-object payloads', () => {
  for (const payload of [null, undefined, 'card', 42, [], true]) {
    const result = validatePaymentPayload(payload);
    assert.equal(result.ok, false);
    assert.equal(result.message, 'Payment details are required.');
  }
});

test('validatePaymentPayload: rejects empty cardholder name', () => {
  const result = validatePaymentPayload(
    buildValidPayment({ cardholderName: '   ' })
  );

  assert.equal(result.ok, false);
  assert.equal(result.message, 'Cardholder name is required.');
});

test('validatePaymentPayload: rejects invalid card number length and characters', () => {
  const shortCard = validatePaymentPayload(
    buildValidPayment({ cardNumber: '424242424242424' })
  );
  assert.equal(shortCard.ok, false);
  assert.equal(
    shortCard.message,
    'Card number must contain exactly 16 digits.'
  );

  const alphaCard = validatePaymentPayload(
    buildValidPayment({ cardNumber: '42424242424242AB' })
  );
  assert.equal(alphaCard.ok, false);
  assert.equal(
    alphaCard.message,
    'Card number must contain exactly 16 digits.'
  );
});

test('validatePaymentPayload: rejects malformed expiry date format', () => {
  const badFormat = validatePaymentPayload(
    buildValidPayment({ expiryDate: '12-30' })
  );
  assert.equal(badFormat.ok, false);
  assert.equal(badFormat.message, 'Expiry date must use MM/YY format.');
});

test('validatePaymentPayload: rejects out-of-range expiry month', () => {
  const badMonth = validatePaymentPayload(
    buildValidPayment({ expiryDate: '13/30' })
  );
  assert.equal(badMonth.ok, false);
  assert.equal(badMonth.message, 'Expiry month must be between 01 and 12.');
});

test('validatePaymentPayload: rejects invalid CVV lengths', () => {
  const tooShort = validatePaymentPayload(buildValidPayment({ cvv: '12' }));
  assert.equal(tooShort.ok, false);
  assert.equal(tooShort.message, 'CVV must contain 3 or 4 digits.');

  const tooLong = validatePaymentPayload(buildValidPayment({ cvv: '12345' }));
  assert.equal(tooLong.ok, false);
  assert.equal(tooLong.message, 'CVV must contain 3 or 4 digits.');
});

test('validatePaymentPayload: expired-looking dates still pass current validation rules', () => {
  // Current implementation validates format/month only, not real-world expiry age.
  const result = validatePaymentPayload(
    buildValidPayment({ expiryDate: '01/20' })
  );

  assert.equal(result.ok, true);
  assert.equal(result.value.expiryDate, '01/20');
});

test('simulatePayment: succeeds for supported success card', () => {
  const result = simulatePayment({ cardNumber: '4242424242424242' });

  assert.equal(result.ok, true);
  assert.equal(result.value.paymentStatus, 'paid');
  assert.match(result.value.paymentReference, /^PAY-\d+-4242$/);
});

test('simulatePayment: returns decline response for supported decline card', () => {
  const result = simulatePayment({ cardNumber: '4000000000000002' });

  assert.equal(result.ok, false);
  assert.equal(result.statusCode, 402);
  assert.equal(result.message, 'Payment was declined by the simulator.');
});

test('isSimulatorSupportedPan identifies coursework simulator cards only', () => {
  assert.equal(isSimulatorSupportedPan('4242424242424242'), true);
  assert.equal(isSimulatorSupportedPan('4000000000000002'), true);
  assert.equal(isSimulatorSupportedPan('4111111111111111'), false);
});

test('validateCvv accepts 3-4 digit codes', () => {
  assert.equal(validateCvv('123').ok, true);
  assert.equal(validateCvv('12').ok, false);
});

test('computeBookingPricing applies student discount once', () => {
  const result = computeBookingPricing({
    userType: 'student',
    weeklyHours: 0,
    baseTotalPrice: 10,
  });
  assert.equal(result.discountApplied, true);
  assert.equal(result.discountReason, 'student');
  assert.equal(result.originalPrice, 10);
  assert.equal(result.totalPrice, 8);
});

test('computeBookingPricing applies frequent rider discount', () => {
  const result = computeBookingPricing({
    userType: 'standard',
    weeklyHours: 8,
    baseTotalPrice: 20,
  });
  assert.equal(result.discountApplied, true);
  assert.equal(result.discountReason, 'frequent');
  assert.equal(result.totalPrice, 16);
});

test('simulatePayment: rejects unsupported cards with 400', () => {
  const result = simulatePayment({ cardNumber: '5555555555554444' });

  assert.equal(result.ok, false);
  assert.equal(result.statusCode, 400);
  assert.equal(
    result.message,
    'Unsupported simulator card. Use 4242424242424242 or 4000000000000002.'
  );
});
