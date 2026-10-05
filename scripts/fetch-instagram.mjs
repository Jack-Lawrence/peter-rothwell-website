// Fetches the latest Instagram posts and saves them for the home page feed.
//
//   IG_ACCESS_TOKEN=... node scripts/fetch-instagram.mjs
//
// Writes src/data/instagram.json and downloads each image into
// src/assets/instagram/ (gitignored), because Instagram's image URLs expire
// after a few days. The build then resizes them like any other photo.
// Without a token it does nothing, so the site still builds with placeholders.
//
// The token is a long-lived token from the Instagram API with Instagram Login
// (Business or Creator account). It lasts 60 days; `--refresh` swaps it for a
// fresh one and prints it to stdout so a workflow can store it.

import { mkdir, readdir, rm, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dataFile = path.join(root, 'src/data/instagram.json');
const imageDir = path.join(root, 'src/assets/instagram');
const API = 'https://graph.instagram.com';
const LIMIT = 6;

const token = process.env.IG_ACCESS_TOKEN;

if (!token) {
  console.log('IG_ACCESS_TOKEN not set; keeping the existing Instagram data.');
  process.exit(0);
}

async function getJson(url) {
  const res = await fetch(url);
  const body = await res.json();
  if (!res.ok || body.error) {
    throw new Error(`Instagram API error: ${body.error?.message ?? res.status}`);
  }
  return body;
}

if (process.argv.includes('--refresh')) {
  const body = await getJson(`${API}/refresh_access_token?grant_type=ig_refresh_token&access_token=${token}`);
  process.stdout.write(body.access_token);
  process.exit(0);
}

const fields = 'id,caption,media_type,media_url,thumbnail_url,permalink,timestamp';
const { data } = await getJson(`${API}/me/media?fields=${fields}&limit=${LIMIT}&access_token=${token}`);

await mkdir(imageDir, { recursive: true });

const posts = [];
for (const item of data.slice(0, LIMIT)) {
  const source = item.media_type === 'VIDEO' ? item.thumbnail_url : item.media_url;
  if (!source) continue;

  const res = await fetch(source);
  if (!res.ok) {
    console.warn(`Skipping ${item.id}: image download failed (${res.status}).`);
    continue;
  }
  const file = `${item.id}.jpg`;
  await writeFile(path.join(imageDir, file), Buffer.from(await res.arrayBuffer()));

  posts.push({
    id: item.id,
    permalink: item.permalink,
    caption: item.caption ?? '',
    timestamp: item.timestamp,
    image: file,
  });
}

// Remove images for posts that are no longer in the feed.
const keep = new Set(posts.map((p) => `${p.id}.jpg`));
for (const file of await readdir(imageDir)) {
  if (!keep.has(file)) await rm(path.join(imageDir, file));
}

await writeFile(dataFile, JSON.stringify({ updated: new Date().toISOString(), posts }, null, 2) + '\n');
console.log(`Saved ${posts.length} Instagram posts.`);
