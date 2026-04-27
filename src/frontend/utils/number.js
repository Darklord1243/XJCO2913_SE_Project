export function toFiniteNumber(value, fallback = 0) {
  const numericValue = Number(value);

  if (Number.isFinite(numericValue)) {
    return numericValue;
  }

  return fallback;
}
