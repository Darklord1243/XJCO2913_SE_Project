export function normalizeCardNumber(value) {
  return String(value || '').replace(/\s+/g, '');
}

export function isManualPaymentComplete(form) {
  if (!form || typeof form !== 'object') {
    return false;
  }

  const cardholderName = String(form.cardholderName || '').trim();
  const cardNumber = normalizeCardNumber(form.cardNumber);
  const expiryDate = String(form.expiryDate || '').trim();
  const cvv = String(form.cvv || '').trim();

  return (
    cardholderName.length > 0 &&
    /^\d{16}$/.test(cardNumber) &&
    /^\d{2}\/\d{2}$/.test(expiryDate) &&
    /^\d{3,4}$/.test(cvv)
  );
}

export function isSavedCardCvvValid(cvv) {
  return /^\d{3,4}$/.test(String(cvv || '').trim());
}
