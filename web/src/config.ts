/**
 * Product name lives here alone, because it is still being decided. Renaming
 * is a one-line change; nothing else should hardcode it.
 */
export const PRODUCT_NAME = "Publication Studio";

/** The Worker origin. Set per environment at build time; never a secret. */
export const API_BASE_URL: string =
  (import.meta.env["VITE_API_BASE_URL"] as string | undefined) ?? "http://localhost:8787";
