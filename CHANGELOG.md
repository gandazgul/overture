## [v2026.4.19.1] - 2026-04-19

### New Features
- **Theater Overlay**: Added a new `TheaterOverlay` component allowing players to inspect the theater state of any player during the game or at the end-game screen.
- **Analytics Beacon Enhancements**: 
    - Made the analytics beacon host configurable via environment variables.
    - Added `.env.sample` template for easier configuration.
    - Added analytics report caching and timing-safe authentication.
- **Infrastructure**: Added support for Go modules.

### Bug Fixes and Improvements
- **Server & Networking**:
    - Improved client IP detection by utilizing `Deno.ServeHandlerInfo`.
    - Added an API proxy in `vite.config.js` to streamline local development.
    - Refactored `server.js` into modular handlers for better maintainability.
    - Updated the `dev` task to use a dedicated `scripts/dev.js` orchestration script.
- **CORS Handling**:
    - Significant improvements to CORS handling for the analytics beacon, including better origin validation, refined header management, and support for `Access-Control-Allow-Credentials`.
- **UI/UX**:
    - Fixed table overflow issues.
    - Added "See Theaters" button to the end-game screen.
- **Code Quality**:
    - Removed `@src/` import alias in favor of relative paths for better compatibility and transparency.
    - Updated server initialization and switched to `std` imports where applicable.

### Breaking Changes
- **Imports**: Removal of the `@src/` import alias may require updating any external scripts or tools that relied on this alias.

### Other Changes
- Updated `.gitignore` to include `go.imports.xml`.
