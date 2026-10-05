// Sätteri (Astro's Markdown processor) plugin: turns a Markdown image with a
// title into a captioned figure:
//   ![Runners on Arthur's Seat](photo.jpg "Tuesday hill session")
// becomes <figure><img …><figcaption>Tuesday hill session</figcaption></figure>.
// Only images that sit alone in their own paragraph are changed.
import { defineHastPlugin } from 'satteri';

export default defineHastPlugin({
  name: 'figures',
  element: {
    filter: ['p'],
    visit(node, ctx) {
      const content = node.children.filter((c) => !(c.type === 'text' && !c.value.trim()));
      const img = content[0];
      if (content.length !== 1 || img.type !== 'element' || img.tagName !== 'img') return;
      const title = img.properties?.title;
      if (!title) return;
      const { title: _, ...properties } = img.properties;
      ctx.replaceNode(node, {
        type: 'element',
        tagName: 'figure',
        properties: {},
        children: [
          { ...img, properties },
          {
            type: 'element',
            tagName: 'figcaption',
            properties: {},
            children: [{ type: 'text', value: String(title) }],
          },
        ],
      });
    },
  },
});
