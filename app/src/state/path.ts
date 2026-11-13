/**
 * Get and set values by dotted path, e.g. `'style.glass.width'` or
 * `'params.gap'`. One helper serves the whole control system, so a control
 * definition is pure data.
 */

function walk(root: unknown, parts: readonly string[]): unknown {
  let cur: unknown = root;
  for (const p of parts) {
    if (cur === null || cur === undefined) return undefined;
    if (typeof cur !== 'object') return undefined;
    cur = (cur as Record<string, unknown>)[p];
  }
  return cur;
}

/** Read a dotted path. Returns `undefined` when any segment is missing. */
export function getPath<T = unknown>(root: unknown, path: string): T {
  if (!path) return root as T;
  return walk(root, path.split('.')) as T;
}

/** True when every segment of the path exists on the object. */
export function hasPath(root: unknown, path: string): boolean {
  if (!path) return true;
  const parts = path.split('.');
  let cur: unknown = root;
  for (const p of parts) {
    if (cur === null || typeof cur !== 'object') return false;
    if (!(p in (cur as object))) return false;
    cur = (cur as Record<string, unknown>)[p];
  }
  return true;
}

/**
 * Immutably write a dotted path, returning a new root object.
 * Intermediate objects are cloned so React sees fresh references only along
 * the path that actually changed.
 */
export function setPath<T>(root: T, path: string, value: unknown): T {
  if (!path) return value as T;
  const parts = path.split('.');

  const clone = (node: unknown): unknown => {
    if (Array.isArray(node)) return node.slice();
    if (node !== null && typeof node === 'object') return { ...(node as object) };
    return node;
  };

  const next = clone(root) as Record<string, unknown>;
  let cur: Record<string, unknown> = next;

  for (let i = 0; i < parts.length - 1; i++) {
    const key = parts[i];
    const child = cur[key];
    // Missing or primitive intermediates become a fresh object; only real
    // objects and arrays are cloned.
    const copied = (
      child !== null && typeof child === 'object' ? clone(child) : {}
    ) as Record<string, unknown>;
    cur[key] = copied;
    cur = copied;
  }

  cur[parts[parts.length - 1]] = value;
  return next as T;
}
