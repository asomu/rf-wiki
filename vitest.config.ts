import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@': new URL('./src', import.meta.url).pathname,
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    include: [
      'tests/unit/**/*.test.ts',
      'tests/components/**/*.test.{ts,tsx}',
    ],
    restoreMocks: true,
    clearMocks: true,
    unstubGlobals: true,
    css: true,
  },
});
