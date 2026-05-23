// Cache LRU en mémoire pour les pages scrapées et les résultats de recherche.
// Évite de re-scraper la même URL si elle revient dans une autre requête Deep.
// TTL 1h, max 200 entrées (eviction LRU).

const MAX_ENTRIES = 200;
const TTL_MS = 60 * 60 * 1000; // 1h

class LRUCache {
  constructor(max = MAX_ENTRIES, ttl = TTL_MS) {
    this.max = max;
    this.ttl = ttl;
    this.map = new Map();
  }
  get(key) {
    const entry = this.map.get(key);
    if (!entry) return null;
    if (Date.now() - entry.t > this.ttl) {
      this.map.delete(key);
      return null;
    }
    // Refresh LRU position
    this.map.delete(key);
    this.map.set(key, entry);
    return entry.v;
  }
  set(key, value) {
    if (this.map.has(key)) this.map.delete(key);
    this.map.set(key, { v: value, t: Date.now() });
    if (this.map.size > this.max) {
      const firstKey = this.map.keys().next().value;
      this.map.delete(firstKey);
    }
  }
  stats() {
    return { size: this.map.size, max: this.max };
  }
}

export const pageCache = new LRUCache(200, 60 * 60 * 1000);    // 1h
export const searchCache = new LRUCache(500, 30 * 60 * 1000);  // 30min
