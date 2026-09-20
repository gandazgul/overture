# Releases and Rulebook Updates

## Publish the Game

1. Run `deno task ci` and `deno task build` before committing.
2. Commit the intended changes and push `main`. This deploys GitHub Pages and
   builds the development container.
3. Create and push a new version tag, `vYYYY.M.D.N` (start at 0 for a new day and
   increment for later releases that day). Never move an existing release tag.
4. Check the **Release to Itch.io** GitHub Actions workflow. It builds `dist/`
   and pushes both `gandazgul/overture:web` and `gandazgul/overture:download`
   through Butler using the repository's `ITCHIO_API_KEY` secret. Do not put the
   key in source code or release notes.
5. Verify both channels report the new version and that the
   [itch.io game](https://gandazgul.itch.io/overture) loads. GitHub Pages and the
   release container are also built on the version tag.

The tag triggers itch.io publishing; a GitHub Release entry is separate and can
be created for the same tag with concise release notes.

## Update the Rulebook

The canonical source is `public/RULE_BOOK.md`. `deno task build` runs
`scripts/generate-rules-page.js`, producing ignored `public/rules.html`, which
Vite includes in `dist/`. Do not hand-edit the generated HTML.

The itch.io page's **Read the Full Rulebook** button points to
[GitHub Pages](https://gandazgul.github.io/overture/rules.html). Pushing `main`
therefore updates the linked rulebook automatically once **Deploy to GitHub
Pages** succeeds. No separate itch.io rulebook upload or paste is needed.
Tagged releases also include the updated rulebook in both itch.io build channels.

## Edit the Itch.io Description

The description is separate from the linked rulebook and is not updated by
Butler. Sign in to itch.io, open Overture, select **Edit game**, update the
description, and save. The local reference is `docs/itch.io.html`; its rulebook
link should remain pointed at GitHub Pages.

The description's older Score line should read:

> Score: The curtains open after round 12. Most Victory Points wins!

If replacing HTML, use the description editor's HTML/source view and preserve
existing images and styling. Editing only the outdated sentence avoids
overwriting other page changes.
