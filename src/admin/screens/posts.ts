// Blog posts: the list, and the editor for writing and changing a post.
import {
  h,
  field,
  textInput,
  textArea,
  Errors,
  errorSummary,
  toast,
  dialog,
  relativeTime,
  formatDate,
  today,
} from '../ui';
import { type Change } from '../store';
import { parseDoc, stringifyDoc, markdownToHtml, htmlToMarkdown, wordCount, slugify, type Front } from '../markdown';
import { resizePhoto } from '../images';
import { createRichEditor } from '../rich-editor';
import {
  config,
  PATHS,
  storage,
  store,
  isDemo,
  save,
  setDirty,
  screen,
  backLink,
  heading,
  route,
  trackDirty,
} from '../app';
import { chooseFromLibrary } from './photos';

// ---------- Posts: shared ----------

export interface PostInfo {
  slug: string;
  data: Front;
  body: string;
}

export async function loadPosts(): Promise<PostInfo[]> {
  const names = (await store!.list(PATHS.journal)).filter((n) => n.endsWith('.md'));
  const posts = await Promise.all(
    names.map(async (name) => {
      const text = (await store!.read(`${PATHS.journal}/${name}`)) ?? '';
      const { data, body } = parseDoc(text);
      return { slug: name.replace(/\.md$/, ''), data, body };
    }),
  );
  return posts.sort((a, b) => String(b.data.date ?? '').localeCompare(String(a.data.date ?? '')));
}

export function postRow(p: PostInfo) {
  const draft = p.data.draft === true;
  const sub = [p.data.topic, p.data.date ? formatDate(String(p.data.date)) : ''].filter(Boolean).join(' · ');
  return h(
    'li',
    {},
    h(
      'a',
      { class: 'row', href: `#/post/${p.slug}` },
      h('span', { class: 'row-text' }, h('b', {}, String(p.data.title ?? p.slug)), h('span', { class: 'sub' }, sub)),
      // Written by Jack for the preview; the label goes once Peter saves the post.
      p.data.sample === true && h('span', { class: 'pill pill--sample' }, 'Example post'),
      h('span', { class: draft ? 'pill pill--draft' : 'pill pill--live' }, draft ? 'Draft' : 'Live'),
    ),
  );
}

// ---------- Posts list ----------

export async function postsList() {
  const posts = await loadPosts();
  screen(
    'Blog posts',
    heading('Blog posts', 'Write a new post, or tap one to edit it.'),
    h('p', {}, h('a', { class: 'btn btn--primary', href: '#/post/new' }, 'Write a blog post')),
    h(
      'section',
      { class: 'box' },
      posts.length ? h('ul', { class: 'rows' }, posts.map(postRow)) : h('p', {}, 'No posts yet.'),
    ),
  );
}

// ---------- Post editor ----------

export const AUTOSAVE = 'rr-admin-autosave:';
export const mdToRepo = (p: string) => `src/${p.replace(/^(\.\.\/)+/, '')}`;

/** A front matter date as YYYY-MM-DD, whether it was read as text or as a date. */
export const isoDate = (value: unknown) =>
  value instanceof Date ? value.toISOString().slice(0, 10) : String(value ?? '').slice(0, 10);

export interface Draft {
  title: string;
  topic: string;
  excerpt: string;
  html: string;
  coverPath: string;
  coverData: string;
  coverAlt: string;
  /** Older autosaves have no date. */
  date?: string;
  savedAt: number;
}

export async function postEditor(slugArg: string) {
  const isNew = slugArg === 'new' || !slugArg;
  const slug = isNew ? '' : slugArg;
  const posts = await loadPosts();
  const existing = posts.find((p) => p.slug === slug);
  if (!isNew && !existing) {
    screen(
      'Not found',
      heading('Post not found', undefined, ['#/posts', 'All posts']),
      h('p', {}, 'This post may have been deleted.'),
    );
    return;
  }
  const front: Front = { ...(existing?.data ?? {}) };
  const isLive = !!existing && front.draft !== true;
  const topics = [...new Set(posts.map((p) => String(p.data.topic ?? '')).filter(Boolean))];

  // State
  const autosaveKey = AUTOSAVE + (slug || 'new');
  let coverPath = String(front.cover ?? '');
  let coverData = '';

  // Fields
  const title = field('Title', textInput(String(front.title ?? ''), { maxlength: 120, class: 'big-input' }));
  const excerpt = field(
    'Short summary',
    textArea(String(front.excerpt ?? ''), { rows: 2, maxlength: 220 }),
    'One or two sentences. Shown under the title and in the list of posts.',
  );
  const topicInput = textInput(String(front.topic ?? ''), { list: 'topics', maxlength: 30 });
  const topic = field('Topic', topicInput, 'Pick one you used before, or type a new one.');
  // The date shown on the post. Today for a new post; an earlier date for posts
  // brought over from the old website, so they keep their original dates.
  const storedDate = isoDate(front.date);
  const postDate = field(
    'Date',
    h('input', { type: 'date', value: storedDate || today(), max: today() }),
    'Shown on the post. Change it to add an older post with its original date.',
  );
  const coverAlt = field(
    'Describe the photo',
    textInput(String(front.coverAlt ?? ''), { maxlength: 160 }),
    'For people who can’t see it, e.g. "Runners climbing a hill in the Pentlands".',
  );

  // Cover photo
  const coverImg = h('img', { alt: '' });
  const fileInput = h('input', { type: 'file', accept: 'image/*', class: 'visually-hidden', id: 'cover-file' });
  // One of Peter's photos from the library, or a new one from his device.
  const chooseCover = (async () => {
    const choice = await chooseFromLibrary();
    if (choice === 'upload') fileInput.click();
    else if (choice) takeCover(choice);
  }) as EventListener;
  const dropText = h(
    'div',
    { class: 'drop-text' },
    h(
      'b',
      {},
      'Drag a photo here, or ',
      h('button', { type: 'button', class: 'link', onclick: chooseCover }, 'choose a photo'),
    ),
    h('span', { class: 'hint' }, 'We resize it for you. Landscape photos work best.'),
  );
  const coverActions = h(
    'div',
    { class: 'cover-actions' },
    h('button', { type: 'button', class: 'btn btn--small', onclick: chooseCover }, 'Change photo'),
    h(
      'button',
      {
        type: 'button',
        class: 'btn btn--small',
        onclick: (() => {
          coverPath = '';
          coverData = '';
          showCover();
          changed();
        }) as EventListener,
      },
      'Remove photo',
    ),
  );
  const drop = h('div', { class: 'drop', id: 'cover-drop' }, coverImg, dropText, fileInput);
  const coverError = h('p', { class: 'field-error', id: 'cover-file-error', hidden: true });

  async function showCover() {
    const src = coverData || (coverPath ? await store!.imageUrl(mdToRepo(coverPath)) : '');
    coverImg.src = src || '';
    coverImg.hidden = !src;
    dropText.hidden = !!src;
    coverActions.hidden = !src;
    coverAlt.wrap.hidden = !src;
  }
  async function takeCover(file?: File) {
    if (!file) return;
    coverError.hidden = true;
    try {
      coverData = await resizePhoto(file);
      showCover();
      changed();
    } catch (err) {
      coverError.textContent = (err as Error).message;
      coverError.hidden = false;
    }
  }
  fileInput.addEventListener('change', () => takeCover(fileInput.files?.[0]));
  drop.addEventListener('dragover', (e) => {
    e.preventDefault();
    drop.classList.add('is-over');
  });
  drop.addEventListener('dragleave', () => drop.classList.remove('is-over'));
  drop.addEventListener('drop', (e) => {
    e.preventDefault();
    drop.classList.remove('is-over');
    takeCover(e.dataTransfer?.files[0]);
  });

  // Rich text editor (TipTap, see rich-editor.ts). Photos already in the post
  // get a URL the browser can show before the editor reads them.
  const startHtml = h('div');
  startHtml.innerHTML = markdownToHtml(existing?.body ?? '');
  await showBodyImages(startHtml);
  const bodyImageInput = h('input', { type: 'file', accept: 'image/*', class: 'visually-hidden', id: 'body-photo' });
  const rich = createRichEditor({
    html: startHtml.innerHTML,
    attrs: {
      role: 'textbox',
      'aria-multiline': 'true',
      'aria-labelledby': 'body-label',
      'aria-describedby': 'body-error',
      id: 'post-body',
    },
    onChange: () => changed(),
    onAddPhoto: () => bodyImageInput.click(),
    onError: (message) => toast(message, 'error'),
  });
  const editor = rich.dom;
  const bodyError = h('p', { class: 'field-error', id: 'body-error', hidden: true });

  bodyImageInput.addEventListener('change', async () => {
    const file = bodyImageInput.files?.[0];
    bodyImageInput.value = '';
    if (!file) return;
    try {
      const data = await resizePhoto(file);
      const alt = prompt('Describe the photo for people who can’t see it:') ?? '';
      const caption = prompt('Caption to show under the photo (optional):') ?? '';
      const name = `${slug || slugify(title.input.value) || 'post'}-${Date.now().toString(36)}.jpg`;
      rich.insertPhoto({
        src: data,
        alt: alt.trim(),
        title: caption.trim() || undefined,
        path: `../../assets/journal/${name}`,
      });
      changed();
    } catch (err) {
      toast((err as Error).message, 'error');
    }
  });
  const toolbar = rich.toolbar;

  // Autosave
  const autosaveNote = h('span', { class: 'autosave', 'aria-live': 'polite' });
  let autosaveTimer = 0;
  let autosavedAt = 0;
  const snapshot = (): Draft => ({
    title: title.input.value,
    topic: topic.input.value,
    excerpt: excerpt.input.value,
    html: rich.getHTML(),
    coverPath,
    coverData,
    coverAlt: coverAlt.input.value,
    date: postDate.input.value,
    savedAt: Date.now(),
  });
  function changed() {
    setDirty(true);
    clearTimeout(autosaveTimer);
    autosaveTimer = window.setTimeout(() => {
      const draft = snapshot();
      try {
        localStorage.setItem(autosaveKey, JSON.stringify(draft));
      } catch {
        // Photos can be too big for storage: keep the text at least.
        storage.set(
          autosaveKey,
          JSON.stringify({ ...draft, coverData: '', html: draft.html.replace(/src="data:[^"]*"/g, 'src=""') }),
        );
      }
      autosavedAt = draft.savedAt;
      updateAutosaveNote();
    }, 800);
  }
  const updateAutosaveNote = () => {
    if (autosavedAt) autosaveNote.textContent = `Draft saved automatically · ${relativeTime(new Date(autosavedAt))}`;
  };
  const noteTimer = window.setInterval(() => {
    if (!document.body.contains(autosaveNote)) clearInterval(noteTimer);
    else updateAutosaveNote();
  }, 30_000);
  [title, excerpt, topic, coverAlt, postDate].forEach((f) => f.input.addEventListener('input', changed));

  // Restore an autosaved draft
  let restoredNote: HTMLElement | null = null;
  const saved = storage.get(autosaveKey);
  if (saved) {
    try {
      const d = JSON.parse(saved) as Draft;
      title.input.value = d.title;
      topic.input.value = d.topic;
      excerpt.input.value = d.excerpt;
      rich.setHTML(d.html);
      coverPath = d.coverPath;
      coverData = d.coverData;
      coverAlt.input.value = d.coverAlt;
      if (d.date) postDate.input.value = d.date;
      autosavedAt = d.savedAt;
      updateAutosaveNote();
      setDirty(true);
      restoredNote = h(
        'div',
        { class: 'notice' },
        h('span', {}, `We brought back the changes you were making ${relativeTime(new Date(d.savedAt))}.`),
        h(
          'button',
          {
            type: 'button',
            class: 'btn btn--small',
            onclick: (() => {
              storage.remove(autosaveKey);
              setDirty(false);
              route();
            }) as EventListener,
          },
          isNew ? 'Start again' : 'Discard changes',
        ),
      );
    } catch {
      storage.remove(autosaveKey);
    }
  }
  await showCover();

  // Validation and saving
  const summary = errorSummary();
  function validate(publishing: boolean) {
    const errors = new Errors(summary);
    if (!title.input.value.trim()) errors.add(title, 'Give your post a title.');
    if (!postDate.input.value) errors.add(postDate, 'Choose the date for your post.');
    else if (postDate.input.value > today())
      errors.add(postDate, 'That date is in the future. Choose today or earlier.');
    if (publishing) {
      if (!excerpt.input.value.trim()) errors.add(excerpt, 'Write a short summary (one or two sentences).');
      if (!topic.input.value.trim()) errors.add(topic, 'Choose a topic, for example "Strength".');
      if (wordCount(htmlToMarkdown(rich.getHTML())) < 20) {
        errors.add(editor, 'Your post needs at least a couple of sentences before it can go live.');
      }
    }
    if ((coverPath || coverData) && !coverAlt.input.value.trim())
      errors.add(coverAlt, 'Describe the cover photo in a few words.');
    if (editor.querySelector('img:not([alt]), img[alt=""]')) {
      errors.add(
        editor,
        'One of the photos in your post has no description. Delete it and add it again with a description.',
      );
    }
    const ok = errors.show();
    const bodyProblem = errors.messageFor(editor);
    if (bodyProblem) {
      bodyError.textContent = bodyProblem;
      bodyError.hidden = false;
    }
    return ok;
  }

  async function submit(draft: boolean, button: HTMLButtonElement) {
    if (!validate(!draft)) return;
    const finalSlug = slug || uniqueSlug(slugify(title.input.value) || 'post', posts);
    const changes: Change[] = [];
    if (coverData) {
      const name = `${finalSlug}-cover-${Date.now().toString(36)}.jpg`;
      coverPath = `../../assets/journal/${name}`;
      changes.push({ path: `${PATHS.journalImages}/${name}`, image: coverData });
    }
    for (const img of editor.querySelectorAll<HTMLImageElement>('img[data-path]')) {
      if (img.src.startsWith('data:')) changes.push({ path: mdToRepo(img.dataset.path!), image: img.src });
    }
    const data: Front = {
      title: title.input.value.trim(),
      date: postDate.input.value || today(),
      topic: topic.input.value.trim(),
      excerpt: excerpt.input.value.trim(),
      cover: coverPath,
      coverAlt: coverPath ? coverAlt.input.value.trim() : '',
      draft: draft || '',
      // Saving a post makes it Peter's own, so an example post loses its label.
    };
    // A draft published for the first time gets today's date, unless a date was chosen for it.
    if (!draft && front.draft === true && postDate.input.value === storedDate) data.date = today();
    changes.push({
      path: `${PATHS.journal}/${finalSlug}.md`,
      text: stringifyDoc(data, htmlToMarkdown(rich.getHTML())),
    });

    const verb = draft ? 'Save draft' : isLive ? 'Update post' : 'Publish post';
    if (!(await save(changes, `${verb}: ${data.title}`, button))) return;
    coverData = '';
    storage.remove(autosaveKey);

    if (draft) {
      toast(
        isDemo()
          ? 'Draft saved in this demo. It isn’t on the website.'
          : 'Draft saved. It isn’t on the website until you publish it.',
      );
      location.hash = `#/post/${finalSlug}`;
      if (finalSlug === slug) route();
      return;
    }
    const answer = await dialog(
      isDemo() ? 'Published (demo)' : isLive ? 'Post updated' : 'Post published',
      isDemo()
        ? [
            h('p', {}, 'On the real website, the bar at the top would show when your post is live.'),
            h('p', { class: 'muted' }, 'This is the demo, so nothing has changed on the real website.'),
          ]
        : [h('p', {}, 'It will be on your website in a minute or two. The bar at the top shows when it’s live.')],
      [
        { label: 'Preview the post', value: 'preview' },
        isDemo()
          ? { label: 'Back to home', value: 'home', primary: true }
          : { label: 'View on website', value: 'site', primary: true },
      ],
    );
    if (answer === 'preview') {
      location.hash = `#/post/${finalSlug}`;
      await waitForRoute();
      document.getElementById('preview-btn')?.click();
    } else if (answer === 'site') {
      window.open(`${config.siteUrl}journal/${finalSlug}/`, '_blank', 'noopener');
      location.hash = '#/';
    } else location.hash = '#/';
  }

  const form = h(
    'form',
    { class: 'cols', novalidate: true, onsubmit: ((e: Event) => e.preventDefault()) as EventListener },
    h(
      'section',
      { class: 'box editor', 'aria-label': 'Post editor' },
      title.wrap,
      h('div', { class: 'field' }, h('span', { class: 'label' }, 'Cover photo'), drop, coverActions, coverError),
      coverAlt.wrap,
      h(
        'div',
        { class: 'field' },
        h('span', { class: 'label', id: 'body-label' }, 'Your post'),
        toolbar,
        editor,
        bodyImageInput,
        bodyError,
      ),
    ),
    h(
      'aside',
      { class: 'panel', 'aria-label': 'Publishing' },
      h(
        'div',
        { class: 'box' },
        h(
          'button',
          {
            type: 'button',
            class: 'btn btn--primary btn--big',
            onclick: ((e: Event) => submit(false, e.currentTarget as HTMLButtonElement)) as EventListener,
          },
          isLive ? 'Update post' : 'Publish now',
        ),
        h(
          'button',
          {
            type: 'button',
            class: 'btn btn--big',
            onclick: ((e: Event) => submit(true, e.currentTarget as HTMLButtonElement)) as EventListener,
          },
          isLive ? 'Move back to drafts' : 'Save as draft',
        ),
        h(
          'button',
          { type: 'button', class: 'btn btn--big', id: 'preview-btn', onclick: (() => previewPost()) as EventListener },
          'Preview',
        ),
        h(
          'p',
          { class: 'hint' },
          isLive
            ? 'This post is live on your website. Changes go live when you press Update.'
            : 'Publishing puts it on your website. You can edit it or move it back to drafts later.',
        ),
      ),
      h(
        'div',
        { class: 'box' },
        topic.wrap,
        postDate.wrap,
        excerpt.wrap,
        h(
          'datalist',
          { id: 'topics' },
          topics.map((t) => h('option', { value: t })),
        ),
      ),
      !isNew &&
        h(
          'div',
          { class: 'box' },
          h(
            'button',
            {
              type: 'button',
              class: 'btn btn--danger',
              onclick: (async (e: Event) => {
                const answer = await dialog(
                  'Delete this post?',
                  [h('p', {}, `"${front.title}" will be removed from your website. This can’t be undone here.`)],
                  [
                    { label: 'Keep it', value: '' },
                    { label: 'Delete post', value: 'delete', primary: true },
                  ],
                );
                if (answer !== 'delete') return;
                if (
                  await save(
                    [{ path: `${PATHS.journal}/${slug}.md`, remove: true }],
                    `Delete post: ${front.title}`,
                    e.currentTarget as HTMLButtonElement,
                  )
                ) {
                  storage.remove(autosaveKey);
                  toast(
                    isDemo()
                      ? 'Post deleted in this demo.'
                      : 'Post deleted. It will disappear from your website in a minute or two.',
                  );
                  location.hash = '#/posts';
                }
              }) as EventListener,
            },
            'Delete post',
          ),
        ),
    ),
  );

  function previewPost() {
    const dlg = h(
      'dialog',
      { class: 'preview', 'aria-label': 'Preview of your post' },
      h(
        'div',
        { class: 'preview-bar' },
        h('span', {}, 'Preview: this is how your post will look'),
        h(
          'button',
          { type: 'button', class: 'btn btn--small', onclick: (() => dlg.close()) as EventListener },
          'Close preview',
        ),
      ),
      h(
        'article',
        { class: 'site-post' },
        h('p', { class: 'mono' }, `${topic.input.value || 'Topic'} · ${formatDate(postDate.input.value || today())}`),
        h('h1', { class: 'display' }, title.input.value || 'Your title'),
        h('p', { class: 'excerpt' }, excerpt.input.value),
        coverImg.src && !coverImg.hidden && h('img', { class: 'cover', src: coverImg.src, alt: coverAlt.input.value }),
        (() => {
          const body = h('div', { class: 'body' });
          body.innerHTML = rich.getHTML();
          return body;
        })(),
      ),
    );
    dlg.addEventListener('close', () => dlg.remove());
    document.body.append(dlg);
    dlg.showModal();
  }

  trackDirty(form);
  setDirty(!!restoredNote);
  screen(
    isNew ? 'Write a new post' : `Edit: ${front.title}`,
    h(
      'div',
      { class: 'page-head page-head--row' },
      h('div', {}, backLink('#/posts', 'All posts'), h('h1', {}, isNew ? 'Write a new post' : 'Edit post')),
      autosaveNote,
    ),
    front.sample === true &&
      h(
        'div',
        { class: 'notice' },
        h(
          'span',
          {},
          'This is an example post Jack wrote for the preview. Change anything that isn’t right (the highlighted bits are for you to fill in), then save it: it becomes your own post and loses its “Example post” label.',
        ),
      ),
    restoredNote,
    summary,
    form,
  );
}

export function uniqueSlug(base: string, posts: PostInfo[]) {
  const taken = new Set(posts.map((p) => p.slug));
  let slug = base;
  for (let i = 2; taken.has(slug); i++) slug = `${base}-${i}`;
  return slug;
}

/** Swap repo image paths in the editor for URLs the browser can show. */
export async function showBodyImages(root: HTMLElement) {
  for (const img of root.querySelectorAll('img')) {
    const src = img.getAttribute('src') ?? '';
    if (src.startsWith('http') || src.startsWith('data:')) continue;
    img.dataset.path = src;
    img.src = (await store!.imageUrl(mdToRepo(src))) ?? '';
  }
}

export function waitForRoute() {
  return new Promise((r) => setTimeout(r, 400));
}
