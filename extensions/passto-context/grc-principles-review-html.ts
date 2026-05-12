import type { PrinciplesReviewModel } from './grc-principles-review.ts';

export function renderPrinciplesReviewHtml(model: PrinciplesReviewModel): string {
  const embeddedModel = escapeScriptJson(JSON.stringify(model));
  const rows = model.items.map(renderItemCard).join('\n');

  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Principles Review</title>
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
      --danger-soft: rgba(255, 99, 132, 0.15);
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
    .meta, .summary-grid, .filters, .batch-actions, .action-group {
      display: grid;
      gap: 12px;
    }
    .meta { grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); }
    .summary-grid { grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); }
    .filters { grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); align-items: end; }
    .item-list { display: grid; gap: 16px; }
    .item-card {
      border: 1px solid var(--line);
      border-radius: 14px;
      padding: 16px;
      background: rgba(255, 255, 255, 0.02);
    }
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
    .recommended { background: var(--accent-soft); color: var(--text); }
    .danger { background: var(--danger-soft); }
    .success { background: var(--success-soft); }
    label { display: block; font-size: 14px; color: var(--muted); }
    input, select, textarea, button {
      width: 100%;
      margin-top: 6px;
      border-radius: 10px;
      border: 1px solid var(--line);
      background: rgba(255,255,255,0.04);
      color: var(--text);
      padding: 10px 12px;
      font: inherit;
    }
    textarea { min-height: 84px; resize: vertical; }
    button {
      cursor: pointer;
      background: var(--accent-soft);
    }
    .toolbar {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      align-items: center;
      justify-content: space-between;
    }
    .toolbar-right {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      align-items: center;
    }
    .action-group {
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      margin-top: 12px;
    }
    .inline-radio {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 10px 12px;
      border: 1px solid var(--line);
      border-radius: 10px;
    }
    .inline-radio input { width: auto; margin: 0; }
    code { word-break: break-all; }
  </style>
</head>
<body>
  <div class="page">
    <section class="panel">
      <div class="toolbar">
        <div>
          <h1>Principles Review</h1>
          <p>Static review bundle for structured principles triage.</p>
        </div>
        <div class="toolbar-right">
          <span data-role="decision-count" class="pill success">0 decisions selected</span>
          <button type="button" id="export-decision">导出 decision JSON</button>
        </div>
      </div>
      <div class="meta">
        <div><strong>Review Session</strong><br /><code>${escapeHtml(model.reviewSessionId)}</code></div>
        <div><strong>Generated At</strong><br /><code>${escapeHtml(model.generatedAt)}</code></div>
        <div><strong>Registry Path</strong><br /><code>${escapeHtml(model.registryPath)}</code></div>
        <div><strong>Snapshot Hash</strong><br /><code>${escapeHtml(model.registrySnapshotHash)}</code></div>
      </div>
    </section>

    <section class="panel">
      <h2>Summary</h2>
      <div class="summary-grid">
        <div><strong>${model.summary.total}</strong><br />Total</div>
        <div><strong>${model.summary.injectable}</strong><br />Injectable</div>
        <div><strong>${model.summary.active}</strong><br />Active</div>
        <div><strong>${model.summary.stale}</strong><br />Stale</div>
        <div><strong>${model.summary.archived}</strong><br />Archived</div>
        <div><strong>${model.summary.disabled}</strong><br />Disabled</div>
        <div><strong>${model.summary.review.staleCandidates}</strong><br />Stale candidates</div>
        <div><strong>${model.summary.review.pseudoCandidates}</strong><br />Pseudo candidates</div>
        <div><strong>${model.summary.review.oversizedCandidates}</strong><br />Oversized candidates</div>
      </div>
    </section>

    <section class="panel">
      <h2>Filters</h2>
      <div class="filters">
        <label>
          Lifecycle
          <select name="lifecycle-filter" id="lifecycle-filter">
            <option value="all">All</option>
            ${model.filters.supportedLifecycle.map((item) => `<option value="${escapeHtml(item)}">${escapeHtml(item)}</option>`).join('')}
          </select>
        </label>
        <label>
          Search
          <input name="query" id="query" type="search" placeholder="Search content / tags" />
        </label>
        <label>
          Review reason
          <select name="reason-filter" id="reason-filter">
            <option value="all">All</option>
            <option value="stale-candidate">stale-candidate</option>
            <option value="pseudo-candidate">pseudo-candidate</option>
            <option value="oversized-candidate">oversized-candidate</option>
          </select>
        </label>
      </div>
    </section>

    <section class="panel">
      <h2>Batch Actions</h2>
      <div class="batch-actions filters">
        <button type="button" data-batch-action="mark-stale">全部标记为 mark-stale</button>
        <button type="button" data-batch-action="archive">全部标记为 archive</button>
        <button type="button" data-batch-action="clear">清空当前决策</button>
      </div>
    </section>

    <section class="panel">
      <h2>Items</h2>
      <div class="item-list" id="item-list">
        ${rows}
      </div>
    </section>
  </div>

  <script>
    const __REVIEW_MODEL__ = JSON.parse(${JSON.stringify(embeddedModel)});
    const DECISIONS = new Map();

    function updateDecisionCount() {
      const node = document.querySelector('[data-role="decision-count"]');
      if (!node) return;
      node.textContent = String(DECISIONS.size) + ' decisions selected';
    }

    function collectDecisions() {
      return Array.from(document.querySelectorAll('[data-principle-id]')).flatMap((card) => {
        const id = card.getAttribute('data-principle-id');
        const selected = card.querySelector('input[type="radio"]:checked');
        const note = card.querySelector('textarea')?.value ?? '';
        if (!id || !selected) return [];
        return [{ id, action: selected.value, note }];
      });
    }

    function exportDecisionJson() {
      const payload = {
        version: 1,
        kind: 'principles-review-decision',
        generatedAt: new Date().toISOString(),
        reviewSessionId: __REVIEW_MODEL__.reviewSessionId,
        registrySnapshotHash: __REVIEW_MODEL__.registrySnapshotHash,
        reviewer: '',
        decisions: collectDecisions(),
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'review-decision.json';
      a.click();
      URL.revokeObjectURL(url);
    }

    document.getElementById('export-decision')?.addEventListener('click', exportDecisionJson);
    document.querySelectorAll('input[type="radio"]').forEach((input) => {
      input.addEventListener('change', (event) => {
        const target = event.currentTarget;
        const card = target.closest('[data-principle-id]');
        const id = card?.getAttribute('data-principle-id');
        if (!id) return;
        DECISIONS.set(id, target.value);
        updateDecisionCount();
      });
    });
    updateDecisionCount();
  </script>
</body>
</html>`;
}

function renderItemCard(item: PrinciplesReviewModel['items'][number]): string {
  const actionOptions = ['keep-active', 'mark-stale', 'archive', 'disable'] as const;

  return `<article class="item-card" data-principle-id="${escapeHtml(item.id)}">
    <div>
      <span class="pill">${escapeHtml(item.id)}</span>
      <span class="pill">lifecycle: ${escapeHtml(item.metadata.lifecycle)}</span>
      <span class="pill recommended">recommended: ${escapeHtml(item.review.recommendedAction)}</span>
    </div>
    <h3>${escapeHtml(item.content)}</h3>
    <p>
      ${item.tags.map((tag) => `<span class="pill">tag:${escapeHtml(tag)}</span>`).join('')}
      <span class="pill">activeScore:${item.metadata.activeScore}</span>
      <span class="pill">hintCount:${item.metadata.hintCount}</span>
    </p>
    <p>
      ${item.review.reasons.map((reason) => `<span class="pill danger">${escapeHtml(reason)}</span>`).join('')}
      ${item.review.signals.map((signal) => `<span class="pill">${escapeHtml(signal)}</span>`).join('')}
    </p>
    <div class="action-group">
      ${actionOptions.map((action) => `
        <label class="inline-radio">
          <input type="radio" name="decision-${escapeHtml(item.id)}" value="${escapeHtml(action)}" ${item.review.recommendedAction === action ? 'checked' : ''} />
          <span>${escapeHtml(action)}</span>
        </label>
      `).join('')}
    </div>
    <label>
      Reviewer note
      <textarea placeholder="Optional review note"></textarea>
    </label>
  </article>`;
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
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}
