# MusicPlayerDock

A standalone Windows music island. Hover at the top center of your primary display to reveal a glass music controller. Move away and it retracts. It controls compatible Windows media sessions; it does not play or stream music itself. The default Comfort layout is 440 x 160 logical pixels at 1x, with 112 px artwork, title/artist, a 5 px silver-to-white fill-only seek bar and a single playback row. The attached silhouette extends from the top screen edge to 172 px down. There is no bottom utility strip; Settings remains accessible from the tray.

## App identity

The supplied assests/MusicPlayerDock-logo.png and .ico are reused without changing their artwork. The PNG is used in Settings, idle state and missing-artwork branding; the ICO supplies tray/window icons, the favicon and embedded Windows executable icons. Packaging stamps the main executable through scripts/set-icon.ps1 using native Windows resource APIs and verifies every embedded image frame against the source ICO. This requires Windows PowerShell at build time; the finished app does not run the icon-stamping script.

## Run the portable app

Extract `release/MusicPlayerDock-1.0.1-win-x64.zip` and run **MusicPlayerDock.exe** inside its folder. Keep the adjacent files together. When updating, quit the existing instance from the tray before replacing files and relaunching. No browser, terminal, Node.js or .NET installation is required by the portable build. Use the notification-area music icon to open Settings or quit. The default Black Notch theme has a solid black 84 x 8 px handle attached to the top edge. Glass themes retain the floating 60 x 6 px capsule. Its 90 × 10 px activation zone is centered on the top edge.

Requirements: Windows 10 version 2004 (build 19041) or newer, x64; Windows 11 supported by the selected APIs. This build is unsigned, so Windows may display its normal unknown-publisher prompt. The executable is a portable folder distribution, not a single-file installer.

## Development

Install Node.js 22.12+ and .NET SDK 8. Then:

```powershell
npm install
npm run build:native
npm run dev
```

`npm run dev` starts Vite and Electron; renderer changes reload automatically. Restart it after desktop-process changes. `npm run preview` serves the renderer only; open `http://127.0.0.1:5173/?preview=1` for an explicitly enabled static sample, or `http://127.0.0.1:5173/#settings` for preferences. Windows integration requires Electron. No demo music is enabled in normal operation.

```powershell
npm test
npm run typecheck
npm run build
npm start
npm run dist
```

`dist` builds the UI and self-contained Windows bridge, then creates the portable executable directory and ZIP in `release/`. Release folders include the package version. Close a running instance before rebuilding the same version; a new version can be prepared alongside it. Quit the old instance before launching the new version. `npm run typecheck` checks the renderer and shared IPC contracts; `npm run typecheck:desktop` checks desktop TypeScript. Local desktop checks used compatible Electron 39.8.10 declarations while the shipped runtime is 41.2.1; repeat against exact declarations after normal installation. The desktop bundle is compiled by esbuild. On this machine dependencies were recovered from pre-existing caches because external package downloads were denied; `scripts/cache-bootstrap.cjs` is a local recovery utility, not the normal installation workflow. A lockfile could not be resolved completely offline; direct application dependencies are pinned.

## Architecture

- `electron/main.ts`: non-focusing, transparent fixed-size overlay, tray, display/DPI positioning, startup registration, validated settings and restricted IPC.
- `electron/policy.mjs`: deterministic visibility state machine, hit-region geometry and settings validation. Unit tests cover races and invalid configuration.
- `electron/bridge.ts`: newline-delimited JSON child-process connection with crash recovery and exponential backoff.
- `electron/preload.ts`, `src/shared.ts`: narrow typed API. Renderer Node integration is disabled; context isolation and sandbox are enabled. External navigation and permission requests are denied.
- `native/MediaBridge`: .NET 8 WinRT companion using `GlobalSystemMediaTransportControlsSessionManager`. It subscribes to session, metadata, playback and timeline events. A one-second reconciliation checks fullscreen and missed timeline updates; unchanged snapshots are suppressed. Streams, session handlers and the companion are disposed during shutdown.
- `src/main.tsx`, `src/Dock.tsx`, `src/Preferences.tsx`, `src/style.css`: React UI, supported Glisse `Glass`, `Button`, and `Switch`, album transitions, progress extrapolation, source selector and preferences. CSS transitions implement the reveal; reduced-motion honors both preferences and the OS.
- `scripts/package.mjs`: copies Electron runtime and bundled app into a portable directory; no development server is shipped.

The overlay remains one size while its content animates inside it. It uses native content bounds and an explicit CSS UI scale; page zoom is locked to 1 in the overlay, and Settings uses a separate browser session so its zoom cannot resize dock content. The overlay document does not scroll; Settings has an independent scrolling root. Electron cursor polling at 20 Hz detects the trigger globally, even with the window hidden. Transparent margins and rounded corners use native mouse pass-through; only the visible island accepts clicks. Reveal uses `showInactive` and a non-focusable window. It never reserves work-area space. Multi-display settings use display IDs and fall back to primary if a display disappears. The native fullscreen check returns physical bounds; Electron converts its display center into physical coordinates before comparison.

## Windows media integration

Any application exposing a Windows system media session can appear: Spotify, browsers with Media Session support, Windows players, and other compatible apps. Available controls come directly from that session. Shuffle and repeat appear only when their control and readable state are present. There is no fabricated favorite state. The progress position is extrapolated using the player timestamp and playback rate only while visible, and reconciled with native updates. Seeking is enabled only when the player supports it. Players sometimes report incomplete, delayed or inaccurate timelines; live streams show LIVE and cannot be sought without a duration.

Select a source in Settings > Music > Active player when several sessions exist. An explicit selection remains until that session disappears or automatic selection is re-enabled through saved settings. With automatic selection off, the preferred application source survives restarts; session IDs themselves are transient. Metadata is cleared when a session disappears. Thumbnail reads are capped at 6 MB and supported image formats; missing artwork gets a designed record sleeve.

The compact dock omits the open-player utility action. The bridge retains existing desktop player activation support for future use. Commands are asynchronous requests to the player, which may decline them even when capability flags are enabled.

### AURA

The dock has no dependency on AURA and does not touch its repository. If AURA publishes SMTC it appears automatically. Otherwise AURA would need to obtain a `SystemMediaTransportControls` instance associated with its real playback window/player, publish title/artist/album/thumbnail and playback status, supply timeline updates, set supported controls, and handle button/seek/repeat/shuffle requests by updating its playback engine. Browser Media Session metadata alone may require its desktop host to publish SMTC.

## Themes and glass material

Black Notch is the default. Its pure-black SVG silhouette connects to the actual top screen edge through concave shoulders and ends in rounded lower corners. The dock bypasses Glisse surfaces, refraction, frost, artwork glow, outlines and reflections in this theme. The collapsed handle is also attached. Native mouse hit testing follows its shoulder cutouts. Pre-theme settings migrate once to this new default; subsequent explicit choices of glass themes persist. Glass intensity, opacity and artwork illumination apply only to the glass themes.


Glisse 0.5.0's actual package exports and declarations were inspected before integration. It supplies interactive glass controls and surfaces; complementary CSS supplies the island geometry, restrained borders, internal reflections and blurred artwork illumination. The compact surface preserves Glisse's generated --lg-rim background and --lg-filter refraction chain, including corner warping of renderer-local backdrop content; it no longer replaces these with a flat CSS background. The supplied `design-reference.png` inspired the layout and remains a reference file, not a shipped music cover.

**This build simulates glass and does not blur arbitrary desktop pixels.** Electron/Chromium backdrop filters only sample their own rendered surface. Windows 11 system backdrops are not a dependable cross-version solution for this transparent, fixed-size, independently animated shape; applying a full-window acrylic effect would also illuminate transparent margins. No undocumented composition hooks or screen capture are used. The material is isolated in `.shell`, `.ambient` and Glisse styles for a future native-shaped composition host. High opacity preserves contrast over light and dark wallpapers.

## Dock layout and Settings

Settings is organized into Layout, Appearance, Behavior, Music and System pages. Layout and Appearance show a scaled preview using the actual dock renderer; changes stay in a draft until Apply changes. Discard restores saved preferences. Active-player switching is immediate and labeled as such. Compact, Comfort and Roomy presets offer starting points; Black Notch and Comfort remain the defaults.

Layout controls include width (380-640 px), height (144-220 px), inner padding (10-22 px), bottom corner radius (16-30 px), artwork size (80-152 px), title size (16-24 px), play-button size (28-44 px), artwork/album/time visibility and optional shuffle/repeat. Artwork fits itself to the available area. Height increases if large type and controls would otherwise clip. All native window dimensions and hit regions use the same saved geometry as the renderer.

Appearance offers a silver-to-white monochrome progress fill or solid white, with 3-8 px thickness. Neither style exposes a slider thumb. Glass-only controls are disabled for Black Notch. The Settings window fits the available desktop area and uses its own scrolling root and independent zoom session.

## Configuration

Preferences are stored at `%APPDATA%/music-player-dock/settings.json`. Saving validates types, clamps numeric ranges and atomically replaces the file. Invalid JSON uses defaults. Close the app and delete this file to reset it. Runtime data uses the ordinary Windows application-data directory; source and build files remain in this project.

| Setting | Default | Range / behavior |
|---|---|---|
| Auto-hide | On | Disable to keep the island open |
| Hide delay | 550 ms | 100–5000 ms; UI offers up to 3000 |
| Trigger | 90 × 10 px | Width 30–500, height 2–50; Windows logical pixels |
| Collapsed | Minimal handle | Or fully hidden, still click-through |
| Animations | On | Reduced motion also honors Windows/browser preference |
| Glass / opacity | 65% / 88% | Glass 0–100, opacity 60–100 |
| Theme | Black Notch | Opaque black, attached shoulders, no border or frosting; Midnight Glass and Frost Glass remain optional |
| Artwork illumination | On | Static blurred local artwork, no continuous effect |
| UI scale | 1× | 0.65–1.5; additionally fits available display space |
| Automatic media selection | On | Windows current session, then playing/first available |
| Preferred source | Empty | Applied when automatic selection is off |
| Optional controls | On | Only supported shuffle/repeat shown |
| Start with Windows | Off | Per-user login registration; portable directory must stay put |
| Hide in fullscreen | On | Best-effort foreground-window monitor coverage detection |
| Monitor | Primary | Configurable display, hot-plug fallback |

System volume is intentionally left in Windows Quick Settings in this version; no misleading per-app volume control is displayed.

## Troubleshooting and limitations

- **Nothing playing:** start media in an app that publishes a Windows media session. Browser media-session policy varies; a visible web player alone does not guarantee SMTC.
- **Bridge disconnected:** run `npm run build:native`; production needs `resources/bridge/MediaBridge.exe` alongside the application resources. The app retries crashes with bounded backoff. A missing executable requires repair/restart.
- **No thumbnail or seek:** the source may not provide it. This is common with live streams and some browser tabs.
- **Overlay absent:** quit older tray instances before launching an update, then check the tray, preferred monitor and fullscreen setting. Hover the actual top center of that display, not the taskbar. Fully hidden mode has no visual indicator.
- **Fullscreen detection:** best effort, checked once per second. Exclusive games, protected desktops, elevated windows and unusual borderless apps need manual validation. Always-on-top uses the normal level, not a security-window override.
- **Auto-start:** register only after moving the extracted app to a stable directory; moving it later invalidates the startup path. Development auto-start launches Electron without a project argument and is not supported; configure it in the portable build.
- There is no native desktop blur, in-dock volume slider, favorites support, updater, installer, code signature, per-app volume mixer, or global keyboard shortcut. Browser artwork over 6 MB and unsupported image types fall back safely.
- Electron has a larger memory footprint than a native UI. Hidden rendering is throttled and progress timers stop, but no measured CPU/memory budget is claimed.
- In-app browser automation was unavailable here. See `DEVELOPMENT-REPORT.md` for exactly what was tested and the remaining desktop checks.

API references: [Glisse source and usage](https://github.com/0kzh/glisse), [Electron BrowserWindow](https://www.electronjs.org/docs/latest/api/browser-window), [Microsoft GSMTC session manager](https://learn.microsoft.com/en-us/uwp/api/windows.media.control.globalsystemmediatransportcontrolssessionmanager).
