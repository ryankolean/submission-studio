import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // GitHub Pages serves a project site from /<repo>/, so assets need that base.
  base: process.env["VITE_BASE"] ?? "/",
});
