// The photo slots Peter can change in the admin area. Each photo is cropped to
// exactly this shape and size when he saves it, and anything smaller is refused,
// so a photo always fills its box sharply. Used by the site and the admin cropper.
// 1080 wide means photos saved from Instagram (1080 × 1350 or 1080 × 1080) fit.

export interface Slot {
  /** Saved size in pixels, which is also the smallest photo (or crop) allowed. */
  width: number;
  height: number;
  /**
   * Part of the frame that always shows, as a share of the height (from the
   * middle). The hero box is a little wider on short laptop screens, so the top
   * and bottom of the crop can be trimmed there.
   */
  safeHeight?: number;
}

export const SLOTS = {
  hero: { width: 1080, height: 1350, safeHeight: 0.8 },
  portrait: { width: 1080, height: 1080 },
  runClub: { width: 1080, height: 1350 },
} satisfies Record<string, Slot>;
