export type SetterValue<T> = T | ((current: T) => T);

export function resolveValue<T>(value: SetterValue<T>, current: T): T {
  return typeof value === 'function' ? (value as (current: T) => T)(current) : value;
}
