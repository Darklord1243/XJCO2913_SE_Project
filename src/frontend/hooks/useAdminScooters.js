import { useCallback, useEffect, useState } from 'react';
import { requestJson } from '../utils/api';

const ADMIN_SCOOTERS_ENDPOINT = 'http://127.0.0.1:3000/api/admin/scooters';

function buildContractError(message) {
  return new Error(message);
}

/**
 * Fleet list for administrators: includes soft-retired scooters so operators
 * can audit and re-activate them. Requires a session bearer token (admin role).
 */
export function useAdminScooters(sessionToken) {
  const [scooters, setScooters] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchScooters = useCallback(
    async (signal) => {
      if (!sessionToken) {
        setScooters([]);
        setIsLoading(false);
        setError(null);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const payload = await requestJson(ADMIN_SCOOTERS_ENDPOINT, {
          signal,
          headers: {
            Authorization: `Bearer ${sessionToken}`,
          },
        });

        if (
          !payload ||
          payload.success !== true ||
          !Array.isArray(payload.data)
        ) {
          throw buildContractError(
            'Invalid API response contract for admin scooters'
          );
        }

        setScooters(payload.data);
      } catch (fetchError) {
        if (fetchError?.name === 'AbortError') {
          return;
        }

        console.error('Failed to fetch admin scooters:', fetchError);
        setError(fetchError?.message || 'Failed to fetch scooters');
        setScooters([]);
      } finally {
        setIsLoading(false);
      }
    },
    [sessionToken]
  );

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
