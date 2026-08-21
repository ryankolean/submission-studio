import { describe, expect, it } from "vitest";

import { EMPTY_SPEC, parsePublicationSpec } from "../src/domain/publication-spec.js";

describe("parsePublicationSpec", () => {
  it("reads a fully populated spec", () => {
    const spec = parsePublicationSpec(
      JSON.stringify({
        img_min: 25,
        img_max: 40,
        size: "web",
        watermarks_allowed: false,
        video_accepted: true,
        video_notes: "Vimeo or YouTube links",
        requirements: ["full_vendor_credits", "event_description"],
        notes: "Editorial lens on details.",
      }),
    );

    expect(spec).toEqual({
      imgMin: 25,
      imgMax: 40,
      size: "web",
      watermarksAllowed: false,
      videoAccepted: true,
      videoNotes: "Vimeo or YouTube links",
      requirements: ["full_vendor_credits", "event_description"],
      notes: "Editorial lens on details.",
    });
  });

  it("treats every field as optional", () => {
    expect(parsePublicationSpec("{}")).toEqual(EMPTY_SPEC);
  });

  it("defaults an unspecified size to unknown rather than guessing", () => {
    expect(parsePublicationSpec("{}").size).toBe("unknown");
  });

  it("leaves unknown booleans null rather than defaulting to false", () => {
    const spec = parsePublicationSpec("{}");
    expect(spec.watermarksAllowed).toBeNull();
    expect(spec.videoAccepted).toBeNull();
  });

  describe("malformed input never throws", () => {
    for (const [label, input] of [
      ["empty string", ""],
      ["not json", "{oops"],
      ["json null", "null"],
      ["json array", "[1,2,3]"],
      ["json string", '"hello"'],
      ["json number", "42"],
    ] as const) {
      it(`falls back to an empty spec for ${label}`, () => {
        expect(parsePublicationSpec(input)).toEqual(EMPTY_SPEC);
      });
    }
  });

  describe("field-level coercion", () => {
    it("ignores a non-numeric image count", () => {
      const spec = parsePublicationSpec('{"img_min":"lots","img_max":null}');
      expect(spec.imgMin).toBeNull();
      expect(spec.imgMax).toBeNull();
    });

    it("ignores a negative or fractional image count", () => {
      expect(parsePublicationSpec('{"img_min":-5}').imgMin).toBeNull();
      expect(parsePublicationSpec('{"img_max":3.5}').imgMax).toBeNull();
    });

    it("ignores an unrecognised size", () => {
      expect(parsePublicationSpec('{"size":"billboard"}').size).toBe("unknown");
    });

    it("keeps only string entries in requirements", () => {
      const spec = parsePublicationSpec('{"requirements":["a",5,null,"b",{}]}');
      expect(spec.requirements).toEqual(["a", "b"]);
    });

    it("ignores requirements that are not an array", () => {
      expect(parsePublicationSpec('{"requirements":"a,b"}').requirements).toEqual([]);
    });

    it("ignores an empty notes string", () => {
      expect(parsePublicationSpec('{"notes":"   "}').notes).toBeNull();
    });
  });

  describe("image count sanity", () => {
    it("keeps a min above a max as given, so the data problem stays visible", () => {
      const spec = parsePublicationSpec('{"img_min":40,"img_max":10}');
      expect(spec.imgMin).toBe(40);
      expect(spec.imgMax).toBe(10);
    });
  });
});
