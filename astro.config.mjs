import { defineConfig, envField } from 'astro/config';
import vercel from '@astrojs/vercel';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  output: 'static',
  adapter: vercel(),
  env: {
    schema: {
      BOOKING_DATABASE_URL: envField.string({ context: 'server', access: 'secret', optional: true }),
    },
  },
  vite: {
    plugins: [tailwindcss()],
    resolve: {
      alias: { '@booking': fileURLToPath(new URL('./src/lib', import.meta.url)) },
    },
  },
});
