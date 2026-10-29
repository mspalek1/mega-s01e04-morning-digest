import type { NightDigest } from '../digest/types.js';

export function DigestPage({ night, digest }: { night: string; digest: NightDigest }) {
  const rows = [...digest.rows].sort((a, b) => a.job.localeCompare(b.job));

  return (
    <>
      <h1>morning digest</h1>
      <h2>{night}</h2>
      {rows.length === 0 ? (
        <p class="mute">nothing ran</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>job</th>
              <th>owner</th>
              <th>runs</th>
              <th>retries</th>
              <th>last status</th>
              <th>last error</th>
              <th>first time</th>
              <th>last time</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr>
                <td>{row.job}</td>
                <td>{row.owner ?? '—'}</td>
                <td>{row.runs}</td>
                <td>
                  <span class={row.retries >= 3 ? 'warn' : undefined}>{row.retries}</span>
                </td>
                <td>
                  <span class={row.lastStatus === 'fail' ? 'warn' : undefined}>
                    {row.lastStatus}
                  </span>
                </td>
                <td>{row.lastError ?? '—'}</td>
                <td>{row.firstAt}</td>
                <td>{row.lastAt}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {digest.malformedLines > 0 && (
        <p class="warn">
          {digest.malformedLines} malformed {digest.malformedLines === 1 ? 'line' : 'lines'} ignored
        </p>
      )}
    </>
  );
}
