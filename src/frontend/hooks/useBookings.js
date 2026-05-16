import { useCallback, useEffect, useState } from 'react';
import { getSessionToken } from '../session';
import { requestJson } from '../utils/api';

import { apiUrl } from '../utils/apiBase';

const BOOKINGS_ENDPOINT = apiUrl('/api/bookings/me');

function buildContractError(message) {
  return new Error(message);
}

export function useBookings(session, refreshKey = 0) {
  const [bookings, setBookings] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const token = getSessionToken(session);

  const fetchBookings = useCallback(
    async (signal) => {
      if (!token) {
        setBookings([]);
        setIsLoading(false);
        setError(null);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const payload = await requestJson(BOOKINGS_ENDPOINT, {
          signal,
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (
          !payload ||
          payload.success !== true ||
          !Array.isArray(payload.data)
        ) {
          throw buildContractError(
            'Invalid API response contract for bookings'
          );
        }

        setBookings(payload.data);
      } catch (fetchError) {
        if (fetchError?.name === 'AbortError') {
          return;
        }

        console.error('Failed to fetch bookings:', fetchError);
        setError(fetchError?.message || 'Failed to fetch bookings');
        setBookings([]);
      } finally {
        setIsLoading(false);
      }
    },
    [token]
  );

  useEffect(() => {
    if (!token) {
      setBookings([]);
      setIsLoading(false);
      setError(null);
      return;
    }

    const controller = new AbortController();
    fetchBookings(controller.signal);

    return () => {
      controller.abort();
    };
  }, [fetchBookings, refreshKey, token]);

  return {
    bookings,
    isLoading,
    error,
    refetchBookings: () => fetchBookings(),
  };
}
