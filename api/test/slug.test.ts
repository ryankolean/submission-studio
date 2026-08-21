import { describe, expect, it } from "vitest";

import { slugify, weddingSlug } from "../src/domain/slug.js";

describe("slugify", () => {
  it("lowercases and hyphenates", () => {
    expect(slugify("Sarah and James")).toBe("sarah-and-james");
  });

  it("strips diacritics rather than dropping the letters", () => {
    expect(slugify("Zoë & Renée")).toBe("zoe-renee");
  });

  it("collapses runs of separators", () => {
    expect(slugify("a   --  b")).toBe("a-b");
  });

  it("trims leading and trailing separators", () => {
    expect(slugify("  -- hello --  ")).toBe("hello");
  });

  it("drops punctuation and symbols", () => {
    expect(slugify("Ben's Wedding! (2026)")).toBe("ben-s-wedding-2026");
  });

  it("returns an empty string when nothing survives", () => {
    expect(slugify("!!!")).toBe("");
    expect(slugify("")).toBe("");
  });

  it("keeps digits", () => {
    expect(slugify("Studio 54")).toBe("studio-54");
  });
});

describe("weddingSlug", () => {
  it("combines the couple and the year", () => {
    expect(weddingSlug("Sarah and James", "2026-06-14")).toBe("sarah-and-james-2026");
  });

  it("falls back to the date alone when the names slugify to nothing", () => {
    expect(weddingSlug("!!!", "2026-06-14")).toBe("wedding-2026-06-14");
  });

  it("tolerates a malformed date by using it verbatim", () => {
    expect(weddingSlug("Sarah and James", "not-a-date")).toBe("sarah-and-james-not-a-date");
  });

  it("truncates a very long couple name", () => {
    const slug = weddingSlug("a".repeat(200), "2026-06-14");
    expect(slug.length).toBeLessThanOrEqual(80);
    expect(slug.endsWith("-2026")).toBe(true);
  });
});
