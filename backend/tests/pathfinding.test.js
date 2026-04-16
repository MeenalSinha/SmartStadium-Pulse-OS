'use strict';

const { dijkstra } = require('../src/services/pathfinding');

const DENSE = { A:0.9, B:0.9, C:0.9, D:0.9, E:0.9, F:0.9, G:0.9, H:0.9 };
const EMPTY = { A:0.0, B:0.0, C:0.0, D:0.0, E:0.0, F:0.0, G:0.0, H:0.0 };

const CONNECTIONS = {
  A:['B','E'], B:['A','C','F'], C:['B','D','G'], D:['A','C','H'],
  E:['A','F','H'], F:['B','E','G'], G:['C','F','H'], H:['D','E','G'],
};

describe('dijkstra()', () => {
  test('start === end returns single-node path, zero cost', () => {
    const r = dijkstra('A', 'A', EMPTY);
    expect(r.path).toEqual(['A']);
    expect(r.cost).toBe(0);
    expect(r.estimatedMinutes).toBe(0);
  });

  test('direct neighbours are reachable', () => {
    const r = dijkstra('A', 'B', EMPTY);
    expect(r.path[0]).toBe('A');
    expect(r.path[r.path.length - 1]).toBe('B');
    expect(r.cost).not.toBe(Infinity);
  });

  test('full graph traversal A → G succeeds', () => {
    const r = dijkstra('A', 'G', EMPTY);
    expect(r.path[0]).toBe('A');
    expect(r.path[r.path.length - 1]).toBe('G');
    expect(r.estimatedMinutes).toBeGreaterThan(0);
  });

  test('dense zones increase path cost', () => {
    const cheap  = dijkstra('A', 'G', EMPTY);
    const costly = dijkstra('A', 'G', DENSE);
    expect(costly.cost).toBeGreaterThan(cheap.cost);
  });

  test('estimatedMinutes >= 1 for any non-trivial path', () => {
    const r = dijkstra('A', 'H', EMPTY);
    expect(r.estimatedMinutes).toBeGreaterThanOrEqual(1);
  });

  test('all 8 zones reachable from A', () => {
    ['B','C','D','E','F','G','H'].forEach(to => {
      const r = dijkstra('A', to, EMPTY);
      expect(r.path.length).toBeGreaterThan(0);
      expect(r.cost).not.toBe(Infinity);
    });
  });

  test('path contains only valid zone IDs', () => {
    const VALID = new Set(['A','B','C','D','E','F','G','H']);
    dijkstra('B', 'H', EMPTY).path.forEach(id => expect(VALID.has(id)).toBe(true));
  });

  test('consecutive path nodes are connected in the graph', () => {
    const r = dijkstra('A', 'G', EMPTY);
    for (let i = 0; i < r.path.length - 1; i++) {
      expect(CONNECTIONS[r.path[i]]).toContain(r.path[i + 1]);
    }
  });
});
