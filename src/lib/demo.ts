// Temporary stock photos in src/assets/demo/ (see CREDITS.md there), used on
// the preview site until Peter's own photos are added. Photo.astro labels them.
import type { ImageMetadata } from 'astro';

const files = import.meta.glob<{ default: ImageMetadata }>('../assets/demo/*.{jpg,jpeg,png,webp}', { eager: true });
const demoSources = new Set(Object.values(files).map((m) => m.default.src));

export function isDemoPhoto(image?: ImageMetadata): boolean {
  return !!image && demoSources.has(image.src);
}

// Until the Instagram feed is connected, the preview site fills the row with
// six of Peter's own photos from his library.
const library = import.meta.glob<{ default: ImageMetadata }>('../assets/library/*.webp', { eager: true });
const instagramStandIns = [
  ['hill-run-orange-top', 'Peter running along a grassy hilltop in an orange top'],
  ['kerry-way-ultra-finish-group', 'Peter and three friends with medals and a flag at the Kerry Way Ultra finish'],
  ['marbella-epic-trail-climb', 'Peter climbing a rocky path under a tree in the Marbella Epic Trail'],
  ['marbella-epic-trail-finish', 'Peter crossing the Marbella Epic Trail finish line at night'],
  ['valencia-marathon-name-wall', 'Peter pointing to his name on the Valencia Marathon runners wall'],
  ['hill-walk-poles-from-behind', 'Peter walking with poles through green rolling hills, seen from behind'],
];

/** Six of Peter's photos for the Instagram grid on the preview site. */
export const demoInstagram = instagramStandIns
  .map(([name, alt]) => ({ image: library[`../assets/library/${name}.webp`]?.default, alt }))
  .filter((p): p is { image: ImageMetadata; alt: string } => !!p.image);
