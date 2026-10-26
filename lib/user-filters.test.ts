import { describe, expect, it } from "vitest";

import { containsPattern, parseUserFilters } from "./user-filters";

describe("parseUserFilters", () => {
  it("reads name and email, trimmed", () => {
    expect(parseUserFilters({ name: "  Ada ", email: " ada@x.com" })).toEqual({
      name: "Ada",
      email: "ada@x.com",
    });
  });

  it("treats missing filters as empty", () => {
    expect(parseUserFilters({})).toEqual({ name: "", email: "" });
  });

  it("takes the first of a repeated param", () => {
    expect(parseUserFilters({ name: ["Ada", "Grace"] }).name).toBe("Ada");
  });

  it("caps an overlong filter", () => {
    expect(parseUserFilters({ name: "a".repeat(500) }).name).toHaveLength(200);
  });
});

describe("containsPattern", () => {
  it("wraps the value in wildcards", () => {
    expect(containsPattern("ada")).toBe("%ada%");
  });

  it("escapes LIKE wildcards so they match literally", () => {
    expect(containsPattern("50%_off\\")).toBe("%50\\%\\_off\\\\%");
  });
});
