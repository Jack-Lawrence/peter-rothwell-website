import { describe, expect, it } from 'vitest';
import { jsonForScript } from '../../src/lib/json-script';

describe('jsonForScript', () => {
  const data = { answer: 'Easy </script><script>alert(1)</script> & <b>bold</b>', list: ['<!--', 'a < b'] };

  it('never contains "<", so content can’t close the script tag', () => {
    expect(jsonForScript(data)).not.toContain('<');
    expect(jsonForScript(data)).toContain('\\u003c/script>');
  });

  it('still parses back to the same data', () => {
    expect(JSON.parse(jsonForScript(data))).toEqual(data);
  });
});
