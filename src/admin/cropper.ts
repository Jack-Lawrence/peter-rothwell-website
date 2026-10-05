// Photo cropper for the fixed-shape photo slots (hero carousel, Meet your coach).
//
// Peter picks a photo, then drags it and zooms to choose exactly what shows.
// The crop always has the slot's shape, and can never be smaller than the
// slot's size, so the saved photo is sharp and fills its box. A photo too small
// for the slot is refused before the cropper opens.

import { h } from './ui';
import type { Slot } from '../lib/slots';

export class PhotoError extends Error {}

/** Opens the photo, checks it's big enough, and lets Peter frame it. Resolves with a JPEG data URL, or null if cancelled. */
export async function cropPhoto(file: File, slot: Slot): Promise<string | null> {
  if (!file.type.startsWith('image/'))
    throw new PhotoError("That file isn't a photo. Please choose a JPG, PNG or HEIC image.");
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    throw new PhotoError("This browser can't open that photo. Try saving it as a JPG first.");
  }

  const ratio = slot.width / slot.height;
  const iw = bitmap.width;
  const ih = bitmap.height;
  // The biggest crop of the right shape that fits in the photo.
  const maxW = Math.min(iw, ih * ratio);
  if (maxW < slot.width - 0.5) {
    bitmap.close();
    throw new PhotoError(
      `This photo is too small for this spot. It needs to be at least ${slot.width} × ${slot.height} pixels ` +
        `(in that shape), and yours is ${iw} × ${ih}. Try the original photo from your phone or camera, ` +
        'rather than a screenshot or one saved from a message.',
    );
  }
  const minW = slot.width; // most zoomed in

  try {
    return await frame(bitmap, slot, ratio, maxW, minW);
  } finally {
    bitmap.close();
  }
}

function frame(bitmap: ImageBitmap, slot: Slot, ratio: number, maxW: number, minW: number) {
  const iw = bitmap.width;
  const ih = bitmap.height;
  // Crop rectangle in the photo's own pixels. Starts zoomed out, centred.
  let cw = maxW;
  let cx = (iw - cw) / 2;
  let cy = (ih - cw / ratio) / 2;

  const canvas = h('canvas', { class: 'crop-canvas' });
  const guide =
    !!slot.safeHeight &&
    h(
      'div',
      { class: 'crop-guide', style: `--safe: ${(slot.safeHeight ?? 1) * 100}%`, 'aria-hidden': 'true' },
      h('span', {}, 'Always shows'),
    );
  const box = h(
    'div',
    {
      class: 'crop-frame',
      style: `aspect-ratio: ${slot.width} / ${slot.height}`,
      tabindex: 0,
      role: 'group',
      'aria-label': 'Photo framing. Use the arrow keys to move the photo, and plus or minus to zoom.',
    },
    canvas,
    guide,
  );
  const canZoom = maxW - minW > 1;
  const zoom = h('input', {
    type: 'range',
    min: 0,
    max: 1000,
    value: 0,
    id: 'crop-zoom',
    disabled: !canZoom,
  });

  const clamp = () => {
    cw = Math.min(maxW, Math.max(minW, cw));
    const chh = cw / ratio;
    cx = Math.min(iw - cw, Math.max(0, cx));
    cy = Math.min(ih - chh, Math.max(0, cy));
  };
  // The slider is logarithmic, so each step feels like the same amount of zoom.
  const toSlider = () => (canZoom ? Math.round((Math.log(maxW / cw) / Math.log(maxW / minW)) * 1000) : 0);
  const fromSlider = (v: number) => maxW / Math.pow(maxW / minW, v / 1000);

  const draw = () => {
    const rect = box.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const w = Math.round(rect.width * dpr);
    const hgt = Math.round(rect.height * dpr);
    if (canvas.width !== w || canvas.height !== hgt) {
      canvas.width = w;
      canvas.height = hgt;
    }
    const ctx = canvas.getContext('2d')!;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(bitmap, cx, cy, cw, cw / ratio, 0, 0, w, hgt);
    zoom.value = String(toSlider());
  };

  // Zoom around a point in the frame (0–1 across, 0–1 down), the centre by default.
  const zoomTo = (newW: number, fx = 0.5, fy = 0.5) => {
    const px = cx + cw * fx;
    const py = cy + (cw / ratio) * fy;
    cw = Math.min(maxW, Math.max(minW, newW));
    cx = px - cw * fx;
    cy = py - (cw / ratio) * fy;
    clamp();
    draw();
  };
  const moveBy = (dx: number, dy: number) => {
    cx += dx;
    cy += dy;
    clamp();
    draw();
  };

  // Drag to move (mouse, touch or pen).
  let drag: { x: number; y: number } | null = null;
  box.addEventListener('pointerdown', (e) => {
    drag = { x: e.clientX, y: e.clientY };
    box.setPointerCapture(e.pointerId);
    box.classList.add('is-dragging');
  });
  box.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const scale = cw / box.getBoundingClientRect().width;
    moveBy(-(e.clientX - drag.x) * scale, -(e.clientY - drag.y) * scale);
    drag = { x: e.clientX, y: e.clientY };
  });
  const endDrag = () => {
    drag = null;
    box.classList.remove('is-dragging');
  };
  box.addEventListener('pointerup', endDrag);
  box.addEventListener('pointercancel', endDrag);
  box.addEventListener(
    'wheel',
    (e) => {
      if (!canZoom) return;
      e.preventDefault();
      const r = box.getBoundingClientRect();
      zoomTo(cw * Math.pow(1.0015, e.deltaY), (e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height);
    },
    { passive: false },
  );
  box.addEventListener('keydown', (e) => {
    const step = cw * 0.04;
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    };
    if (moves[e.key]) moveBy(...moves[e.key]);
    else if (e.key === '+' || e.key === '=') zoomTo(cw / 1.1);
    else if (e.key === '-' || e.key === '_') zoomTo(cw * 1.1);
    else return;
    e.preventDefault();
  });
  zoom.addEventListener('input', () => zoomTo(fromSlider(Number(zoom.value))));

  return new Promise<string | null>((resolve) => {
    const dlg = h(
      'dialog',
      { class: 'dlg dlg--crop', 'aria-labelledby': 'crop-title' },
      h('h2', { id: 'crop-title' }, 'Choose what shows'),
      h(
        'p',
        { class: 'hint' },
        'Drag the photo to move it, and use the slider to zoom in. ',
        slot.safeHeight
          ? 'On some screens the very top and bottom are trimmed a little, so keep the important part inside the dashed lines.'
          : 'This is exactly how it will look on your website.',
      ),
      box,
      h(
        'div',
        { class: 'crop-zoom' },
        h('label', { for: 'crop-zoom' }, 'Zoom'),
        zoom,
        !canZoom && h('span', { class: 'hint' }, 'This photo is the smallest size allowed, so it can’t zoom in.'),
      ),
      h(
        'div',
        { class: 'dlg-actions' },
        h('button', { type: 'button', class: 'btn', onclick: (() => dlg.close('')) as EventListener }, 'Cancel'),
        h(
          'button',
          { type: 'button', class: 'btn btn--primary', onclick: (() => dlg.close('ok')) as EventListener },
          'Use this photo',
        ),
      ),
    );
    const resized = new ResizeObserver(draw);
    dlg.addEventListener('close', () => {
      resized.disconnect();
      let result: string | null = null;
      if (dlg.returnValue === 'ok') {
        // Save at exactly the slot's size.
        const out = document.createElement('canvas');
        out.width = slot.width;
        out.height = slot.height;
        const ctx = out.getContext('2d')!;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(bitmap, cx, cy, cw, cw / ratio, 0, 0, slot.width, slot.height);
        result = out.toDataURL('image/jpeg', 0.88);
      }
      dlg.remove();
      resolve(result);
    });
    document.body.append(dlg);
    dlg.showModal();
    draw();
    resized.observe(box);
  });
}
