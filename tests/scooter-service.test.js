const test = require('node:test');
const assert = require('node:assert/strict');

const {
  SCOOTER_STATUSES,
  normalizeId,
  validateScooterPayload,
} = require('../src/backend/scooter-service');

function buildValidPayload(overrides = {}) {
  const {
    location: locationOverride,
    pricing: pricingOverride,
    ...rest
  } = overrides;

  return {
    scooterId: 'ESC-010',
    status: 'available',
    location: {
      latitude: 53.8008,
      longitude: -1.5491,
      description: 'City Centre Square',
      ...(locationOverride || {}),
    },
    pricing: {
      oneHour: 5,
      fourHours: 15,
      oneDay: 30,
      oneWeek: 120,
      ...(pricingOverride || {}),
    },
    ...rest,
  };
}

test('scooter-service: SCOOTER_STATUSES is the documented closed set', () => {
  assert.deepEqual(
    [...SCOOTER_STATUSES],
    ['available', 'in_use', 'maintenance', 'offline', 'retired']
  );
});

test('scooter-service: normalizeId trims and uppercases', () => {
  assert.equal(normalizeId('  esc-001  '), 'ESC-001');
  assert.equal(normalizeId('esc010'), 'ESC010');
  assert.equal(normalizeId(undefined), '');
  assert.equal(normalizeId(null), '');
});

test('validateScooterPayload: accepts retired status', () => {
  const result = validateScooterPayload(
    buildValidPayload({ status: 'retired' })
  );

  assert.equal(result.ok, true);
  assert.equal(result.value.status, 'retired');
});

test('validateScooterPayload: accepts a fully-valid payload', () => {
  const result = validateScooterPayload(buildValidPayload());

  assert.equal(result.ok, true);
  assert.equal(result.value.scooterId, 'ESC-010');
  assert.equal(result.value.status, 'available');
  assert.equal(result.value.location.latitude, 53.8008);
  assert.equal(result.value.location.longitude, -1.5491);
  assert.equal(result.value.location.description, 'City Centre Square');
  assert.equal(result.value.pricing.oneWeek, 120);
});

test('validateScooterPayload: lowercases status and uppercases scooter id', () => {
  const result = validateScooterPayload(
    buildValidPayload({
      scooterId: 'esc-011',
      status: 'AVAILABLE',
    })
  );

  assert.equal(result.ok, true);
  assert.equal(result.value.scooterId, 'ESC-011');
  assert.equal(result.value.status, 'available');
});

test('validateScooterPayload: accepts numeric strings for lat/lng/pricing', () => {
  const result = validateScooterPayload(
    buildValidPayload({
      location: {
        latitude: '53.8008',
        longitude: '-1.5491',
        description: 'City Centre Square',
      },
      pricing: {
        oneHour: '5',
        fourHours: '15',
        oneDay: '30',
        oneWeek: '120',
      },
    })
  );

  assert.equal(result.ok, true);
  assert.equal(result.value.location.latitude, 53.8008);
  assert.equal(result.value.pricing.oneHour, 5);
});

test('validateScooterPayload: rejects non-object payloads', () => {
  assert.equal(validateScooterPayload(null).ok, false);
  assert.equal(validateScooterPayload(undefined).ok, false);
  assert.equal(validateScooterPayload('string').ok, false);
  assert.equal(validateScooterPayload([]).ok, false);
});

test('validateScooterPayload: rejects bad scooter id format', () => {
  for (const badId of ['esc', 'esc!', 'a', 'X'.repeat(21), '']) {
    const result = validateScooterPayload(
      buildValidPayload({ scooterId: badId })
    );
    assert.equal(
      result.ok,
      false,
      `expected ${JSON.stringify(badId)} to be rejected`
    );
    assert.match(result.message, /Scooter ID/);
  }
});

test('validateScooterPayload: rejects unknown status', () => {
  const result = validateScooterPayload(
    buildValidPayload({ status: 'broken' })
  );
  assert.equal(result.ok, false);
  assert.match(result.message, /status must be one of/);
});

test('validateScooterPayload: rejects missing or non-object location', () => {
  for (const badLocation of [null, undefined, 'somewhere', []]) {
    const result = validateScooterPayload({
      ...buildValidPayload(),
      location: badLocation,
    });
    assert.equal(result.ok, false);
    assert.match(result.message, /Location details/i);
  }
});

test('validateScooterPayload: rejects out-of-range latitude/longitude', () => {
  const tooNorth = validateScooterPayload(
    buildValidPayload({
      location: {
        latitude: 91,
        longitude: 0,
        description: 'Top of the world',
      },
    })
  );

  assert.equal(tooNorth.ok, false);
  assert.match(tooNorth.message, /Latitude/);

  const tooEast = validateScooterPayload(
    buildValidPayload({
      location: {
        latitude: 0,
        longitude: 181,
        description: 'East of east',
      },
    })
  );

  assert.equal(tooEast.ok, false);
  assert.match(tooEast.message, /Longitude/);
});

test('validateScooterPayload: rejects empty description', () => {
  const result = validateScooterPayload(
    buildValidPayload({
      location: {
        latitude: 53.8008,
        longitude: -1.5491,
        description: '   ',
      },
    })
  );

  assert.equal(result.ok, false);
  assert.match(result.message, /description/i);
});

test('validateScooterPayload: rejects missing pricing object', () => {
  const result = validateScooterPayload({
    ...buildValidPayload(),
    pricing: null,
  });

  assert.equal(result.ok, false);
  assert.match(result.message, /Pricing details/i);
});

test('validateScooterPayload: rejects negative prices', () => {
  const result = validateScooterPayload(
    buildValidPayload({
      pricing: {
        oneHour: -1,
        fourHours: 15,
        oneDay: 30,
        oneWeek: 120,
      },
    })
  );

  assert.equal(result.ok, false);
  assert.match(result.message, /One-hour price/);
});

test('validateScooterPayload: rejects non-numeric prices', () => {
  const result = validateScooterPayload(
    buildValidPayload({
      pricing: {
        oneHour: 5,
        fourHours: 'free',
        oneDay: 30,
        oneWeek: 120,
      },
    })
  );

  assert.equal(result.ok, false);
  assert.match(result.message, /Four-hour price/);
});
