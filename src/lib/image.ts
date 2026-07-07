const MAX_SIDE = 4000;

/**
 * Decode a blob into an ImageBitmap, downscaling oversized images so they
 * never enter the pipeline above 4000px on the longest side.
 */
export async function loadBitmap(source: Blob): Promise<ImageBitmap> {
  const bitmap = await createImageBitmap(source);
  const largest = Math.max(bitmap.width, bitmap.height);
  if (largest <= MAX_SIDE) return bitmap;
  const scale = MAX_SIDE / largest;
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) return bitmap;
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return createImageBitmap(canvas);
}
