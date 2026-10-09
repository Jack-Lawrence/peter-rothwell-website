// Photos chosen in the admin area (hero carousel, Meet your coach) are saved as
// repo paths in site.json, e.g. "src/assets/photos/hero-1717000000.jpg". This
// turns a path into an image Astro can resize. The admin crops each photo to
// its slot's shape before saving, so the site never has to guess the framing.
import type { ImageMetadata } from 'astro';

const files = import.meta.glob<{ default: ImageMetadata }>('/src/assets/photos/*.{jpg,jpeg,png,webp}', {
  eager: true,
});

export interface SitePhoto {
  image: string;
  alt: string;
}

export function photoFor(path?: string): ImageMetadata | undefined {
  return path ? files[`/${path.replace(/^\//, '')}`]?.default : undefined;
}

/** A carousel's photos (hero, Run Club), skipping any whose file is missing. */
export function slidesFor(photos: SitePhoto[] = []) {
  return photos.flatMap((p) => {
    const src = photoFor(p.image);
    return src ? [{ src, alt: p.alt }] : [];
  });
}
