import { defineConfig } from 'vite';

// GitHub-Pages-Deployment liegt unter /<repo-name>/ — lokal bleibt es "/".
const base = process.env.GITHUB_PAGES === 'true'
  ? '/lerne-geografie-9klasse-realschule-bayern-terra/'
  : '/';

export default defineConfig({
  base,
  build: {
    target: 'es2021',
  },
});
