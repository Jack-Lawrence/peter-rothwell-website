// The blog post editor: TipTap (MIT, runs entirely in the browser, no account
// or API key), with a simple toolbar of its own. It edits HTML; the post editor
// turns that into Markdown when saving (see markdown.ts).

import { Editor, Mark } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import { h } from './ui';

// Photos remember where they live in the repo (data-path), so the Markdown
// keeps the real path while the editor shows a preview URL. The title becomes
// the caption under the photo.
const Photo = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      path: {
        default: null,
        parseHTML: (el) => el.getAttribute('data-path'),
        renderHTML: (attrs) => (attrs.path ? { 'data-path': attrs.path } : {}),
      },
    };
  },
});

// "[Peter to confirm: …]" placeholders are wrapped in <mark>. The editor keeps
// them highlighted, so they survive a save until Peter replaces the text.
const Placeholder = Mark.create({
  name: 'placeholder',
  parseHTML: () => [{ tag: 'mark' }],
  renderHTML: ({ HTMLAttributes }) => ['mark', HTMLAttributes, 0],
});

export interface PhotoInsert {
  src: string;
  alt: string;
  title?: string;
  path: string;
}

export interface RichEditor {
  /** The editable area (for errors, focus and checking photos). */
  dom: HTMLElement;
  toolbar: HTMLElement;
  getHTML(): string;
  setHTML(html: string): void;
  insertPhoto(photo: PhotoInsert): void;
  focus(): void;
}

export function createRichEditor(options: {
  html: string;
  attrs: Record<string, string>;
  onChange: () => void;
  onAddPhoto: () => void;
  onError: (message: string) => void;
}): RichEditor {
  const mount = h('div');
  const editor = new Editor({
    element: mount,
    content: options.html,
    extensions: [
      StarterKit.configure({
        // Posts use h2 and h3 (the page title is the h1), and only formatting
        // that Markdown can keep.
        heading: { levels: [2, 3] },
        code: false,
        codeBlock: false,
        strike: false,
        underline: false,
        link: { openOnClick: false, autolink: true, protocols: ['mailto'] },
      }),
      Photo.configure({ inline: false, allowBase64: true }),
      Placeholder,
    ],
    editorProps: {
      attributes: { class: 'editor-body', ...options.attrs },
      // Paste as plain text, so formatting from Word or websites doesn't come along.
      handlePaste(view, event) {
        const text = event.clipboardData?.getData('text/plain');
        if (!text) return false;
        view.pasteText(text);
        return true;
      },
    },
    onUpdate: () => options.onChange(),
  });

  // Toolbar. Buttons don't take focus away from the text, and show when their
  // formatting is on (aria-pressed).
  type Tool = { label: string; run: () => void; active?: () => boolean; attrs?: Record<string, string> };
  const tools: Tool[] = [
    {
      label: 'Heading',
      run: () => editor.chain().focus().toggleHeading({ level: 2 }).run(),
      active: () => editor.isActive('heading', { level: 2 }),
    },
    {
      label: 'Small heading',
      run: () => editor.chain().focus().toggleHeading({ level: 3 }).run(),
      active: () => editor.isActive('heading', { level: 3 }),
    },
    {
      label: 'B',
      run: () => editor.chain().focus().toggleBold().run(),
      active: () => editor.isActive('bold'),
      attrs: { 'aria-label': 'Bold', class: 'tool tool--b' },
    },
    {
      label: 'I',
      run: () => editor.chain().focus().toggleItalic().run(),
      active: () => editor.isActive('italic'),
      attrs: { 'aria-label': 'Italic', class: 'tool tool--i' },
    },
    {
      label: '• List',
      run: () => editor.chain().focus().toggleBulletList().run(),
      active: () => editor.isActive('bulletList'),
    },
    {
      label: '1. List',
      run: () => editor.chain().focus().toggleOrderedList().run(),
      active: () => editor.isActive('orderedList'),
    },
    {
      label: 'Quote',
      run: () => editor.chain().focus().toggleBlockquote().run(),
      active: () => editor.isActive('blockquote'),
    },
    {
      label: 'Link',
      run: () => {
        const current = editor.getAttributes('link').href as string | undefined;
        const url = prompt(
          'Paste the web address for the link (starting https://). Leave empty to remove it.',
          current ?? '',
        );
        if (url === null) return;
        if (!url.trim()) {
          editor.chain().focus().extendMarkRange('link').unsetLink().run();
          return;
        }
        if (!/^(https?:\/\/|mailto:|\/|#)/.test(url.trim())) {
          options.onError('Links need to start with https://');
          return;
        }
        editor.chain().focus().extendMarkRange('link').setLink({ href: url.trim() }).run();
      },
      active: () => editor.isActive('link'),
    },
    { label: 'Add photo', run: () => options.onAddPhoto() },
    {
      label: 'Undo',
      run: () => editor.chain().focus().undo().run(),
      attrs: { 'aria-label': 'Undo', class: 'tool tool--quiet' },
    },
    {
      label: 'Redo',
      run: () => editor.chain().focus().redo().run(),
      attrs: { 'aria-label': 'Redo', class: 'tool tool--quiet' },
    },
  ];
  const buttons = tools.map((t) =>
    h(
      'button',
      {
        type: 'button',
        class: 'tool',
        onmousedown: ((e: Event) => e.preventDefault()) as EventListener,
        onclick: (() => t.run()) as EventListener,
        ...t.attrs,
      },
      t.label,
    ),
  );
  const toolbar = h('div', { class: 'toolbar', role: 'toolbar', 'aria-label': 'Formatting' }, buttons);
  const showActive = () =>
    tools.forEach((t, i) => {
      if (t.active) buttons[i].setAttribute('aria-pressed', String(t.active()));
    });
  editor.on('transaction', showActive);
  showActive();

  return {
    dom: editor.view.dom as HTMLElement,
    toolbar,
    getHTML: () => editor.getHTML(),
    setHTML: (html) => editor.commands.setContent(html),
    insertPhoto: (photo) => editor.chain().focus().setImage(photo).run(),
    focus: () => editor.commands.focus(),
  };
}
