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

function writeNight(night: string, records: unknown[]): void {
  writeFileSync(
    join(runsDir, `${night}.jsonl`),
    records.map((record) => JSON.stringify(record)).join('\n'),
  );
}

beforeEach(() => {
  runsDir = mkdtempSync(join(tmpdir(), 'rig-status-digest-'));
  writeNight('2026-01-01', [
    { at: '2026-01-01T01:00:00+01:00', job: 'sync', status: 'retry', owner: 'ops' },
    { at: '2026-01-01T01:05:00+01:00', job: 'sync', status: 'ok', owner: 'ops' },
    { at: '2026-01-01T02:00:00+01:00', job: 'backup', status: 'fail', owner: 'ops' },
  ]);
  writeNight('2026-01-02', [
    { at: '2026-01-02T01:00:00+01:00', job: 'sync', status: 'ok', owner: 'ops' },
  ]);
});

afterEach(() => rmSync(runsDir, { recursive: true, force: true }));

describe('status board digest links', () => {
  it('links each night and shows per-attempt status counts', async () => {
    const app = createApp({ ...baseConfig, runsDir });
    const response = await app.request('/');
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(html).toContain('href="/digest/2026-01-02"');
    expect(html).toContain('href="/digest/2026-01-01"');
    expect(html).toContain('ok 1 / retry 1 / fail 1');
    expect(html).toContain('ok 1 / retry 0 / fail 0');
    expect((await app.request('/digest/2026-01-01')).status).toBe(200);
    expect((await app.request('/digest/2026-01-02')).status).toBe(200);
  });

  it('keeps the empty state when the runs directory has no nights', async () => {
    const emptyDir = mkdtempSync(join(tmpdir(), 'rig-status-empty-'));
    try {
      const response = await createApp({ ...baseConfig, runsDir: emptyDir }).request('/');
      expect(await response.text()).toContain('nothing in runs/');
    } finally {
      rmSync(emptyDir, { recursive: true, force: true });
    }
  });
});
