export function getIn(obj: Record<string, unknown>, path: string): unknown {
  if (!path) return obj;

  const segments = path.split('.');
  let current: unknown = obj;

  for (const segment of segments) {
    if (current === null || current === undefined || typeof current !== 'object') {
      return undefined;
    }
    current = (current as Record<string, unknown>)[segment];
  }

  return current;
}

export function setIn(
  obj: Record<string, unknown>,
  path: string,
  value: unknown
): Record<string, unknown> {
  const clone = deepClone(obj);

  if (!path) {
    // Root-level: if value is a record, replace entirely
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      return value as Record<string, unknown>;
    }
    return clone;
  }

  const segments = path.split('.');
  let current: Record<string, unknown> = clone;

  for (let i = 0; i < segments.length - 1; i++) {
    const segment = segments[i];
    const next = current[segment];

    if (next === null || next === undefined || typeof next !== 'object' || Array.isArray(next)) {
      current[segment] = {};
    } else {
      current[segment] = { ...(next as Record<string, unknown>) };
    }

    current = current[segment] as Record<string, unknown>;
  }

  current[segments[segments.length - 1]] = value;
  return clone;
}

export function unsetIn(
  obj: Record<string, unknown>,
  path: string
): Record<string, unknown> {
  const clone = deepClone(obj);

  if (!path) return clone;

  const segments = path.split('.');
  let current: Record<string, unknown> = clone;

  for (let i = 0; i < segments.length - 1; i++) {
    const segment = segments[i];
    const next = current[segment];

    if (next === null || next === undefined || typeof next !== 'object' || Array.isArray(next)) {
      return clone;
    }

    current[segment] = { ...(next as Record<string, unknown>) };
    current = current[segment] as Record<string, unknown>;
  }

  delete current[segments[segments.length - 1]];
  return clone;
}

function deepClone(obj: Record<string, unknown>): Record<string, unknown> {
  return JSON.parse(JSON.stringify(obj));
}
