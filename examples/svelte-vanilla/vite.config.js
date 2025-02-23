import { join, dirname } from 'path'
import { svelte as viteSvelte } from '@sveltejs/vite-plugin-svelte'
import viteFastify from 'fastify-vite/plugin'

// @type {import('vite').UserConfig}
export default {
  root: join(dirname(new URL(import.meta.url).pathname), 'client'),
  plugins: [
    viteSvelte(),
    viteFastify(),
  ],
}
