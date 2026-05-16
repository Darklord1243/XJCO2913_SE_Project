export async function requestJson(url, options = {}) {
  const { signal, ...fetchOptions } = options;
  const response = await fetch(url, { ...fetchOptions, signal });
  let payload = null;

  try {
    payload = await response.json();
  } catch (error) {
    console.error(`Failed to parse JSON response from ${url}:`, error);
    payload = null;
  }

  if (!response.ok) {
    throw new Error(
      payload?.error ||
        payload?.message ||
        `Request failed with status ${response.status}.`
    );
  }

  return payload;
}
