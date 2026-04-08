## Code Search

Use Vera before opening many files or running broad text search when you need to find where logic lives or how a feature works.

- `vera search "query"` for semantic code search. Describe behavior: "JWT validation", not "auth".
- `vera grep "pattern"` for exact text or regex
- `vera references <symbol>` for callers and callees
- `vera overview` for a project summary (languages, entry points, hotspots)
- `vera search --deep "query"` for RAG-fusion query expansion + merged ranking
- Narrow results with `--lang`, `--path`, `--type`, or `--scope docs`
- `vera watch .` to auto-update the index, or `vera update .` after edits (`vera index .` if `.vera/` is missing)
- For detailed usage, query patterns, and troubleshooting, read the Vera skill file installed by `vera agent install`
