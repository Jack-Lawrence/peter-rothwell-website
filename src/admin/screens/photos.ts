// Photos: the hero carousel, the Run Club photos and Meet your coach.
import { h, field, textInput, Errors, errorSummary, toast, dialog, type Field } from '../ui';
import { type Change } from '../store';
import { slugify } from '../markdown';
import { resizePhoto } from '../images';
import { cropPhoto, PhotoError } from '../cropper';
import { SLOTS, type Slot } from '../../lib/slots';
import {
  PATHS,
  store,
  readJson,
  toJson,
  save,
  savedMessage,
  setDirty,
  screen,
  heading,
  route,
  trackDirty,
} from '../app';

// ---------- Photos (hero carousel, Run Club and Meet your coach) ----------

export interface SitePhoto {
  image: string;
  alt: string;
}
export const MAX_CAROUSEL_PHOTOS = 6;
export const IMAGE_TYPES: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
};

/**
 * Peter's photo library (src/assets/library): full-size photos to pick from for
 * any photo spot. Resolves with the chosen photo, 'upload' to choose one from his
 * device instead (straight away if the library is empty), or null if cancelled.
 */
export async function chooseFromLibrary(): Promise<File | 'upload' | null> {
  let names: string[] = [];
  try {
    names = (await store!.list(PATHS.library)).filter((n) => /\.(jpe?g|png|webp)$/i.test(n)).sort();
  } catch {
    /* can't read the library: uploading still works */
  }
  if (!names.length) return 'upload';

  const label = (name: string) => name.replace(/\.[^.]*$/, '').replace(/-/g, ' ');
  let chosen = '';
  const dlg = h(
    'dialog',
    { class: 'dlg dlg--library', 'aria-labelledby': 'library-title' },
    h('h2', { id: 'library-title' }, 'Choose a photo'),
    h('p', {}, 'Pick one of your photos, or upload a new one from your phone or computer.'),
    h(
      'div',
      { class: 'library-grid' },
      names.map((name) => {
        const img = h('img', { alt: '', loading: 'lazy' });
        store!.imageUrl(`${PATHS.library}/${name}`).then((url) => (img.src = url ?? ''));
        return h(
          'button',
          {
            type: 'button',
            class: 'library-pick',
            'aria-label': `Use ${label(name)}`,
            title: label(name),
            onclick: (() => {
              chosen = name;
              dlg.close('pick');
            }) as EventListener,
          },
          img,
        );
      }),
    ),
    h(
      'div',
      { class: 'dlg-actions' },
      h('button', { type: 'button', class: 'btn', onclick: (() => dlg.close('')) as EventListener }, 'Cancel'),
      h(
        'button',
        { type: 'button', class: 'btn btn--primary', onclick: (() => dlg.close('upload')) as EventListener },
        'Upload a new photo',
      ),
    ),
  );
  const answer = await new Promise<string>((resolve) => {
    dlg.addEventListener('close', () => {
      resolve(dlg.returnValue);
      dlg.remove();
    });
    document.body.append(dlg);
    dlg.showModal();
  });
  if (answer === 'upload') return 'upload';
  if (answer !== 'pick') return null;

  // The full-size photo, so it can be cropped sharply. It can take a few seconds.
  toast('Opening photo…');
  const url = await store!.imageUrl(`${PATHS.library}/${chosen}`, true);
  const blob = url
    ? await fetch(url)
        .then((r) => (r.ok ? r.blob() : null))
        .catch(() => null)
    : null;
  if (!blob) {
    await dialog(
      'That photo can’t be opened',
      [h('p', {}, 'Something went wrong loading that photo. Please try again in a minute.')],
      [{ label: 'OK', value: 'ok', primary: true }],
    );
    return null;
  }
  const type = IMAGE_TYPES[chosen.split('.').pop()!.toLowerCase()];
  return new File([blob], chosen, { type });
}

export async function photosScreen(arg: string) {
  const site = await readJson<{
    hero: { photos?: SitePhoto[] } & Record<string, unknown>;
    runClub?: { photos?: SitePhoto[] } & Record<string, unknown>;
    about: { photo?: SitePhoto } & Record<string, unknown>;
  }>(PATHS.site);
  const summary = errorSummary();

  // A photo already on the site (path) or a newly cropped one (data), waiting to be saved.
  // `upload` is the photo Peter chose from his device, added to his photo library on save.
  type Pic = { path: string; data: string; upload?: File; alt: Field; box: HTMLElement; img: HTMLImageElement };

  const chooseFile = () =>
    new Promise<File | null>((resolve) => {
      const input = h('input', { type: 'file', accept: 'image/*', class: 'visually-hidden' });
      const done = () => {
        resolve(input.files?.[0] ?? null);
        input.remove();
      };
      input.addEventListener('change', done);
      input.addEventListener('cancel', done);
      document.body.append(input);
      input.click();
    });

  const pick = async (slot: Slot, onPicked: (data: string, upload?: File) => void) => {
    const choice = await chooseFromLibrary();
    if (!choice) return;
    const file = choice === 'upload' ? await chooseFile() : choice;
    if (!file) return;
    try {
      const data = await cropPhoto(file, slot);
      if (data) {
        onPicked(data, choice === 'upload' ? file : undefined);
        setDirty(true);
      }
    } catch (err) {
      await dialog(
        'That photo can’t be used',
        [h('p', {}, err instanceof PhotoError ? err.message : 'Something went wrong opening that photo.')],
        [{ label: 'OK', value: 'ok', primary: true }],
      );
    }
  };

  const showPic = async (pic: Pic) => {
    pic.img.src = pic.data || (pic.path ? ((await store!.imageUrl(pic.path)) ?? '') : '');
  };
  const makePic = (photo: SitePhoto | undefined, slot: Slot, legend: string, actions: (pic: Pic) => Node[]): Pic => {
    const img = h('img', { alt: '', style: `aspect-ratio: ${slot.width} / ${slot.height}` });
    const alt = field(
      'Describe the photo',
      textInput(photo?.alt ?? '', { maxlength: 160 }),
      'For people who can’t see it, e.g. “Peter running up Arthur’s Seat”.',
    );
    const pic: Pic = { path: photo?.image ?? '', data: '', alt, img, box: h('fieldset', { class: 'box' }) };
    pic.box.append(
      h('legend', {}, legend),
      h(
        'div',
        { class: 'photo-slot' },
        img,
        h('div', { class: 'stack' }, alt.wrap, h('div', { class: 'row-actions' }, actions(pic))),
      ),
    );
    showPic(pic);
    return pic;
  };
  const replaceBtn = (pic: Pic, slot: Slot) =>
    h(
      'button',
      {
        type: 'button',
        class: 'btn btn--small',
        onclick: (() =>
          pick(slot, (data, upload) => {
            pic.data = data;
            pic.upload = upload;
            showPic(pic);
          })) as EventListener,
      },
      'Replace photo',
    );

  const smallBtn = (label: string, onclick: () => void, extra = '') =>
    h('button', { type: 'button', class: `btn btn--small ${extra}`.trim(), onclick: onclick as EventListener }, label);

  // A carousel (top of the home page, Run Club): a list of photos to add, replace, reorder and remove.
  const carousel = (photos: SitePhoto[] | undefined, slot: Slot) => {
    const c = { pics: [] as Pic[], list: h('div', { class: 'stack' }), addBtn: h('button', { type: 'button' }) };
    const move = (pic: Pic, by: number) => {
      const i = c.pics.indexOf(pic);
      const j = i + by;
      if (j < 0 || j >= c.pics.length) return;
      [c.pics[i], c.pics[j]] = [c.pics[j], c.pics[i]];
      draw();
      setDirty(true);
    };
    const one = (photo: SitePhoto | undefined): Pic =>
      makePic(photo, slot, 'Photo', (pic) => [
        replaceBtn(pic, slot),
        smallBtn('Move up', () => move(pic, -1)),
        smallBtn('Move down', () => move(pic, 1)),
        smallBtn(
          'Remove',
          () => {
            c.pics = c.pics.filter((p) => p !== pic);
            draw();
            setDirty(true);
          },
          'btn--danger',
        ),
      ]);
    const draw = () => {
      c.pics.forEach((p, i) => (p.box.querySelector('legend')!.textContent = `Photo ${i + 1}`));
      c.list.replaceChildren(...(c.pics.length ? c.pics.map((p) => p.box) : [h('p', {}, 'No photos yet.')]));
      c.addBtn.hidden = c.pics.length >= MAX_CAROUSEL_PHOTOS;
    };
    c.addBtn = h(
      'button',
      {
        type: 'button',
        class: 'btn',
        onclick: (() =>
          pick(slot, (data, upload) => {
            const pic = one(undefined);
            pic.data = data;
            pic.upload = upload;
            showPic(pic);
            c.pics.push(pic);
            draw();
            pic.alt.input.focus();
          })) as EventListener,
      },
      '+ Add a photo',
    );
    c.pics = (photos ?? []).map((p) => one(p));
    draw();
    return c;
  };
  const hero = carousel(site.hero.photos, SLOTS.hero);
  const club = carousel(site.runClub?.photos, SLOTS.runClub);

  // Meet your coach
  const portrait = makePic(site.about.photo, SLOTS.portrait, 'Your photo', (pic) => [replaceBtn(pic, SLOTS.portrait)]);

  const saveBtn = h('button', { type: 'submit', class: 'btn btn--primary btn--big' }, 'Save photos');
  const form = h(
    'form',
    {
      novalidate: true,
      class: 'stack',
      onsubmit: (async (e: Event) => {
        e.preventDefault();
        const errors = new Errors(summary);
        if (!hero.pics.length) errors.add(hero.addBtn, 'Add at least one photo for the top of the home page.');
        hero.pics.forEach((p, i) => {
          if (!p.alt.input.value.trim()) errors.add(p.alt, `Top of the home page, photo ${i + 1}: describe the photo.`);
        });
        if (!club.pics.length) errors.add(club.addBtn, 'Add at least one photo for the Run Club.');
        club.pics.forEach((p, i) => {
          if (!p.alt.input.value.trim()) errors.add(p.alt, `Run Club, photo ${i + 1}: describe the photo.`);
        });
        if (!portrait.path && !portrait.data) errors.add(portrait.box, 'Add a photo for Meet your coach.');
        else if (!portrait.alt.input.value.trim()) errors.add(portrait.alt, 'Meet your coach: describe the photo.');
        if (!errors.show()) return;

        // New photos get their own file; uploaded photos no longer used are deleted.
        // Photos from Peter's device also go in his photo library, uncropped, to use again later.
        const stamp = Date.now().toString(36);
        const changes: Change[] = [];
        const keep = async (pic: Pic, name: string): Promise<SitePhoto> => {
          const alt = pic.alt.input.value.trim();
          if (!pic.data) return { image: pic.path, alt };
          const path = `${PATHS.photos}/${name}-${stamp}.jpg`;
          changes.push({ path, image: pic.data });
          if (pic.upload) {
            const original = `${PATHS.library}/${slugify(pic.upload.name.replace(/.[^.]*$/, '')) || 'photo'}-${name}-${stamp}.jpg`;
            changes.push({ path: original, image: await resizePhoto(pic.upload) });
          }
          return { image: path, alt };
        };
        const heroPhotos: SitePhoto[] = [];
        for (const [i, p] of hero.pics.entries()) heroPhotos.push(await keep(p, `hero-${i + 1}`));
        const clubPhotos: SitePhoto[] = [];
        for (const [i, p] of club.pics.entries()) clubPhotos.push(await keep(p, `runclub-${i + 1}`));
        const portraitPhoto = await keep(portrait, 'portrait');
        const used = new Set([...heroPhotos, ...clubPhotos, portraitPhoto].map((p) => p.image));
        const before = [
          ...(site.hero.photos ?? []),
          ...(site.runClub?.photos ?? []),
          ...(site.about.photo ? [site.about.photo] : []),
        ];
        for (const old of before) {
          if (old.image.startsWith(`${PATHS.photos}/`) && !used.has(old.image))
            changes.push({ path: old.image, remove: true });
        }
        const next = {
          ...site,
          hero: { ...site.hero, photos: heroPhotos },
          ...(site.runClub && { runClub: { ...site.runClub, photos: clubPhotos } }),
          about: { ...site.about, photo: portraitPhoto },
        };
        changes.push({ path: PATHS.site, text: toJson(next) });
        if (await save(changes, 'Update photos', saveBtn)) {
          toast(savedMessage());
          route();
        }
      }) as EventListener,
    },
    h(
      'section',
      { class: 'stack', 'aria-labelledby': 'hero-photos' },
      h('h2', { id: 'hero-photos' }, 'Top of the home page'),
      h(
        'p',
        { class: 'hint' },
        `These take turns beside “Run further. Lift stronger.”, in this order. Up to ${MAX_CAROUSEL_PHOTOS} photos, ` +
          `each at least ${SLOTS.hero.width} × ${SLOTS.hero.height} pixels. When you add one, you choose which part shows.`,
      ),
      hero.list,
      hero.addBtn,
    ),
    site.runClub &&
      h(
        'section',
        { class: 'stack', id: 'runclub-photos-section', 'aria-labelledby': 'runclub-photos' },
        h('h2', { id: 'runclub-photos' }, 'Run Club'),
        h(
          'p',
          { class: 'hint' },
          `These take turns beside the Run Club details, in this order. Up to ${MAX_CAROUSEL_PHOTOS} photos, ` +
            `each at least ${SLOTS.runClub.width} × ${SLOTS.runClub.height} pixels. Group photos from your sessions work well.`,
        ),
        club.list,
        club.addBtn,
      ),
    h(
      'section',
      { class: 'stack', 'aria-labelledby': 'coach-photo' },
      h('h2', { id: 'coach-photo' }, 'Meet your coach'),
      h(
        'p',
        { class: 'hint' },
        `A square photo of you, at least ${SLOTS.portrait.width} × ${SLOTS.portrait.height} pixels.`,
      ),
      portrait.box,
    ),
    h('div', { class: 'save-bar' }, saveBtn),
  );
  trackDirty(form);
  screen(
    'Photos',
    heading('Photos', 'The photos at the top of your home page, in the Run Club section and in Meet your coach.'),
    summary,
    form,
  );
  // Arriving from the Run Club page: go straight to its photos.
  if (arg === 'runclub') document.getElementById('runclub-photos-section')?.scrollIntoView();
}
