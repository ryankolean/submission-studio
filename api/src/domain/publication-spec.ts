/**
 * Publication spec -- the shape stored in publications.spec_json.
 *
 * Specs are transcribed from outlet guidelines by hand and drift (design doc
 * section 10, the highest-likelihood risk in the register). So the parser is
 * total: any field may be absent or wrong, and nothing here throws. An unknown
 * value stays null rather than defaulting to something convenient, because
 * "we do not know whether watermarks are allowed" and "watermarks are not
 * allowed" lead to different packaging decisions.
 *
 * Phase 1's package validator reads this. Phase 0 only renders it.
 */

export type SpecSize = "web" | "print" | "unknown";

export interface PublicationSpec {
  imgMin: number | null;
  imgMax: number | null;
  size: SpecSize;
  watermarksAllowed: boolean | null;
  videoAccepted: boolean | null;
  videoNotes: string | null;
  /** Checklist seeds; Phase 1 turns these into per-package checklist items. */
  requirements: string[];
  notes: string | null;
}

export const EMPTY_SPEC: PublicationSpec = {
  imgMin: null,
  imgMax: null,
  size: "unknown",
  watermarksAllowed: null,
  videoAccepted: null,
  videoNotes: null,
  requirements: [],
  notes: null,
};

const SIZES: readonly SpecSize[] = ["web", "print", "unknown"];

function readCount(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : null;
}

function readBool(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

function readText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function readSize(value: unknown): SpecSize {
  return typeof value === "string" && (SIZES as readonly string[]).includes(value)
    ? (value as SpecSize)
    : "unknown";
}

function readRequirements(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is string => typeof entry === "string");
}

export function parsePublicationSpec(raw: string): PublicationSpec {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return EMPTY_SPEC;
  }

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return EMPTY_SPEC;
  }

  const source = parsed as Record<string, unknown>;

  return {
    imgMin: readCount(source["img_min"]),
    imgMax: readCount(source["img_max"]),
    size: readSize(source["size"]),
    watermarksAllowed: readBool(source["watermarks_allowed"]),
    videoAccepted: readBool(source["video_accepted"]),
    videoNotes: readText(source["video_notes"]),
    requirements: readRequirements(source["requirements"]),
    notes: readText(source["notes"]),
  };
}
