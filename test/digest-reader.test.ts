import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { readNight } from '../src/digest/reader.js';

const temporaryDirs: string[] = [];

function makeRunsDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'rig-digest-'));
  temporaryDirs.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of temporaryDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe('readNight', () => {
  it('aggregates the sample night and counts its malformed line', () => {
    const runsDir = makeRunsDir();
    writeFileSync(
      join(runsDir, '2026-10-28.jsonl'),
      readFileSync('runs/2026-10-28.jsonl', 'utf8'),
    );
    const result = readNight(runsDir, '2026-10-28');

    expect(result).not.toBeNull();
    expect(result?.rows).toHaveLength(5);
    expect(result?.malformedLines).toBe(1);

    const refresh = result?.rows.find((row) => row.job === 'fixtures/refresh');
    expect(refresh).toEqual({
      job: 'fixtures/refresh',
      owner: 'rook',
      runs: 4,
      retries: 3,
      lastStatus: 'ok',
      lastError: 'upstream 503',
      firstAt: '2026-10-29T01:30:00+01:00',
      lastAt: '2026-10-29T01:37:00+01:00',
    });

    const digest = result?.rows.find((row) => row.job === 'digest/render');
    expect(digest?.owner).toBeNull();
    expect(digest?.runs).toBe(1);
  });

  it('keeps the first and last timestamps with their original offsets', () => {
    const runsDir = makeRunsDir();
    const input = [
      JSON.stringify({ at: '2026-01-02T01:00:00+01:00', job: 'task', status: 'retry', owner: null, error: 'temporary' }),
      JSON.stringify({ at: '2026-01-02T02:00:00+01:00', job: 'task', status: 'ok', owner: null }),
    ].join('\n');
    writeFileSync(join(runsDir, '2026-01-02.jsonl'), input);

    expect(readNight(runsDir, '2026-01-02')).toEqual({
      rows: [{
        job: 'task',
        owner: null,
        runs: 2,
        retries: 1,
        lastStatus: 'ok',
        lastError: 'temporary',
        firstAt: '2026-01-02T01:00:00+01:00',
        lastAt: '2026-01-02T02:00:00+01:00',
      }],
      malformedLines: 0,
    });
  });

  it('distinguishes a missing file from an empty file', () => {
    const runsDir = makeRunsDir();
    expect(readNight(runsDir, '2026-01-03')).toBeNull();

    writeFileSync(join(runsDir, '2026-01-03.jsonl'), '');
    expect(readNight(runsDir, '2026-01-03')).toEqual({ rows: [], malformedLines: 0 });
  });

  it('counts blank and invalid records without throwing', () => {
    const runsDir = makeRunsDir();
    writeFileSync(
      join(runsDir, '2026-01-04.jsonl'),
      '{"at":"not-a-time","job":"bad","status":"ok","owner":null}\n\nnot json\n',
    );

    expect(readNight(runsDir, '2026-01-04')).toEqual({ rows: [], malformedLines: 3 });
  });

  it('does not modify the supplied run-log fixture', () => {
    const fixturePath = 'runs/2026-10-28.jsonl';
    const before = readFileSync(fixturePath, 'utf8');
    readNight('runs', '2026-10-28');
    expect(readFileSync(fixturePath, 'utf8')).toBe(before);
  });

  it('rejects night values that cannot be a date filename', () => {
    expect(readNight('runs', '../2026-10-28')).toBeNull();
  });
});
