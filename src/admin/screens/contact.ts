// Contact details: phone, email, Instagram and address.
import { h, field, textInput, Errors, errorSummary, toast } from '../ui';
import { PATHS, readJson, toJson, save, savedMessage, screen, heading, trackDirty } from '../app';

// ---------- Contact details ----------

export async function contactScreen() {
  const site = await readJson<{ contact: Record<string, string>; location: Record<string, string> }>(PATHS.site);
  const { contact, location: loc } = site;
  const summary = errorSummary();
  const phone = field('Phone', textInput(contact.phone, { type: 'tel', maxlength: 20, autocomplete: 'off' }));
  const email = field('Email', textInput(contact.email, { type: 'email', maxlength: 80, autocomplete: 'off' }));
  const insta = field(
    'Instagram name',
    textInput(contact.instagram, { maxlength: 30 }),
    'Without the @, e.g. peter_rothwell.pt',
  );
  const place = field('Venue', textInput(loc.place, { maxlength: 60 }), 'e.g. "Meadowbank Shopping Park"');
  const street = field('Street address', textInput(loc.street, { maxlength: 60 }));
  const district = field(
    'Area',
    textInput((loc.area ?? '').split(',')[0].trim(), { maxlength: 40 }),
    'e.g. "Meadowbank"',
  );
  const town = field('Town or city', textInput(loc.locality, { maxlength: 40 }));
  const postcode = field('Postcode', textInput(loc.postcode, { maxlength: 10 }));
  const saveBtn = h('button', { type: 'submit', class: 'btn btn--primary btn--big' }, 'Save contact details');

  const form = h(
    'form',
    {
      novalidate: true,
      class: 'stack',
      onsubmit: (async (e: Event) => {
        e.preventDefault();
        const errors = new Errors(summary);
        const digits = phone.input.value.replace(/[\s()-]/g, '');
        if (!/^(\+44|0)\d{9,10}$/.test(digits)) errors.add(phone, 'Enter a UK phone number, like 07367 636632.');
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.input.value.trim()))
          errors.add(email, 'Enter an email address, like name@gmail.com.');
        const handle = insta.input.value
          .trim()
          .replace(/^@/, '')
          .replace(/^https?:\/\/(www\.)?instagram\.com\//, '')
          .replace(/\/$/, '');
        if (!/^[A-Za-z0-9._]{1,30}$/.test(handle))
          errors.add(insta, 'Enter your Instagram name using only letters, numbers, dots and underscores.');
        if (!street.input.value.trim()) errors.add(street, 'Add the street address.');
        if (!town.input.value.trim()) errors.add(town, 'Add the town or city.');
        if (!/^[A-Z]{1,2}\d[A-Z\d]? ?\d[A-Z]{2}$/i.test(postcode.input.value.trim()))
          errors.add(postcode, 'Enter a UK postcode, like EH7 5TS.');
        if (!errors.show()) return;

        const pc = postcode.input.value
          .trim()
          .toUpperCase()
          .replace(/^(.+?)(\d[A-Z]{2})$/, '$1 $2')
          .replace(/\s+/g, ' ');
        const area = [district.input.value.trim(), town.input.value.trim()].filter(Boolean).join(', ');
        const address = `${[street.input.value.trim(), district.input.value.trim(), town.input.value.trim()].filter(Boolean).join(', ')} ${pc}`;
        const next = {
          ...site,
          contact: {
            ...contact,
            phone: phone.input.value.trim(),
            email: email.input.value.trim(),
            instagram: handle,
          },
          location: {
            ...loc,
            area,
            place: place.input.value.trim(),
            address,
            street: street.input.value.trim(),
            locality: town.input.value.trim(),
            postcode: pc,
            mapsUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address).replace(/%20/g, '+')}`,
          },
        };
        if (await save([{ path: PATHS.site, text: toJson(next) }], 'Update contact details', saveBtn))
          toast(savedMessage());
      }) as EventListener,
    },
    h('fieldset', { class: 'box' }, h('legend', {}, 'How people reach you'), phone.wrap, email.wrap, insta.wrap),
    h(
      'fieldset',
      { class: 'box' },
      h('legend', {}, 'Where you train people in person'),
      place.wrap,
      street.wrap,
      district.wrap,
      h('div', { class: 'pair' }, town.wrap, postcode.wrap),
    ),
    h('div', { class: 'save-bar' }, saveBtn),
  );
  trackDirty(form);
  screen(
    'Contact details',
    heading(
      'Contact details',
      'Your phone, email, Instagram and address. Shown at the bottom of every page and on your policies.',
    ),
    summary,
    form,
  );
}
