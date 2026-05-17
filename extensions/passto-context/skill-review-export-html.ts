import type { SkillReviewExportModel } from './skill-review-export.ts';

export function renderSkillReviewHtml(model: SkillReviewExportModel): string {
  const embeddedModel = escapeScriptJson(JSON.stringify(model));
  const selectedStatus = model.selected.status;
  const selectedBundle = model.selected.bundle;
  const selectedAggregate = model.selected.aggregate;
  const reviewedReceipt = model.selected.reviewedReceipt;

  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Skill Review Export</title>
  <style>
    :root {
      color-scheme: light dark;
      --bg: #0b1020;
      --panel: #11172a;
      --muted: #93a4c3;
      --text: #e8eefc;
      --line: #24304d;
      --accent: #6ea8fe;
      --accent-soft: rgba(110, 168, 254, 0.15);
      --warn-soft: rgba(255, 193, 7, 0.14);
      --success-soft: rgba(75, 192, 120, 0.15);
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      background: var(--bg);
      color: var(--text);
      line-height: 1.5;
    }
    .page {
      max-width: 1200px;
      margin: 0 auto;
      padding: 24px;
    }
    .panel {
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: 16px;
      padding: 16px;
      margin-bottom: 16px;
    }
    h1, h2, h3, p { margin-top: 0; }
    .meta, .summary-grid {
      display: grid;
      gap: 12px;
    }
    .meta { grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); }
    .summary-grid { grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); }
    .pill {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 999px;
      border: 1px solid var(--line);
      color: var(--muted);
      margin-right: 8px;
      margin-bottom: 8px;
      font-size: 12px;
    }
    .accent { background: var(--accent-soft); color: var(--text); }
    .success { background: var(--success-soft); color: var(--text); }
    .warning { background: var(--warn-soft); color: var(--text); }
    pre {
      background: rgba(255,255,255,0.03);
      border: 1px solid var(--line);
      border-radius: 12px;
      padding: 12px;
      overflow: auto;
      white-space: pre-wrap;
      word-break: break-word;
    }
    code { word-break: break-all; }
    ul { padding-left: 20px; }
  </style>
</head>
<body>
  <div class="page">
    <section class="panel">
      <h1>Skill Review Export</h1>
      <p>Static review bundle exported from current skill-explore runtime evidence.</p>
      <div class="meta">
        <div><strong>Export Session</strong><br /><code>${escapeHtml(model.exportSessionId)}</code></div>
        <div><strong>Exported At</strong><br /><code>${escapeHtml(model.exportedAt)}</code></div>
        <div><strong>Artifact Root</strong><br /><code>${escapeHtml(model.artifactRoot)}</code></div>
        <div><strong>Requested Target</strong><br /><code>${escapeHtml(model.requestedTargetSkill ?? 'none')}</code></div>
      </div>
    </section>

    <section class="panel">
      <h2>Export Summary</h2>
      <div class="summary-grid">
        <div><strong>${model.catalog.readyCount}</strong><br />Ready bundles</div>
        <div><strong>${model.catalog.reviewedCount}</strong><br />Reviewed bundles</div>
        <div><strong>${model.catalog.aggregateCount}</strong><br />Aggregate summaries</div>
        <div><strong>${escapeHtml(selectedStatus)}</strong><br />Selected status</div>
      </div>
      ${model.latestSession ? `<p><span class="pill success">latest session</span> <code>${escapeHtml(model.latestSession.sessionKey)}</code> · reads=${model.latestSession.totalSkillReads}</p>` : '<p><span class="pill warning">no latest session snapshot</span></p>'}
      ${model.selected.selection ? `<p><span class="pill accent">selection</span> strategy=<code>${escapeHtml(model.selected.selection.strategy)}</code> · orderedBy=<code>${escapeHtml(model.selected.selection.orderedBy.join(' -> '))}</code></p>` : ''}
      ${reviewedReceipt ? `<p><span class="pill success">reviewed receipt</span> status=<code>${escapeHtml(reviewedReceipt.result.status)}</code> · consumedAt=<code>${escapeHtml(reviewedReceipt.consumedAt)}</code></p>` : ''}
    </section>

    <section class="panel">
      <h2>Notes</h2>
      <ul>
        ${model.notes.map((note) => `<li>${escapeHtml(note)}</li>`).join('')}
      </ul>
    </section>

    <section class="panel">
      <h2>Selected Bundle</h2>
      ${selectedBundle ? `<pre>${escapeHtml(JSON.stringify(selectedBundle, null, 2))}</pre>` : '<p><span class="pill warning">none</span></p>'}
    </section>

    <section class="panel">
      <h2>Selected Aggregate</h2>
      ${selectedAggregate ? `<pre>${escapeHtml(JSON.stringify(selectedAggregate, null, 2))}</pre>` : '<p><span class="pill warning">none</span></p>'}
    </section>

    <section class="panel">
      <h2>Top Aggregate Candidates</h2>
      <pre>${escapeHtml(JSON.stringify(model.aggregateCandidates, null, 2))}</pre>
    </section>
  </div>
  <script>
    const __SKILL_REVIEW_MODEL__ = JSON.parse(${JSON.stringify(embeddedModel)});
    console.log('Skill Review Export loaded', {
      exportSessionId: __SKILL_REVIEW_MODEL__.exportSessionId,
      selectedStatus: __SKILL_REVIEW_MODEL__.selected.status,
      aggregateCandidates: __SKILL_REVIEW_MODEL__.aggregateCandidates.length,
    });
  </script>
</body>
</html>`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeScriptJson(value: string): string {
  return value
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}
