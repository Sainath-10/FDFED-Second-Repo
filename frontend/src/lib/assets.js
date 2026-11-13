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

const GAME_BANNERS = [
  [['valorant'], '8764f3a5ce7a0eb0275743600c60fb0c727893c8.png'],
  [['counter-strike', 'cs2', 'csgo'], 'c4f97eccde97e10ac89b61ec5fb36fdce0ab2477.png'],
  [['league of legends'], '95bc0921c86340a2cee9e0a2d7ecd20b15a26143.png'],
  [['apex'], 'f03e2b11537e425d8544ee3ca732bf73af5137c0.png'],
];
const DEFAULT_BANNER = 'b890c61489a080992ad7e99adabb1145e6d59606.png';

/** The game's stock banner, used when an organizer did not upload one. */
export function gameBanner(game) {
  const g = String(game || '').toLowerCase();
  const match = GAME_BANNERS.find(([keys]) => keys.some((k) => g.includes(k)));
  return assetUrl(match ? match[1] : DEFAULT_BANNER);
}

/** A competition's banner: an uploaded image (data or http URL) or the game's stock banner. */
export function competitionBanner(comp) {
  const img = comp && comp.img;
  if (img && (/^data:image\//.test(img) || /^https?:\/\//.test(img))) return img;
  if (img) {
    const resolved = assetUrl(img);
    if (resolved !== img || img.startsWith('/')) return resolved;
  }
  return gameBanner(comp && comp.game);
}

export default ASSETS;


