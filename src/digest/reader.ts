import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { DigestRow, ReadNight, RunStatus } from './types.js';

type RunRecord = {
  at: string;
  job: string;
  status: RunStatus;
  owner: string | null;
  error?: string;
};

const statuses = new Set<RunStatus>(['ok', 'retry', 'fail']);

function isRunRecord(value: unknown): value is RunRecord {
  if (value === null || typeof value !== 'object') return false;

  const record = value as Record<string, unknown>;
  return (
    typeof record.at === 'string' &&
    record.at.length > 0 &&
    !Number.isNaN(Date.parse(record.at)) &&
    typeof record.job === 'string' &&
    record.job.length > 0 &&
    typeof record.status === 'string' &&
    statuses.has(record.status as RunStatus) &&
    (record.owner === null || typeof record.owner === 'string') &&
    (record.error === undefined || typeof record.error === 'string')
  );
}

function parseLine(line: string): RunRecord | null {
  try {
    const value: unknown = JSON.parse(line);
    return isRunRecord(value) ? value : null;
  } catch {
    return null;
  }
}

export const readNight: ReadNight = (runsDir, night) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(night)) return null;

  let contents: string;
  try {
    contents = readFileSync(join(runsDir, `${night}.jsonl`), 'utf8');
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return null;
    throw error;
  }

  const rows = new Map<string, DigestRow>();
  let malformedLines = 0;
  const statusCounts: Record<RunStatus, number> = { ok: 0, retry: 0, fail: 0 };

  const lines = contents === '' ? [] : contents.split(/\r?\n/);
  if (lines.at(-1) === '') lines.pop();

  for (const line of lines) {

    const record = parseLine(line);
    if (!record) {
      malformedLines += 1;
      continue;
    }
    statusCounts[record.status] += 1;

    const row = rows.get(record.job);
    if (row) {
      row.owner = record.owner;
      row.runs += 1;
      if (record.status === 'retry') row.retries += 1;
      row.lastStatus = record.status;
      if (record.error !== undefined) row.lastError = record.error;
      row.lastAt = record.at;
      continue;
    }

    rows.set(record.job, {
      job: record.job,
      owner: record.owner,
      runs: 1,
      retries: record.status === 'retry' ? 1 : 0,
      lastStatus: record.status,
      lastError: record.error ?? null,
      firstAt: record.at,
      lastAt: record.at,
    });
  }

  return { rows: [...rows.values()], malformedLines, statusCounts };
};
