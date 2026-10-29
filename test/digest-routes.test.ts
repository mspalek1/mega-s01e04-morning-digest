import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';

const baseConfig = {
  adapter: 'shim',
  installed: '2026-10-29T14:06:00+01:00',
  beatEverySeconds: 60,
};

let runsDir: string;

function writeNight(night: string, content: string): void {
  writeFileSync(join(runsDir, `${night}.jsonl`), content);
}

function app() {
  return createApp({ ...baseConfig, runsDir });
}

beforeEach(() => {
  runsDir = mkdtempSync(join(tmpdir(), 'rig-digest-routes-'));
});

afterEach(() => {
  rmSync(runsDir, { recursive: true, force: true });
});

describe('digest routes', () => {
  it('returns the same ordered rows from HTML and JSON routes', async () => {
    writeNight(
      '2026-01-01',
      [
        JSON.stringify({ at: '2026-01-01T01:00:00+01:00', job: 'zeta', status: 'retry', owner: 'ops', error: 'temporary' }),
        JSON.stringify({ at: '2026-01-01T01:05:00+01:00', job: 'alpha', status: 'ok', owner: null }),
        JSON.stringify({ at: '2026-01-01T01:10:00+01:00', job: 'zeta', status: 'retry', owner: 'ops', error: 'still down' }),
        JSON.stringify({ at: '2026-01-01T01:15:00+01:00', job: 'zeta', status: 'retry', owner: 'ops', error: 'last failure' }),
        JSON.stringify({ at: '2026-01-01T01:20:00+01:00', job: 'beta', status: 'fail', owner: 'ops', error: 'quota' }),
      ].join('\n'),
    );

    const htmlResponse = await app().request('/digest/2026-01-01');
    const html = await htmlResponse.text();
    const jsonResponse = await app().request('/api/digest/2026-01-01');
    const digest = await jsonResponse.json();

    expect(htmlResponse.status).toBe(200);
    expect(html).toContain('alpha');
    expect(html).toContain('beta');
    expect(html).toContain('zeta');
    expect(html).toContain('—');
    expect(html.indexOf('alpha')).toBeLessThan(html.indexOf('zeta'));
    expect(html.indexOf('beta')).toBeLessThan(html.indexOf('zeta'));
    expect(html).toContain('<span class="warn">fail</span>');
    expect(html).toContain('<span class="warn">3</span>');

    expect(jsonResponse.status).toBe(200);
    expect(digest).toEqual({
      rows: [
        {
          job: 'alpha',
          owner: null,
          runs: 1,
          retries: 0,
          lastStatus: 'ok',
          lastError: null,
          firstAt: '2026-01-01T01:05:00+01:00',
          lastAt: '2026-01-01T01:05:00+01:00',
        },
        {
          job: 'beta',
          owner: 'ops',
          runs: 1,
          retries: 0,
          lastStatus: 'fail',
          lastError: 'quota',
          firstAt: '2026-01-01T01:20:00+01:00',
          lastAt: '2026-01-01T01:20:00+01:00',
        },
        {
          job: 'zeta',
          owner: 'ops',
          runs: 3,
          retries: 3,
          lastStatus: 'retry',
          lastError: 'last failure',
          firstAt: '2026-01-01T01:00:00+01:00',
          lastAt: '2026-01-01T01:15:00+01:00',
        },
      ],
      malformedLines: 0,
      statusCounts: { ok: 1, retry: 3, fail: 1 },
    });
  });

  it('returns 404 from both routes when the night file is missing', async () => {
    const [htmlResponse, jsonResponse] = await Promise.all([
      app().request('/digest/2026-01-02'),
      app().request('/api/digest/2026-01-02'),
    ]);

    expect(htmlResponse.status).toBe(404);
    expect(jsonResponse.status).toBe(404);
  });

  it('renders an empty night and returns no rows as JSON', async () => {
    writeNight('2026-01-03', '');

    const htmlResponse = await app().request('/digest/2026-01-03');
    const html = await htmlResponse.text();
    const jsonResponse = await app().request('/api/digest/2026-01-03');

    expect(htmlResponse.status).toBe(200);
    expect(html).toContain('nothing ran');
    expect(jsonResponse.status).toBe(200);
    expect(await jsonResponse.json()).toEqual({
      rows: [],
      malformedLines: 0,
      statusCounts: { ok: 0, retry: 0, fail: 0 },
    });
  });

  it('counts malformed lines and still renders valid rows', async () => {
    writeNight(
      '2026-01-04',
      [
        JSON.stringify({ at: '2026-01-04T01:00:00+01:00', job: 'valid', status: 'ok', owner: 'ops' }),
        '{not json',
      ].join('\n'),
    );

    const htmlResponse = await app().request('/digest/2026-01-04');
    const html = await htmlResponse.text();
    const jsonResponse = await app().request('/api/digest/2026-01-04');

    expect(htmlResponse.status).toBe(200);
    expect(html).toContain('valid');
    expect(jsonResponse.status).toBe(200);
    expect(await jsonResponse.json()).toMatchObject({
      rows: [{ job: 'valid' }],
      malformedLines: 1,
      statusCounts: { ok: 1, retry: 0, fail: 0 },
    });
  });
});
