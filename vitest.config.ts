/// <reference types="vitest/config" />
// Unit tests (npm test). Uses Astro's Vite setup, so import.meta.env and the
// project's aliases behave as they do in the build.
import { getViteConfig } from 'astro/config';

export default getViteConfig({
  test: {
    include: ['tests/unit/**/*.test.ts'],
  },
});
