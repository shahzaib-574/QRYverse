export function lastItem<T>(items: Iterable<T>): T | undefined {
  const values = Array.from(items);
  return values.length ? values[values.length - 1] : undefined;
}
