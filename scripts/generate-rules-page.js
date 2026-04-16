// @ts-check

import { marked } from 'npm:marked@13';

const SOURCE_MD = "public/RULE_BOOK.md";
const OUTPUT_RULES_HTML = `public/rules.html`;

/**
 * @param {string} path
 */
async function ensureDir(path) {
    await Deno.mkdir(path, { recursive: true });
}

/**
 * @param {string} path
 */
async function removeIfExists(path) {
    try {
        await Deno.remove(path, { recursive: true });
    } catch (err) {
        if (!(err instanceof Deno.errors.NotFound)) {
            throw err;
        }
    }
}

/**
 * @param {string} fromDir
 * @param {string} toDir
 */
async function copyDirRecursive(fromDir, toDir) {
    await ensureDir(toDir);

    for await (const entry of Deno.readDir(fromDir)) {
        const fromPath = `${fromDir}/${entry.name}`;
        const toPath = `${toDir}/${entry.name}`;

        if (entry.isDirectory) {
            await copyDirRecursive(fromPath, toPath);
            continue;
        }

        if (entry.isFile) {
            await Deno.copyFile(fromPath, toPath);
        }
    }
}

const markdown = await Deno.readTextFile(SOURCE_MD);

marked.setOptions({
    gfm: true,
    breaks: false,
    mangle: false,
    headerIds: true,
});

const articleHtml = await marked.parse(markdown);

const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Overture Rule Book</title>
  <style>
    :root {
      color-scheme: dark;
      --bg: #0f0f1c;
      --panel: #1a1a2e;
      --text: #e0e0e0;
      --accent: #d4af37;
      --rule: #333;
    }

    * { box-sizing: border-box; }

    body {
      margin: 0;
      background: var(--bg);
      color: var(--text);
      font-family: Georgia, "Times New Roman", serif;
      line-height: 1.6;
      padding: 30px 14px;
    }

    .wrap {
      max-width: 800px;
      margin: 0 auto;
      background: var(--bg);
      border: 4px double var(--accent);
      padding: 30px;
      text-align: left;
    }

    h1,
    h2,
    h3,
    h4 {
      color: var(--accent);
      letter-spacing: 1px;
      line-height: 1.25;
    }

    h2 {
      border-bottom: 1px solid var(--accent);
      padding-bottom: 10px;
      margin-top: 40px;
      text-transform: uppercase;
      letter-spacing: 3px;
    }

    hr {
      border: 0;
      border-top: 1px solid var(--rule);
      margin: 1.5rem 0;
    }

    a {
      color: var(--accent);
      font-weight: bold;
    }

    img {
      max-width: 100%;
      height: auto;
    }

    ul,
    ol {
      padding-left: 1.3rem;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      margin: 20px 0;
      background: rgba(255, 255, 255, 0.05);
    }

    th {
      background: #b48214;
      color: #0f0f1c;
      text-align: left;
      padding: 10px;
    }

    td {
      padding: 10px;
      border-bottom: 1px solid var(--rule);
      vertical-align: top;
    }

    blockquote {
      margin: 16px 0;
      padding: 10px 14px;
      border-left: 3px solid var(--accent);
      background: var(--panel);
    }

    code,
    pre {
      font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      background: #141424;
      border: 1px solid #2f2f48;
      border-radius: 6px;
    }

    code { padding: 0.1rem 0.3rem; }
    pre { padding: 0.75rem 0.95rem; overflow: auto; }
  </style>
</head>
<body>
  <main class="wrap">
${articleHtml}
  </main>
</body>
</html>
`;

await Deno.writeTextFile(OUTPUT_RULES_HTML, html);

console.log(`Generated ${OUTPUT_RULES_HTML}`);
