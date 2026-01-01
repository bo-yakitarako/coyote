import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/main.ts',
  },
  format: ['cjs'],
  outDir: 'dist',
  external: ['discord.js', 'dotenv'],
  minify: true,
  clean: false,
  sourcemap: false,
  target: 'es2020',
});
