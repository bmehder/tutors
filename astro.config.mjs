import { defineConfig, envField } from 'astro/config';
import vercel from '@astrojs/vercel';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath } from 'node:url';

const commit = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7)
const builtAt = new Date().toISOString().slice(0, 16).replace('T', ' ')
const buildLabel = `Build ${commit ? commit + ' · ' : ''}${builtAt} UTC`

export default defineConfig({
  output: 'static',
  adapter: vercel(),
  env: {
    schema: {
      BOOKING_DATABASE_URL: envField.string({ context: 'server', access: 'secret', optional: true }),
    },
  },
  vite: {
    define: { 'import.meta.env.PUBLIC_BUILD_LABEL': JSON.stringify(buildLabel) },
    plugins: [tailwindcss()],
    resolve: {
      alias: { '@booking': fileURLToPath(new URL('./src/lib', import.meta.url)) },
    },
  },
});
