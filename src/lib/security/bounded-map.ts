/**
 * Map con tope de entradas: al superarlo descarta la entrada más antigua (por orden de escritura).
 * Evita crecimiento ilimitado de memoria en el servidor de demostración (T-02).
 */
export function createBoundedMap<K, V>(maxEntries: number): Map<K, V> {
  if (!Number.isInteger(maxEntries) || maxEntries < 1) {
    throw new RangeError("maxEntries debe ser un entero positivo");
  }
  const map = new Map<K, V>();
  const originalSet = map.set.bind(map);
  map.set = (key: K, value: V) => {
    if (map.has(key)) map.delete(key);
    originalSet(key, value);
    while (map.size > maxEntries) {
      const oldest = map.keys().next();
      if (oldest.done) break;
      map.delete(oldest.value);
    }
    return map;
  };
  return map;
}
