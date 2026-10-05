// Photos are shrunk in the browser before saving, so a 12 MB phone photo
// becomes a sensible JPEG of at most 2000px on its longest side.

export const MAX_SIDE = 2000;

export async function resizePhoto(file: File, maxSide = MAX_SIDE): Promise<string> {
  if (!file.type.startsWith('image/'))
    throw new Error("That file isn't a photo. Please choose a JPG, PNG or HEIC image.");
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    throw new Error("This browser can't open that photo. Try saving it as a JPG first.");
  }
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas.toDataURL('image/jpeg', 0.85);
}
