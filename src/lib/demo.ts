// Temporary stock photos in src/assets/demo/ (see CREDITS.md there), used on
// the preview site until Peter's own photos are added. Photo.astro labels them.
import type { ImageMetadata } from 'astro';

const files = import.meta.glob<{ default: ImageMetadata }>('../assets/demo/*.{jpg,jpeg,png,webp}', { eager: true });
const demoSources = new Set(Object.values(files).map((m) => m.default.src));

export function isDemoPhoto(image?: ImageMetadata): boolean {
  return !!image && demoSources.has(image.src);
}

const instagramAlt = [
  'Three runners silhouetted against a golden sunset',
  'A runner on a grassy hilltop above a sea of cloud',
  'A barbell loaded with red weight plates on a gym floor',
  'A trail runner in a race vest on a dry hillside path',
  'A coach guiding a client through a leg press in the gym',
  'A pack of runners wearing race numbers on a city road',
];

/** The six images for the Instagram grid on the preview site (insta-1 … insta-6). */
export const demoInstagram = instagramAlt
  .map((alt, i) => ({ image: files[`../assets/demo/insta-${i + 1}.jpg`]?.default, alt }))
  .filter((p): p is { image: ImageMetadata; alt: string } => !!p.image);
