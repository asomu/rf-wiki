import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import react from '@astrojs/react';
import { unified } from '@astrojs/markdown-remark';
import rehypeKatex from 'rehype-katex';
import remarkMath from 'remark-math';

export default defineConfig({
  output: 'static',
  devToolbar: { enabled: false },
  integrations: [react(), mdx()],
  markdown: {
    processor: unified({
      remarkPlugins: [remarkMath],
      rehypePlugins: [rehypeKatex],
      shikiConfig: {
        theme: 'github-light'
      }
    })
  },
  vite: {
    build: {
      cssCodeSplit: true
    }
  }
});
