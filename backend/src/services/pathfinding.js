"use strict";

const { ZONES } = require("../config");

/**
 * dijkstra(start, end, densityMap)
 *
 * Finds the least-cost path through the stadium zone graph.
 * Edge cost = 1 + density × 3 — penalises high-density zones.
 *
 * Returns { path: string[], cost: number, estimatedMinutes: number|null }
 *
 * Time complexity: O(V²) with a Set-based priority queue.
 * At 8 zones this is negligible. For larger graphs replace with a min-heap.
 *
 * @param {string} start       - Zone ID
 * @param {string} end         - Zone ID
 * @param {Object} densityMap  - { [zoneId]: number 0–1 }
 */
function dijkstra(start, end, densityMap) {
  if (start === end) {
    return { path: [start], cost: 0, estimatedMinutes: 0 };
  }

  const dist = {};
  const prev = {};
  const visited = new Set();
  const queue = new Set(Object.keys(ZONES));

  Object.keys(ZONES).forEach((id) => {
    dist[id] = Infinity;
  });
  dist[start] = 0;

  while (queue.size > 0) {
    // Find unvisited node with minimum distance (O(V) scan — fine at 8 nodes)
    let u = null;
    queue.forEach((id) => {
      if (u === null || dist[id] < dist[u]) u = id;
    });

    if (dist[u] === Infinity) break; // remaining nodes unreachable
    if (u === end) break;

    queue.delete(u);
    visited.add(u);

    ZONES[u].connections.forEach((v) => {
      if (visited.has(v)) return;
      const density = densityMap[v] || 0;
      const edgeCost = 1 + density * 3;
      const alt = dist[u] + edgeCost;
      if (alt < dist[v]) {
        dist[v] = alt;
        prev[v] = u;
      }
    });
  }

  if (dist[end] === Infinity) {
    return { path: [], cost: Infinity, estimatedMinutes: null };
  }

  const path = [];
  let cur = end;
  while (cur !== undefined) {
    path.unshift(cur);
    cur = prev[cur];
  }

  return {
    path,
    cost: dist[end],
    estimatedMinutes: Math.max(1, Math.round(dist[end] * 1.5)),
  };
}

module.exports = { dijkstra };
