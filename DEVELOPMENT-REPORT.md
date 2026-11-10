# Development report

## Implemented

Electron/React/TypeScript Windows overlay with a fixed transparent frameless window, normal always-on-top behavior, tray lifecycle, native mouse pass-through, global top-edge cursor polling, monitor placement and hot-plug fallback. A visibility state machine handles reveal, hide delay, reversal and fullscreen suppression. The window starts collapsed and does not take focus. Settings use validation and atomic persistence; startup registration is available for the portable build.

The compact 440 x 128 px layout follows the smaller reference, with 104 px square artwork, title/artist and one playback row. The bottom utility strip is removed. Progress is 5 px thick with a fill edge and no thumb in any interaction state. Glisse 0.5.0 exports and source were inspected; real `Glass`, `Button` and `Switch` components are integrated. The UI includes playback capabilities, source selection, artwork fallback, long-title truncation, progress extrapolation, seeking, supported shuffle/repeat, themes and reduced motion. CSS transitions replace Motion because Motion was unavailable in the offline package cache. Sample metadata is restricted to explicit browser `?preview=1` mode.

A self-contained .NET 8 Windows companion implements GSMTC session enumeration and event subscriptions, metadata/artwork/timeline reading, capability-aware commands, existing desktop player activation and foreground fullscreen detection. A serialized event queue avoids overlapping metadata reads. Bridge failure clears stale state and retries with capped exponential backoff. Native resources and handlers are released on exit. Identical snapshots are suppressed.

## Verification performed

- Renderer/shared-contract TypeScript compilation: passed.
- Vite production renderer and esbuild desktop/preload bundles: passed. Upstream `use client` directives generate harmless Vite warnings and are ignored in this client-only application.
- Native WinRT compilation and self-contained win-x64 publish: passed.
- Five Node tests: passed, covering corrupt settings/range validation, rapid hover reversal, hide-timer cancellation, fullscreen override and trigger geometry on negative monitor coordinates.
- Native executable launched and attempted `GlobalSystemMediaTransportControlsSessionManager.RequestAsync`: Windows returned `UnauthorizedAccessException / Access is denied` in this managed execution environment. Metadata and playback commands could not be exercised against a real media session here. This is a real failed runtime check, not evidence of successful media integration.
- Electron desktop launch attempted using the cached Electron 41.2.1 Windows runtime. Chromium's GPU subprocess repeatedly exited with status `-1073741515` (`0xC0000135`), then the application aborted before its renderer loaded. Hardware startup/hover/focus behavior could not be certified by that attempt.
- In-app Browser skill setup completed, but browser discovery returned an empty list; browser-driven UI tests were unavailable.
- Desktop main-process TypeScript was additionally checked using existing local Electron 39.8.10 API declarations and Node types copied as dependency files into this workspace. This caught and fixed an overloaded display-event typing error. No other project was changed. The shipped runtime is Electron 41.2.1; repeat `npm run typecheck:desktop` against its exact declarations after a normal `npm install`.
- A second desktop startup attempt with hardware acceleration disabled also failed with the same GPU subprocess status. The software-rendering flag remains available for machines with graphics driver issues; it is not claimed to fix this environment.

## Manual Windows acceptance checks still required

1. Extract the portable ZIP in a normal desktop session and launch the EXE; confirm tray icon, initial handle, no taskbar button and no terminal. If a GPU issue occurs, try `MusicPlayerDock.exe --software-rendering`; check the installed graphics driver and Windows runtime dependencies.
2. Hover top-center, leave/re-enter rapidly, cross rounded corners and click another application's content outside the island. Verify no focus stealing and no invisible interception. Check fully hidden mode and auto-hide disabled.
3. Play/pause/skip/seek in Spotify, a supported browser tab and a local Windows player. Confirm actual actions and capability flags match. Test shuffle/repeat and declined commands.
4. Change tracks/artwork rapidly, test missing art/metadata, long titles, live streams, pause/resume and app closure. Confirm stale metadata clears. Open several sources and test automatic/manual selection.
5. Test 100/125/150/200% scaling, mixed-DPI monitors on either side of primary, hot-plug and resolution changes; fullscreen video/game/presentation suppression and recovery.
6. Save preferences, restart, corrupt settings JSON and confirm defaults. Test auto-start from the installed portable path after a Windows sign-out/in; moving the directory needs re-registration.
7. Kill the companion and confirm retries/recovery. Measure hidden/expanded CPU, memory and GPU usage over a long desktop session; check shutdown leaves no bridge process. Accessibility and screen-reader keyboard interaction need review (the overlay itself deliberately never takes focus; preferences are keyboard-accessible).
8. Verify light/dark wallpaper contrast, animations and reduced motion visually. No successful screenshot-based visual comparison is claimed in this environment.

## Limitations and future work

No genuine desktop blur: the material uses layered translucency, static artwork illumination and Glisse interaction effects. Native shaped acrylic/DirectComposition can be investigated separately. No in-dock system volume slider, favorites, updater, installer or signature. Open-player activation is limited to desktop `.exe` source IDs and is subject to Windows activation policy. Fullscreen checks depend on the bridge and run once per second; exclusive games and protected/elevated windows need testing. Generic media support depends on the source publishing accurate SMTC data. AURA requires no dock-specific integration if it publishes SMTC; the README describes the needed AURA-side adapter without changing that repository.

Production builds use a portable directory and ZIP with a renamed Electron executable and a self-contained native bridge. The executable and ZIP were generated and their contents inspected. They do not require a developer server or a separately installed .NET runtime. Network restrictions prevented a complete npm lockfile resolution; direct application package versions are pinned and cache restoration was used locally. Future release work should resolve and commit a complete lockfile, run exact-runtime desktop typechecking and the manual matrix, measure performance, sign the build, and optionally provide an installer.

## Compact-layout revision

Renderer and native window geometry now share electron/geometry.mjs: the visible dock is 440 x 128 logical pixels inside a 464 x 152 transparent window, with a 320 x 80 idle dock. Native rounded hit testing uses the same dimensions and 22 px radius; the change is a new layout rather than a reduced zoom level. Source switching moved to Settings. Frosted material preserves Glisse's generated rim and backdrop SVG filter, with local artwork illumination behind the glass so local refraction can sample it. Arbitrary desktop blur remains unsupported. Renderer and desktop compatibility typechecks, production UI bundling and all five existing state-machine tests passed after the revision. Visual Windows verification remains pending because of the previously documented runtime limits.

## Viewport and scaling fix

The user reported scrollbars and clipped controls in the compact dock. The document had no viewport-level overflow constraint, and UI scaling used Chromium page zoom on the same file origin as Settings. The fix makes the overlay document non-scrollable while Settings has its own scrolling root, isolates the two Electron session partitions, resets overlay page zoom after navigation, and applies UI scale explicitly to the dock canvas. Native content bounds and inverse cursor coordinates use the identical effective scale; dimensions round upward to avoid fractional-pixel clipping. The frameless overlay uses content sizing and disables the thick frame. Seven automated tests now pass, including complete visible-rectangle containment at 0.65, 0.7, 0.85, 1, 1.05, 1.1, 1.25 and 1.5 scales and a small-display fit. Renderer and desktop compatibility typechecks and production UI bundling pass. A fresh desktop diagnostic launch still failed at GPU process startup with 0xC0000135, and browser discovery remained empty, so visual confirmation of this fix remains pending. Fully quit the old tray instance before replacing files or launching this update.

## Black Notch theme

Added Black Notch as the new default, including migration of legacy appearance settings while preserving behavior and saved scale. Later explicit glass-theme selections persist. A single opaque black SVG path joins the top display edge with concave shoulders and rounded lower corners; there is no floating gap, border, rim, frost, refraction, ambient artwork layer or outer shadow in this theme. The compact content layout stays unchanged. The collapsed handle also joins the screen edge. Native hit testing follows the silhouette, including transparent shoulder cutouts. Midnight Glass and Frost Glass remain in Settings. Theme application runs before paint to avoid a mismatched first frame. New regression tests cover theme migration and edge/cutout click behavior. Visual Windows verification remains pending under the previously documented runtime limits.

## Taller dock and expanded Settings

The default body is now 440 x 160 px instead of 440 x 128, extending downward while preserving the top attachment. Twelve new appearance/layout preferences cover width, height, padding, corners, artwork, title/play button sizes, progress thickness/style and content visibility. Geometry, window fitting, native hit regions, SVG shape and CSS variables share the same settings. Validation clamps all values and reserves enough height for large controls and text; artwork adapts to preserve the transport row.

Settings has five navigation pages, a shared-renderer scaled layout preview, three size presets, a separate draft with Apply/Discard, disabled glass controls for solid black, restored defaults and better keyboard focus styling. Native preferences-window dimensions fit the primary work area. Progress is now silver-to-white by default, with an optional solid-white fill and no thumb in either mode. The UI was split into Dock.tsx and Preferences.tsx to share the real renderer with the preview.

Renderer and desktop compatibility typechecks passed. Production UI bundles passed. Eleven tests passed, adding combined extreme size/spacing/control/artwork validation and click-region consistency. Live visual verification remains pending under the already documented desktop GPU/browser restrictions. The native bridge was unchanged.

## Supplied logo and reveal regression

Integrated the supplied PNG/ICO unchanged across Settings branding, the idle state, missing-artwork branding, the tray, window icons, favicon and packaged executable icon. The companion project also references the ICO. Packaging now carries the original assets and stamps/reads back main-EXE Windows resources through a workspace-restricted PowerShell tool; every embedded ICO frame is compared byte-for-byte with the source file.

The no-reveal regression was traced to a CSS selector introduced when theme rules were scoped to the overlay for the Settings preview. The rule .overlay[data-theme=black] .is-open .island required a descendant with is-open, but that class lives on the overlay itself. It was corrected to .overlay[data-theme=black].is-open .island. The real island now additionally receives transform/opacity directly from visibility state so a theme-selector error cannot hold it off-screen. A new server-render test exercises visible/hidden markup for all three themes, both with and without media, using the real DockView component. All twelve automated tests passed. Renderer and desktop compatibility typechecks and UI bundling passed. Actual cursor-triggered Windows rendering still needs desktop confirmation because of the previously documented local GPU restriction.

The initial package refresh encountered locked runtime DLLs from the running app. The update is version 1.0.1 and packages into a versioned side-by-side directory, preserving the active copy. Quit the old tray instance before launching the new version.
