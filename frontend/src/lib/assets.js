/**
 * NEXUS ESPORTS — asset URL resolver
 *
 * Vite's public dir is `public/`, so the images are not served from `/assets/*` in
 * the React app. This maps an image reference (a bare filename or a
 * `../assets/<name>` path) to the URL Vite emits. The image files live in

 */
const modules = import.meta.glob('../assets/*.{png,jpg,jpeg,svg,ico,webp,gif}', {
  eager: true,
  query: '?url',
  import: 'default',
});

const ASSETS = {};
for (const [path, url] of Object.entries(modules)) {
  ASSETS[path.split('/').pop()] = url;
}

export function assetUrl(name) {
  if (!name) return '';
  const base = String(name).split('/').pop();
  return ASSETS[base] || name;
}

export default ASSETS;


