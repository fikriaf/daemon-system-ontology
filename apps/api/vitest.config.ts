import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    environment: 'node',
  },
  resolve: {
    alias: {
      '@daemon/ontology-language': resolve(__dirname, '../../packages/ontology-language/dist/index.js'),
      '@daemon/ontology-engine': resolve(__dirname, '../../packages/ontology-engine/dist/index.js'),
      '@daemon/ontology-sdk': resolve(__dirname, '../../packages/ontology-sdk/dist/index.js'),
    },
  },
});
