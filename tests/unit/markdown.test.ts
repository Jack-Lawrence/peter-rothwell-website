// @vitest-environment jsdom
import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { htmlToMarkdown, markdownToHtml, parseDoc, slugify, stringifyDoc, wordCount } from '../../src/admin/markdown';

/** What the post editor does: open the Markdown as HTML, then save it back. */
const roundTrip = (md: string) => htmlToMarkdown(markdownToHtml(md));

describe('Markdown → HTML → Markdown', () => {
  const cases: Record<string, string> = {
    headings: '## A heading\n\nSome text.\n\n### A smaller heading\n\nMore text.',
    'bold and italic': 'Some **bold** words, some *italic* ones and ***both***.',
    links: 'Read the [privacy policy](/privacy/) or email [me](mailto:rothwell.pt@gmail.com).',
    'bullet list': '- Squat\n- Romanian deadlift\n- Split squat',
    'ordered list': '1. Warm up\n2. Intervals\n3. Cool down',
    'ordered list starting later': '3. Third\n4. Fourth',
    'nested lists': '- Strength\n  - Squat\n  - Deadlift\n- Running\n  1. Easy\n  2. Tempo',
    'ordered list with nested bullets': '1. Warm up\n   - Drills\n   - Strides\n2. Intervals',
    'heading starting with a number': '## 1. The back squat\n\nText.',
    'photo with a caption': '![Peter on a hill](../../assets/journal/hill.jpg "Pentland Hills in May")',
    'photo without a caption': '![Peter on a hill](../../assets/journal/hill.jpg)',
    placeholder: 'Monthly plans are paid <mark>[Peter to confirm: by bank transfer]</mark>.',
    'placeholder on its own line': '<mark>[Peter to confirm: which race this is about]</mark>',
    'placeholder in a list': "- Insurer: <mark>[Peter to confirm insurer]</mark>\n- Notice: <mark>[24 hours']</mark>",
    'line break': 'First line\\\nsecond line',
    'bare email and web addresses': 'Email rothwell.pt@gmail.com or see https://www.rothwellsrunning.com/ for more.',
  };

  it.each(Object.entries(cases))('keeps %s unchanged', (_, md) => {
    expect(roundTrip(md)).toBe(md);
  });

  // Posts go through the editor. (Policies are edited as plain Markdown, so they never do.)
  const posts = readdirSync('src/content/journal').map((f) => `src/content/journal/${f}`);
  it.each(posts)('keeps %s unchanged', (file) => {
    const { body } = parseDoc(readFileSync(file, 'utf8'));
    expect(roundTrip(body)).toBe(body.trim());
  });

  it('turns placeholders into highlighted text', () => {
    expect(markdownToHtml('a <mark>[Peter to confirm]</mark> b')).toContain('<mark>[Peter to confirm]</mark>');
  });
});

describe('front matter', () => {
  const doc = `---
title: "Why runners should squat: three lifts"
date: 2026-09-21
topic: "Strength"
excerpt: "Lifting won't make you \\"heavy\\"."
cover: ../../assets/journal/squat.jpg
draft: true
order: 2
---

Body text.
`;

  it('reads the values these files use', () => {
    const { data, body } = parseDoc(doc);
    expect(data).toEqual({
      title: 'Why runners should squat: three lifts',
      date: '2026-09-21',
      topic: 'Strength',
      excerpt: 'Lifting won\'t make you "heavy".',
      cover: '../../assets/journal/squat.jpg',
      draft: true,
      order: 2,
    });
    expect(body).toBe('Body text.\n');
  });

  it('writes a file the admin saved back exactly as it was', () => {
    const { data, body } = parseDoc(doc);
    expect(stringifyDoc(data, body)).toBe(doc);
  });

  it('leaves out empty values', () => {
    expect(stringifyDoc({ title: 'A', draft: '', sample: '' }, 'x')).toBe('---\ntitle: "A"\n---\n\nx\n');
  });
});

describe('helpers', () => {
  it('counts words, ignoring Markdown', () => {
    expect(wordCount('## Two words\n\n![alt text here](x.jpg) and **one** more')).toBe(5);
  });

  it('makes slugs from titles', () => {
    expect(slugify('Why runners should squat!')).toBe('why-runners-should-squat');
    expect(slugify('Café & crêpes')).toBe('cafe-and-crepes');
    expect(slugify('x'.repeat(80))).toHaveLength(60);
  });
});
