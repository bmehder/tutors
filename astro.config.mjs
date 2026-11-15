import { defineConfig, envField } from 'astro/config';
import vercel from '@astrojs/vercel';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath } from 'node:url';

const timeTravelDemo = process.env.PUBLIC_TIMETRAVEL_DEMO === '1';
const commit = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7)
const builtAt = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/New_York',
  year: 'numeric',
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  timeZoneName: 'short',
}).format(new Date());
const buildLabel = `Build ${commit ? commit + ' · ' : ''}${builtAt}`;

export default defineConfig({
  output: 'static',
  adapter: vercel(),
  env: {
    schema: {
      BOOKING_DATABASE_URL: envField.string({ context: 'server', access: 'secret', optional: true }),
    },
  },
  vite: {
    define: {
      'import.meta.env.PUBLIC_BUILD_LABEL': JSON.stringify(buildLabel),
      'import.meta.env.PUBLIC_TIMETRAVEL_DEMO': JSON.stringify(timeTravelDemo),
    },
    // The inspector uses generated Gleam constructor names as timeline labels.
    build: timeTravelDemo ? { minify: false } : undefined,
    plugins: [tailwindcss()],
    resolve: {
      alias: { '@booking': fileURLToPath(new URL('./src/lib', import.meta.url)) },
    },
  },
});
