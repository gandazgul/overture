const ANALYTICS_REPORT_TEMPLATE = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Overture Analytics Report</title>
  <style>
    :root {
      --bg: #0f0f1c;
      --panel: #17172b;
      --text: #ece6d2;
      --accent: #d4af37;
      --muted: #9ea0bb;
      --line: #2d2f4f;
    }
    body {
      margin: 0;
      background: var(--bg);
      color: var(--text);
      font-family: Inter, system-ui, -apple-system, sans-serif;
      line-height: 1.4;
      padding: 20px;
    }
    h1, h2 {
      color: var(--accent);
      margin-top: 0;
    }
    .meta {
      color: var(--muted);
      margin-bottom: 20px;
      font-size: 14px;
    }
    .filter-panel {
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: 10px;
      padding: 12px;
      margin-bottom: 20px;
      display: flex;
      gap: 20px;
      align-items: center;
      font-size: 14px;
    }
    .filter-group {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .filter-group label {
      color: var(--muted);
      font-weight: 600;
    }
    select, input {
      background: #0a0a1a;
      color: var(--text);
      border: 1px solid var(--line);
      padding: 4px 8px;
      border-radius: 4px;
      cursor: pointer;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
      gap: 14px;
    }
    section {
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: 10px;
      padding: 14px;
      overflow-x: auto;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 14px;
    }
    th, td {
      border-bottom: 1px solid var(--line);
      padding: 8px 6px;
      text-align: left;
      vertical-align: top;
    }
    th {
      color: var(--accent);
      font-weight: 600;
    }
    .empty {
      color: var(--muted);
      font-style: italic;
    }
  </style>
</head>
<body>
  <h1>Overture Analytics Report</h1>
  <p class="meta">
    Generated: {{GENERATED_AT}}<br/>
    Last crunch: {{LAST_CRUNCH_TS}}<br/>
    Crunch run: processed lines={{PROCESSED_LINES}}, applied={{APPLIED_EVENTS}}, duplicates={{DUPLICATE_EVENTS}}, skipped={{SKIPPED_LINES}}
  </p>

  <div class="filter-panel">
    <div class="filter-group">
      <label>Debug Games:</label>
      <select onchange="location.href = this.value">
        <option value="/api/analytics/report" {{SELECTED_ALL}}>All</option>
        <option value="/api/analytics/report?debug=0" {{SELECTED_DEBUG_0}}>Normal Only</option>
        <option value="/api/analytics/report?debug=1" {{SELECTED_DEBUG_1}}>Debug Only</option>
      </select>
    </div>
  </div>

  <div class="grid">
    <section>
      <h2>Summary</h2>
      {{TABLE_SUMMARY}}
    </section>

    <section>
      <h2>Duration</h2>
      {{TABLE_DURATION}}
    </section>

    <section>
      <h2>Outcome buckets</h2>
      {{TABLE_OUTCOMES}}
    </section>

    <section>
      <h2>Debug vs Normal</h2>
      {{TABLE_DEBUG_SPLIT}}
    </section>

    <section>
      <h2>Draw source</h2>
      {{TABLE_DRAW_SOURCE}}
    </section>

    <section>
      <h2>Player count distribution</h2>
      {{TABLE_PLAYER_COUNT}}
    </section>

    <section>
      <h2>Theater frequency</h2>
      {{TABLE_THEATER}}
    </section>

    <section>
      <h2>AI/Human participation & wins</h2>
      {{TABLE_AI_WINS}}
    </section>

    <section>
      <h2>Score summary</h2>
      {{TABLE_SCORE_SUMMARY}}
    </section>

    <section>
      <h2>Per-type VP totals</h2>
      {{TABLE_PER_TYPE_SCORES}}
    </section>

    <section>
      <h2>Top picks (patron+trait)</h2>
      {{TABLE_PICK_BY_CARD}}
    </section>

    <section>
      <h2>Starting card frequency</h2>
      {{TABLE_STARTING_CARDS}}
    </section>

    <section>
      <h2>Pick frequency by patron</h2>
      {{TABLE_PICK_BY_PATRON}}
    </section>

    <section>
      <h2>Pick frequency by trait</h2>
      {{TABLE_PICK_BY_TRAIT}}
    </section>
  </div>
</body>
</html>`;

export { ANALYTICS_REPORT_TEMPLATE };
