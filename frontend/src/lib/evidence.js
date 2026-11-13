/**
 * Turns an image the user picked into a compressed data URL the reports API
 * accepts as evidence (PNG, JPEG or WEBP, at most 5 MB after compression).
 */
export async function prepareEvidenceFile(file) {
  if (!file) throw new Error('No file selected.');
  if (!/^image\/(png|jpeg|webp)$/.test(file.type)) {
    throw new Error('Only PNG, JPEG or WEBP images are accepted.');
  }
  if (file.size > 8 * 1024 * 1024) throw new Error('Images must be 8 MB or smaller before compression.');

  const dataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Unable to read the selected file.'));
    reader.readAsDataURL(file);
  });

  const compressed = await compressImage(dataUrl);
  const size = Math.round(compressed.length * 0.75);
  if (size > 5 * 1024 * 1024) throw new Error('This image is still larger than 5 MB after compression.');
  return {
    url: compressed,
    filename: file.name,
    mimetype: compressed.slice(5, compressed.indexOf(';')) || 'image/jpeg',
    size,
  };
}

function compressImage(dataUrl, maxDimension = 1400, quality = 0.72) {
  if (typeof document === 'undefined' || typeof Image === 'undefined') return Promise.resolve(dataUrl);
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => {
      try {
        const scale = Math.min(1, maxDimension / Math.max(image.width, image.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(image.width * scale));
        canvas.height = Math.max(1, Math.round(image.height * scale));
        canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      } catch (err) {
        resolve(dataUrl);
      }
    };
    image.onerror = () => resolve(dataUrl);
    image.src = dataUrl;
  });
}
