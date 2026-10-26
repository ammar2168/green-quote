/**
 * The admin users list filters by name and email through the query string
 * (`/admin/users?name=ada&email=example.com`), so a filtered list is a link
 * that can be bookmarked or shared, and the form works without JavaScript.
 */

export type UserFilters = {
  name: string;
  email: string;
};

/** Longer than any real name or email; anything past it is not a search. */
const MAX_FILTER_LENGTH = 200;

type SearchParams = Record<string, string | string[] | undefined>;

function readParam(searchParams: SearchParams, key: string): string {
  const value = searchParams[key];
  // `?name=a&name=b` arrives as an array; the first one wins.
  const first = Array.isArray(value) ? value[0] : value;

  return (first ?? "").trim().slice(0, MAX_FILTER_LENGTH);
}

export function parseUserFilters(searchParams: SearchParams): UserFilters {
  return {
    name: readParam(searchParams, "name"),
    email: readParam(searchParams, "email"),
  };
}

/**
 * A `contains` pattern for ILIKE. `%` and `_` in what the admin typed are
 * escaped, so searching for `a_b` matches that text rather than `a` + any
 * character + `b`. Backslash is Postgres's default LIKE escape character.
 */
export function containsPattern(value: string): string {
  return `%${value.replace(/[\\%_]/g, "\\$&")}%`;
}
