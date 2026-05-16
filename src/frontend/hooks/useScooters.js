import { useCallback, useEffect, useState } from 'react';
import { requestJson } from '../utils/api';

import { apiUrl } from '../utils/apiBase';

const SCOOTERS_ENDPOINT = apiUrl('/api/scooters');

function buildContractError(message) {
  return new Error(message);
}

export function useScooters() {
  const [scooters, setScooters] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchScooters = useCallback(async (signal) => {
    setIsLoading(true);
    setError(null);

    try {
      const payload = await requestJson(SCOOTERS_ENDPOINT, { signal });

      if (
        !payload ||
        payload.success !== true ||
        !Array.isArray(payload.data)
      ) {
        throw buildContractError('Invalid API response contract for scooters');
      }

      setScooters(payload.data);
    } catch (fetchError) {
      if (fetchError?.name === 'AbortError') {
        return;
      }

      console.error('Failed to fetch scooters:', fetchError);
      setError(fetchError?.message || 'Failed to fetch scooters');
      setScooters([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetchScooters(controller.signal);

    return () => {
      controller.abort();
    };
  }, [fetchScooters]);

  return {
    scooters,
    isLoading,
    error,
    refetchScooters: () => fetchScooters(),
  };
}
