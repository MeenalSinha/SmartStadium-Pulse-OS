import { useEffect, useState, useCallback } from "react";
import { api } from "../services/api";

/**
 * useRecommendations — shared hook for polling /api/recommendations.
 *
 * FIX: Previously both FanApp and RewardsPage polled this endpoint independently
 * at different intervals (4000ms vs 5000ms). When both pages share the same parent
 * route they'd each send requests, doubling backend load.
 *
 * This hook provides a single managed polling instance. Pass a custom interval if
 * needed, defaulting to 4000ms.
 *
 * @param {number} [intervalMs=4000]
 * @returns {{ recommendations: Array, loading: boolean, error: string|null }}
 */
export function useRecommendations(intervalMs = 4000) {
  const [recommendations, setRecommendations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetch = useCallback(() => {
    api
      .getRecommendations()
      .then((d) => {
        setRecommendations(d.recommendations || []);
        setLoading(false);
        setError(null);
      })
      .catch((err) => {
        setError(err.message || "Failed to load recommendations");
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    fetch();
    const iv = setInterval(fetch, intervalMs);
    return () => clearInterval(iv);
  }, [fetch, intervalMs]);

  return { recommendations, loading, error };
}
