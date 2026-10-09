// ---------------------------------------------------------------------
// Orders the dashboard "office feed" cards (Announcements, On Leave,
// Birthdays, Holidays) by how much content each one has:
//
//   1. Cards WITH content come first, smallest count first
//      (e.g. 10 holidays + 11 birthdays -> Holidays, then Birthdays).
//   2. Cards still loading come next (keep their original order).
//   3. EMPTY cards always go last (keep their original order).
//
// Same rule for every role and for both mobile and desktop layouts.
//
// `counts` is { [key]: number | null } -- null/undefined means "not
// loaded yet". Items are any objects that carry a `key`.
// ---------------------------------------------------------------------
export function rankByCount(items, counts) {
  const groupOf = (c) => (c == null ? 1 : c > 0 ? 0 : 2);
  return items
    .map((item, i) => ({ item, i, c: counts?.[item.key] }))
    .sort((a, b) => {
      const ga = groupOf(a.c);
      const gb = groupOf(b.c);
      if (ga !== gb) return ga - gb;
      if (ga === 0 && a.c !== b.c) return a.c - b.c; // fewest first
      return a.i - b.i; // stable
    })
    .map(({ item }) => item);
}
