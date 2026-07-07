const MAX_SIDE = 4000;

/**
 * Decode a blob into an ImageBitmap, respecting EXIF orientation (phone
 * photos!) and downscaling oversized images so they never enter the pipeline
 * above 4000px on the longest side.
 */
export async function loadBitmap(source: Blob): Promise<ImageBitmap> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(source, { imageOrientation: 'from-image' });
  } catch {
    // Older engines that reject the options dictionary
    bitmap = await createImageBitmap(source);
  }
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

/** Rotate a bitmap by quarter turns (positive = clockwise). */
export async function rotateBitmap(
  bitmap: ImageBitmap,
  quarterTurns: number,
): Promise<ImageBitmap> {
  const turns = ((quarterTurns % 4) + 4) % 4;
  if (turns === 0) return bitmap;
  const swap = turns % 2 === 1;
  const canvas = document.createElement('canvas');
  canvas.width = swap ? bitmap.height : bitmap.width;
  canvas.height = swap ? bitmap.width : bitmap.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return bitmap;
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate((turns * Math.PI) / 2);
  ctx.drawImage(bitmap, -bitmap.width / 2, -bitmap.height / 2);
  bitmap.close();
  return createImageBitmap(canvas);
}
