import sharp from "sharp";

/**
 * How flat an image is, as one number.
 *
 * The signal is the mean of the per-channel standard deviations of the pixel values, and it was
 * arrived at by elimination: file size and bytes-per-pixel were both tried first and both
 * failed, because WebP's adaptive compression squeezes a flat generated graphic and a real
 * photograph into a similar band. Pixel variance survives that. A photograph has continuous
 * shading, reflections and shadow gradients even against a clean studio background; a gem motif
 * and two lines of text on a radial gradient does not.
 *
 * **The number alone does not separate the two populations, and must not be used as if it did.**
 * Measured over this catalogue: the 206 known placeholders span 14.1–19.9, and real
 * photographs run to 92.7 — but three migrated photographs sit at 15.7, 17.5 and 18.3, and the
 * owner's own photography goes down to 13.1. A threshold on its own would call those five
 * placeholders. It is only decisive once something else has established that the file is *not*
 * the photograph the record stages, which is what `validate-products.mjs` establishes by
 * comparing bytes before it ever measures flatness.
 */
export const PLACEHOLDER_MAX_STDEV = 21;

export async function averageChannelStdev(imagePath) {
  const stats = await sharp(imagePath).stats();
  const channels = stats.channels.slice(0, 3);
  return channels.reduce((sum, channel) => sum + channel.stdev, 0) / channels.length;
}
