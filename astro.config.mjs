// @ts-check
import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://escalire.fr',
  // trailing slash required: BASE_URL keeps it, so ${base}assets/... joins stay valid
  base: '/',
});
