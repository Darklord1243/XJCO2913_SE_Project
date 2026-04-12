const registerForm = document.querySelector('#register-form');
const loginForm = document.querySelector('#login-form');
const registerMessage = document.querySelector('#register-message');
const loginMessage = document.querySelector('#login-message');
const sessionView = document.querySelector('#session-view');
const logoutButton = document.querySelector('#logout-button');
const pricingSummary = document.querySelector('#pricing-summary');
const pricingMessage = document.querySelector('#pricing-message');
const scooterList = document.querySelector('#scooter-list');
const hireOptions = document.querySelector('#hire-options');
const availabilityOverview = document.querySelector('#availability-overview');
const scooterDetailView = document.querySelector('#scooter-detail-view');
const configurationMessage = document.querySelector('#configuration-message');
const scooterForm = document.querySelector('#scooter-form');
const formModeLabel = document.querySelector('#form-mode-label');
const formActionLabel = document.querySelector('#form-action-label');
const createScooterButton = document.querySelector('#create-scooter-button');
const resetScooterFormButton = document.querySelector(
  '#reset-scooter-form-button'
);

const scooterFormFields = {
  scooterId: document.querySelector('#scooter-id'),
  displayName: document.querySelector('#scooter-display-name'),
  model: document.querySelector('#scooter-model'),
  status: document.querySelector('#scooter-status'),
  batteryLevel: document.querySelector('#scooter-battery-level'),
  rangeKm: document.querySelector('#scooter-range-km'),
  maxSpeedKph: document.querySelector('#scooter-max-speed-kph'),
  lastServiceDate: document.querySelector('#scooter-last-service-date'),
  locationDescription: document.querySelector('#scooter-location-description'),
  latitude: document.querySelector('#scooter-latitude'),
  longitude: document.querySelector('#scooter-longitude'),
  availabilityNote: document.querySelector('#scooter-availability-note'),
  pricingOneHour: document.querySelector('#pricing-one-hour'),
  pricingFourHours: document.querySelector('#pricing-four-hours'),
  pricingOneDay: document.querySelector('#pricing-one-day'),
  pricingOneWeek: document.querySelector('#pricing-one-week'),
};

const storageKey = 'escooter.session';
const hirePlanConfig = [
  {
    key: 'oneHour',
    title: '1 hour',
    description: 'Quick journeys and pay-as-you-go trips.',
    durationHours: 1,
  },
  {
    key: 'fourHours',
    title: '4 hours',
    description: 'A flexible window for errands and city stops.',
    durationHours: 4,
  },
  {
    key: 'oneDay',
    title: '1 day',
    description: 'Full-day access for commuting or sightseeing.',
    durationHours: 24,
  },
  {
    key: 'oneWeek',
    title: '1 week',
    description: 'The lowest long-hire rate for repeat journeys.',
    durationHours: 168,
  },
];
const scooterStatusConfig = [
  {
    key: 'available',
    label: 'Available',
  },
  {
    key: 'in_use',
    label: 'In Use',
  },
  {
    key: 'reserved',
    label: 'Reserved',
  },
  {
    key: 'maintenance',
    label: 'Maintenance',
  },
];

let scooters = [];
let selectedScooterId = null;
let scooterFormMode = 'edit';

function saveSession(session) {
  localStorage.setItem(storageKey, JSON.stringify(session));
}

function loadSession() {
  const rawValue = localStorage.getItem(storageKey);

  if (!rawValue) {
    return null;
  }

  try {
    return JSON.parse(rawValue);
  } catch (_error) {
    localStorage.removeItem(storageKey);
    return null;
  }
}

function clearMessages() {
  clearMessage(registerMessage);
  clearMessage(loginMessage);
}

function clearMessage(element) {
  element.textContent = '';
  delete element.dataset.state;
}

function setMessage(element, message, isError = false) {
  if (!message) {
    clearMessage(element);
    return;
  }

  element.textContent = message;
  element.dataset.state = isError ? 'error' : 'success';
}

function renderSession() {
  const session = loadSession();
  const fields = sessionView.querySelectorAll('dd');

  if (!session) {
    fields[0].textContent = 'Signed out';
    fields[1].textContent = 'None';
    fields[2].textContent = 'Not issued';
    return;
  }

  fields[0].textContent = 'Signed in';
  fields[1].textContent = `${session.user.fullName} (${session.user.email})`;
  fields[2].textContent = session.token;
}

async function requestJson(url, options = {}) {
  const response = await fetch(url, options);
  let result = null;

  try {
    result = await response.json();
  } catch (_error) {
    result = null;
  }

  if (!response.ok) {
    throw new Error(result?.message || 'Request failed.');
  }

  return result;
}

function formatCurrency(value) {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    minimumFractionDigits: 2,
  }).format(value);
}

function formatCoordinate(value) {
  return Number(value).toFixed(4);
}

function toStatusLabel(status) {
  return status
    .split(/[_-]/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function getDefaultScooter() {
  return (
    scooters.find((scooter) => scooter.status === 'available') || scooters[0]
  );
}

function getSelectedScooter() {
  return (
    scooters.find((scooter) => scooter.scooterId === selectedScooterId) || null
  );
}

function createSummaryCard(label, value, tone = '') {
  const card = document.createElement('div');
  card.className = 'summary-card';

  if (tone) {
    card.classList.add(`summary-card--${tone}`);
  }

  const title = document.createElement('p');
  title.className = 'summary-label';
  title.textContent = label;

  const content = document.createElement('p');
  content.className = 'summary-value';
  content.textContent = value;

  card.append(title, content);
  return card;
}

function createDetailCard(label, value) {
  const card = document.createElement('div');
  card.className = 'detail-card';

  const title = document.createElement('p');
  title.className = 'summary-label';
  title.textContent = label;

  const content = document.createElement('p');
  content.className = 'detail-value';
  content.textContent = value;

  card.append(title, content);
  return card;
}

function createEmptyState(message) {
  const empty = document.createElement('p');
  empty.className = 'empty-state';
  empty.textContent = message;
  return empty;
}

function renderPricingSummary() {
  const selectedScooter = getSelectedScooter();

  if (!selectedScooter) {
    pricingSummary.replaceChildren(
      createSummaryCard('Status', 'No pricing data available')
    );
    return;
  }

  const availableCount = scooters.filter(
    (scooter) => scooter.status === 'available'
  ).length;

  pricingSummary.replaceChildren(
    createSummaryCard('Selected scooter', selectedScooter.details.displayName),
    createSummaryCard('Fleet ID', selectedScooter.scooterId),
    createSummaryCard('Location', selectedScooter.location.description),
    createSummaryCard('Availability', toStatusLabel(selectedScooter.status)),
    createSummaryCard(
      'Fleet ready now',
      `${availableCount} of ${scooters.length} scooters available`
    ),
    createSummaryCard(
      'Battery',
      `${selectedScooter.details.batteryLevel}% charged`
    )
  );
}

function handleScooterSelection(scooterId) {
  selectedScooterId = scooterId;
  renderFleetView();

  const scooter = getSelectedScooter();

  if (scooter) {
    setScooterFormMode('edit', scooter);
  }
}

function createScooterOption(scooter) {
  const option = document.createElement('button');
  option.type = 'button';
  option.className = 'scooter-option';
  option.setAttribute(
    'aria-pressed',
    String(scooter.scooterId === selectedScooterId)
  );

  if (scooter.scooterId === selectedScooterId) {
    option.classList.add('is-selected');
  }

  option.addEventListener('click', () => {
    handleScooterSelection(scooter.scooterId);
  });

  const topRow = document.createElement('div');
  topRow.className = 'scooter-option__top';

  const scooterId = document.createElement('strong');
  scooterId.textContent = scooter.scooterId;

  const status = document.createElement('span');
  status.className = `status-pill status-pill--${scooter.status}`;
  status.textContent = toStatusLabel(scooter.status);

  topRow.append(scooterId, status);

  const displayName = document.createElement('p');
  displayName.className = 'scooter-option__name';
  displayName.textContent = scooter.details.displayName;

  const location = document.createElement('p');
  location.className = 'scooter-option__location';
  location.textContent = scooter.location.description;

  const rateHint = document.createElement('p');
  rateHint.className = 'scooter-option__rate';
  rateHint.textContent = `Starts at ${formatCurrency(
    scooter.pricing.oneHour
  )} per hour`;

  option.append(topRow, displayName, location, rateHint);
  return option;
}

function renderScooterList() {
  if (!scooters.length) {
    scooterList.replaceChildren(
      createEmptyState('No scooters are configured for hire pricing yet.')
    );
    return;
  }

  const options = scooters.map(createScooterOption);
  scooterList.replaceChildren(...options);
}

function createHireCard(plan, price) {
  const card = document.createElement('article');
  card.className = 'hire-card';

  const title = document.createElement('h3');
  title.textContent = plan.title;

  const priceValue = document.createElement('p');
  priceValue.className = 'hire-price';
  priceValue.textContent = formatCurrency(price);

  const meta = document.createElement('p');
  meta.className = 'hire-meta';
  meta.textContent =
    plan.durationHours === 1
      ? 'Flexible pay-as-you-go rate'
      : `${formatCurrency(price / plan.durationHours)} average per hour`;

  const note = document.createElement('p');
  note.className = 'hire-note';
  note.textContent = plan.description;

  card.append(title, priceValue, meta, note);
  return card;
}

function renderHireOptions() {
  const selectedScooter = getSelectedScooter();

  if (!selectedScooter) {
    hireOptions.replaceChildren(
      createEmptyState('Select a scooter to view its hire plans.')
    );
    return;
  }

  const cards = hirePlanConfig.map((plan) =>
    createHireCard(plan, selectedScooter.pricing[plan.key])
  );

  hireOptions.replaceChildren(...cards);
}

function renderAvailabilityOverview() {
  const counts = scooterStatusConfig.map((statusConfig) => ({
    ...statusConfig,
    count: scooters.filter((scooter) => scooter.status === statusConfig.key)
      .length,
  }));

  if (!scooters.length) {
    availabilityOverview.replaceChildren(
      createSummaryCard('Fleet status', 'No scooters configured')
    );
    return;
  }

  const cards = counts.map((statusConfig) =>
    createSummaryCard(
      statusConfig.label,
      `${statusConfig.count} scooter${statusConfig.count === 1 ? '' : 's'}`,
      statusConfig.key
    )
  );

  availabilityOverview.replaceChildren(...cards);
}

function renderScooterDetails() {
  const selectedScooter = getSelectedScooter();

  if (!selectedScooter) {
    scooterDetailView.replaceChildren(
      createEmptyState('Select a scooter to inspect its operational details.')
    );
    return;
  }

  const details = selectedScooter.details;

  scooterDetailView.replaceChildren(
    createDetailCard('Display name', details.displayName),
    createDetailCard('Model', details.model),
    createDetailCard('Availability', toStatusLabel(selectedScooter.status)),
    createDetailCard('Battery level', `${details.batteryLevel}%`),
    createDetailCard('Range', `${details.rangeKm} km`),
    createDetailCard('Top speed', `${details.maxSpeedKph} km/h`),
    createDetailCard('Last service', details.lastServiceDate),
    createDetailCard(
      'Coordinates',
      `${formatCoordinate(selectedScooter.location.latitude)}, ${formatCoordinate(
        selectedScooter.location.longitude
      )}`
    ),
    createDetailCard('Location', selectedScooter.location.description),
    createDetailCard('Availability note', details.availabilityNote)
  );
}

function renderFleetView() {
  if (!scooters.length) {
    renderPricingSummary();
    renderScooterList();
    renderHireOptions();
    renderAvailabilityOverview();
    renderScooterDetails();
    return;
  }

  if (!getSelectedScooter()) {
    selectedScooterId = getDefaultScooter().scooterId;
  }

  renderPricingSummary();
  renderScooterList();
  renderHireOptions();
  renderAvailabilityOverview();
  renderScooterDetails();
}

function createEmptyScooterTemplate() {
  return {
    scooterId: '',
    status: 'available',
    location: {
      latitude: 53.8008,
      longitude: -1.5491,
      description: '',
    },
    pricing: {
      oneHour: 5,
      fourHours: 15,
      oneDay: 30,
      oneWeek: 120,
    },
    details: {
      displayName: '',
      model: '',
      batteryLevel: 100,
      rangeKm: 40,
      maxSpeedKph: 25,
      lastServiceDate: new Date().toISOString().slice(0, 10),
      availabilityNote: 'Ready to be assigned to riders.',
    },
  };
}

function populateScooterForm(scooter) {
  scooterFormFields.scooterId.value = scooter.scooterId;
  scooterFormFields.displayName.value = scooter.details.displayName;
  scooterFormFields.model.value = scooter.details.model;
  scooterFormFields.status.value = scooter.status;
  scooterFormFields.batteryLevel.value = scooter.details.batteryLevel;
  scooterFormFields.rangeKm.value = scooter.details.rangeKm;
  scooterFormFields.maxSpeedKph.value = scooter.details.maxSpeedKph;
  scooterFormFields.lastServiceDate.value = scooter.details.lastServiceDate;
  scooterFormFields.locationDescription.value = scooter.location.description;
  scooterFormFields.latitude.value = scooter.location.latitude;
  scooterFormFields.longitude.value = scooter.location.longitude;
  scooterFormFields.availabilityNote.value = scooter.details.availabilityNote;
  scooterFormFields.pricingOneHour.value = scooter.pricing.oneHour;
  scooterFormFields.pricingFourHours.value = scooter.pricing.fourHours;
  scooterFormFields.pricingOneDay.value = scooter.pricing.oneDay;
  scooterFormFields.pricingOneWeek.value = scooter.pricing.oneWeek;
}

function setScooterFormMode(mode, scooter = null) {
  scooterFormMode = mode;
  const isCreateMode = mode === 'create';

  formModeLabel.textContent = isCreateMode ? 'New scooter' : 'Edit scooter';
  formActionLabel.textContent = isCreateMode
    ? 'Create scooter'
    : 'Update scooter';
  scooterFormFields.scooterId.readOnly = !isCreateMode;

  if (isCreateMode) {
    populateScooterForm(createEmptyScooterTemplate());
    return;
  }

  populateScooterForm(
    scooter || getSelectedScooter() || createEmptyScooterTemplate()
  );
}

function collectScooterPayload() {
  return {
    scooterId: scooterFormFields.scooterId.value,
    status: scooterFormFields.status.value,
    location: {
      latitude: scooterFormFields.latitude.value,
      longitude: scooterFormFields.longitude.value,
      description: scooterFormFields.locationDescription.value,
    },
    pricing: {
      oneHour: scooterFormFields.pricingOneHour.value,
      fourHours: scooterFormFields.pricingFourHours.value,
      oneDay: scooterFormFields.pricingOneDay.value,
      oneWeek: scooterFormFields.pricingOneWeek.value,
    },
    details: {
      displayName: scooterFormFields.displayName.value,
      model: scooterFormFields.model.value,
      batteryLevel: scooterFormFields.batteryLevel.value,
      rangeKm: scooterFormFields.rangeKm.value,
      maxSpeedKph: scooterFormFields.maxSpeedKph.value,
      lastServiceDate: scooterFormFields.lastServiceDate.value,
      availabilityNote: scooterFormFields.availabilityNote.value,
    },
  };
}

async function loadScooters(preferredScooterId = selectedScooterId) {
  pricingSummary.replaceChildren(
    createSummaryCard('Status', 'Loading pricing and fleet details...')
  );
  scooterList.replaceChildren(createEmptyState('Loading scooters...'));
  hireOptions.replaceChildren(createEmptyState('Loading hire plans...'));
  availabilityOverview.replaceChildren(
    createSummaryCard('Availability', 'Loading fleet status...')
  );
  scooterDetailView.replaceChildren(
    createEmptyState('Loading scooter details...')
  );
  clearMessage(pricingMessage);

  try {
    const result = await requestJson('/api/scooters');

    if (!result.success || !Array.isArray(result.data)) {
      throw new Error(result.message || 'Unable to load scooters.');
    }

    scooters = result.data;

    if (!scooters.length) {
      selectedScooterId = null;
      renderFleetView();
      setScooterFormMode('create');
      setMessage(
        pricingMessage,
        'No scooter pricing has been published yet.',
        true
      );
      return;
    }

    const selectedScooter =
      scooters.find((scooter) => scooter.scooterId === preferredScooterId) ||
      getDefaultScooter();

    selectedScooterId = selectedScooter.scooterId;
    renderFleetView();

    if (scooterFormMode === 'create') {
      setScooterFormMode('create');
    } else {
      setScooterFormMode('edit', selectedScooter);
    }

    setMessage(
      pricingMessage,
      `Loaded ${scooters.length} scooter profile${
        scooters.length === 1 ? '' : 's'
      } with pricing and availability.`
    );
  } catch (error) {
    scooters = [];
    selectedScooterId = null;
    renderFleetView();
    setScooterFormMode('create');
    setMessage(
      pricingMessage,
      error.message || 'Unable to load hire options right now.',
      true
    );
  }
}

registerForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  clearMessages();

  const payload = {
    fullName: document.querySelector('#register-full-name').value,
    email: document.querySelector('#register-email').value,
    password: document.querySelector('#register-password').value,
  };

  try {
    const result = await requestJson('/api/auth/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    saveSession(result.data);
    renderSession();
    registerForm.reset();
    setMessage(registerMessage, result.message);
  } catch (error) {
    setMessage(registerMessage, error.message, true);
  }
});

loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  clearMessages();

  const payload = {
    email: document.querySelector('#login-email').value,
    password: document.querySelector('#login-password').value,
  };

  try {
    const result = await requestJson('/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    saveSession(result.data);
    renderSession();
    loginForm.reset();
    setMessage(loginMessage, result.message);
  } catch (error) {
    setMessage(loginMessage, error.message, true);
  }
});

scooterForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  clearMessage(configurationMessage);

  const payload = collectScooterPayload();
  const isCreateMode = scooterFormMode === 'create';
  const url = isCreateMode
    ? '/api/scooters'
    : `/api/scooters/${encodeURIComponent(payload.scooterId)}`;

  try {
    const result = await requestJson(url, {
      method: isCreateMode ? 'POST' : 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    selectedScooterId = result.data.scooterId;
    setScooterFormMode('edit', result.data);
    await loadScooters(result.data.scooterId);
    setMessage(configurationMessage, result.message);
  } catch (error) {
    setMessage(configurationMessage, error.message, true);
  }
});

createScooterButton.addEventListener('click', () => {
  clearMessage(configurationMessage);
  setScooterFormMode('create');
});

resetScooterFormButton.addEventListener('click', () => {
  clearMessage(configurationMessage);

  if (scooterFormMode === 'create') {
    setScooterFormMode('create');
    return;
  }

  setScooterFormMode('edit', getSelectedScooter());
});

logoutButton.addEventListener('click', () => {
  localStorage.removeItem(storageKey);
  clearMessages();
  renderSession();
});

renderSession();
setScooterFormMode('edit', createEmptyScooterTemplate());
loadScooters();
