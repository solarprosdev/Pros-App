/** Split a single full-name string into first / middle / last for display and editing. */
export function parseFullName(full: string): {
  firstName: string;
  middleName: string;
  lastName: string;
} {
  const t = full.trim();
  if (!t) return { firstName: "", middleName: "", lastName: "" };
  const parts = t.split(/\s+/);
  if (parts.length === 1) return { firstName: parts[0], middleName: "", lastName: "" };
  if (parts.length === 2) return { firstName: parts[0], middleName: "", lastName: parts[1] };
  return {
    firstName: parts[0],
    middleName: parts.slice(1, -1).join(" "),
    lastName: parts[parts.length - 1],
  };
}

export function joinFullName(first: string, middle: string, last: string): string {
  return [first, middle, last].map((s) => s.trim()).filter(Boolean).join(" ");
}
