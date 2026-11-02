/**
 * NEXUS ESPORTS — uploaded image → small avatar
 *
 * Team records live in localStorage, so an uploaded logo is center-cropped and
 * re-encoded to a small data URL. SVG is not accepted: logos stored as SVG markup
 * are rendered as raw HTML.
 */
const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
const MAX_FILE_BYTES = 5 * 1024 * 1024;
const AVATAR_SIZE = 128;

export const AVATAR_ACCEPT = ALLOWED_TYPES.join(',');

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => { URL.revokeObjectURL(url); resolve(image); };
    image.onerror = () => { URL.revokeObjectURL(url); reject(new Error('That image could not be read. Please try another file.')); };
    image.src = url;
  });
}

/** Resolves with a square data URL, or rejects with a message safe to show the user. */
export async function fileToAvatarDataUrl(file) {
  if (!file || !ALLOWED_TYPES.includes(file.type)) {
    throw new Error('Please choose a PNG, JPG, WEBP or GIF image.');
  }
  if (file.size > MAX_FILE_BYTES) {
    throw new Error('Please choose an image smaller than 5MB.');
  }

  const image = await loadImage(file);
  const side = Math.min(image.naturalWidth, image.naturalHeight);
  const canvas = document.createElement('canvas');
  canvas.width = AVATAR_SIZE;
  canvas.height = AVATAR_SIZE;
  canvas.getContext('2d').drawImage(
    image,
    (image.naturalWidth - side) / 2,
    (image.naturalHeight - side) / 2,
    side,
    side,
    0,
    0,
    AVATAR_SIZE,
    AVATAR_SIZE,
  );
  return canvas.toDataURL('image/webp', 0.85);
}
