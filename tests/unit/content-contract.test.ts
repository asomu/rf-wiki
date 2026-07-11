import { spawnSync } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const checker = path.resolve('scripts/check-content.mjs');

async function runContentCheck(source: string) {
  const directory = await mkdtemp(path.join(tmpdir(), 'rf-wiki-content-'));
  try {
    await writeFile(path.join(directory, 'fixture.mdx'), source, 'utf8');
    return spawnSync(process.execPath, [checker], {
      cwd: process.cwd(),
      encoding: 'utf8',
      env: {
        ...process.env,
        RF_WIKI_CONTENT_ROOT: directory,
        RF_WIKI_MINIMUM_READY: '0',
      },
    });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

const readyLesson = (body: string) => `---
status: "ready"
labId: "frequency"
references:
  - title: "Fixture"
---

import LessonLab from '../../components/astro/LessonLab.astro';

<LessonLayer level="intuition" title="intuition">
<LessonLab labId="frequency" />
</LessonLayer>
<LessonLayer level="bench" title="bench"></LessonLayer>
<LessonLayer level="theory" title="theory"></LessonLayer>
${body}
`;

describe('content publication contract', () => {
  it('allows TODOs in a hidden draft scaffold', async () => {
    const result = await runContentCheck(`---\nstatus: "draft"\n---\nTODO: scaffold`);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('0 ready lessons, 1 hidden drafts');
  });

  it('rejects TODOs after a lesson is marked ready', async () => {
    const result = await runContentCheck(readyLesson('TODO: not publishable'));
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('is ready but still contains TODO content');
  });

  it('requires an explicit publication status', async () => {
    const result = await runContentCheck('---\nreferences: []\n---\nDraft without status');
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('must declare status');
  });
});
