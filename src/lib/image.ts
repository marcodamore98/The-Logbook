/** Photo as a JPEG small enough to store (about 350 kB at most). */
export async function compress(file: File): Promise<Blob> {
  const bmp = await createImageBitmap(file);
  let max = 1400;
  let quality = 0.8;
  for (;;) {
    const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bmp.width * scale);
    canvas.height = Math.round(bmp.height * scale);
    canvas.getContext('2d')!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob>((res, rej) =>
      canvas.toBlob((b) => (b ? res(b) : rej(new Error('Compressione fallita'))), 'image/jpeg', quality),
    );
    if (blob.size < 350_000 || max <= 640) return blob;
    max = Math.round(max * 0.8);
    quality = Math.max(0.6, quality - 0.05);
  }
}
