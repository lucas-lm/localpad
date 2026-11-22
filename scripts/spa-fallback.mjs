// GitHub Pages does not rewrite routes: /meeting is not a file and would hit the 404 page.
// Since it serves 404.html for any unknown path, a copy of index.html makes the app
// open at any URL, and the router reads the slug from location.pathname.
import { copyFileSync } from 'node:fs';

copyFileSync('dist/index.html', 'dist/404.html');
console.log('Created dist/404.html (route fallback for GitHub Pages)');
