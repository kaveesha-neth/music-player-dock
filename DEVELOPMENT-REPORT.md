# Development report

Current release: **1.2.6**. Earlier revision sections below are historical; the Liquid Glass section describes the current capture implementation.

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

The older Midnight/Frost themes use layered translucency, artwork illumination and Glisse interaction effects. Release 1.2.0 adds experimental captured-desktop blur/refraction separately; DWM-native shaped acrylic/DirectComposition remains future work. No in-dock system volume slider, favorites, updater, installer or signature. Open-player activation is limited to desktop `.exe` source IDs and is subject to Windows activation policy. Fullscreen checks depend on the bridge and run once per second; exclusive games and protected/elevated windows need testing. Generic media support depends on the source publishing accurate SMTC data. AURA requires no dock-specific integration if it publishes SMTC; the README describes the needed AURA-side adapter without changing that repository.

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

## 1.1.0 reference Black Notch

Implemented the supplied three-row black-notch reference: upper artwork/metadata/activity, full-width timeline with flanking time labels, large uncircled play/pause and previous/next controls, shuffle/repeat at the left, and Windows output at the right. Black Notch now has independent saved geometry and presets, with a 520 x 280 Comfort body. The floating glass layouts remain separate and no new real-glass theme was added.

Added bounded two-layer transitions for metadata, artwork and stateful icons, eased button hover/press feedback, interpolated progress fill, reduced-motion handling and no continuous animation when hidden. Playback bars indicate session playing state and are not an audio-level meter. Seek dragging holds the dock open, captures pointer input, and reconciles a short pending seek with actual media timeline updates. Layers, animation frames, timers and media-query listeners are disposed.

Added Core Audio multimedia-endpoint metadata and IMMNotificationClient callbacks. Endpoint form factor selects laptop for speakers, headphones for headphones/headsets, and distinct unknown/missing/display states. The real local endpoint was successfully read as Headphones (Realtek(R) Audio), kind headphones. The device button opens Windows sound settings through a narrow authorized IPC action. This tracks Windows default output; per-app routing may differ.

The companion was also tested through a normal JSON snapshot and EOF shutdown: it reported the real headphones endpoint and exited cleanly with status 0. GSMTC access remains denied in this tool environment; media permission failure now preserves audio-output/fullscreen reporting and retries every thirty seconds instead of crashing. No physical hot-plug or output-switch test was performed.

Renderer and desktop compatibility typechecks and production UI bundling passed. All fifteen Node tests passed, including actual rendered device/playback states, unsupported controls, all-theme reveal markup and extreme three-row bounds. A fresh desktop launch was attempted and still aborted at Chromium GPU startup with 0xC0000135; browser discovery was empty. Therefore animation frame pacing, hover feel, real device-switch transitions and visual comparison require manual confirmation on the Windows desktop. No screenshot-based verification is claimed. The recommended manual checks are fast reveal/leave/re-entry, rapid play/pause and track changes, seek drag beyond the visible body, speaker/headphone/Bluetooth switching, reduced motion and display scaling.

## 1.2.0 separate experimental Liquid Glass

Added a fourth theme without changing the Black Notch default or its saved layout. Liquid Glass has its own dimensions/presets, floating rounded silhouette, circular Glisse play/pause, white progress fill without a thumb, and live blur/refraction/dispersion/tint/FPS/resolution controls. Settings uses a labeled illustrative optical preview; Apply enables actual capture in the dock only.

The existing native EXE supports a dedicated --glass-stream process, separate from GSMTC. It uses a reusable cropped GDI surface, DPI-aware window/monitor bounds, strict WDA_EXCLUDEFROMCAPTURE checks, bounded dimensions and RGBA binary packets. Electron sets exclusion in the owning process. A bounded incremental decoder handles partial packets; one in-flight request, timeouts and child-identity/generation guards prevent stale data after restart. The helper exits on EOF, with a kill timeout as backup. Hidden/fullscreen/lock/suspend states stop it. No screen images are stored or transmitted over the network. Exclusion also hides the dock in compatible screenshots/screen sharing; this tradeoff is explained in Settings and README.

Two WebGL ES 1.00 programs perform separable blur and rounded lens refraction, chromatic separation and edge highlights using the sampled desktop. Coordinate mapping follows physical pixels through UI scale/DPI and reveal motion. Text and playback remain separate readable layers. GPU/native failures produce a labeled fallback, Settings status and Retry. Live status is reported only after a successful frame draw. Native resources, GPU objects, observers and listeners have explicit cleanup; unchanged pixel packets skip renderer texture updates.

Verification: all **22 Node tests passed**, including native rejection of an unexcluded HWND without reading screen pixels, hidden capture lifecycle/fallback, fragmented binary packets, malformed/unexcluded frames, edge refraction coordinates, DPI/animation anchoring, independent theme geometry, settings validation and all-theme revealed markup. Renderer/shared and desktop compatibility typechecks passed. Actual blur and refraction shaders compiled and linked with glslangValidator as GLSL ES 1.00. Production UI/native build and self-contained publish passed. The 1.2.0 portable directory and ZIP were generated; executable icon resource verification matched every supplied ICO frame. These checks do not prove live desktop capture or GPU visual quality.

Native exclusion probe: failed with Access is denied while creating its test window. The separate 16 x 16 desktop-read probe also failed with Access is denied in this managed environment. Therefore real scene capture and exclusion effectiveness remain unverified. Electron startup previously failed with GPU subprocess 0xC0000135, including software mode, and in-app browser discovery was empty. No successful live screenshot, smoothness measurement or optical comparison is claimed. The implementation should be treated as experimental until tested in a normal Windows desktop session.

Additional manual checks for this release:

1. Quit the old tray instance; run 1.2.0, select Liquid Glass and Apply. Hover to reveal; verify actual wallpaper and moving windows are sampled, without repeated dock images. Confirm source/controls still work, and fallback is clearly labeled if capture fails.
2. Run --glass-probe from a normal desktop; require success:true. Check screenshots/screen sharing omit the dock only while Liquid Glass is selected. Confirm switching away restores normal capture.
3. Set blur/refraction/dispersion/tint to zero to inspect scene alignment, then increase optics one at a time. Compare corners, text contrast, chromatic fringes and motion against the reference on light/dark backgrounds.
4. Test rapid enter/leave/reverse, resize settings, monitor hot-plug and 100/125/150/200% mixed DPI. Confirm scene remains desktop-anchored throughout animations.
5. Hide, lock, sleep and use fullscreen: confirm no capture helper remains active. Unlock/resume should restart on the next reveal. Kill the capture helper, use Retry, switch themes and quit; verify no process/resource leak.
6. Measure visible 10/30/60fps and hidden CPU/GPU/memory. Test protected video, remote desktop and HDR; document unsupported hardware/backends instead of claiming universal compatibility.

Future improvements include a GPU-native capture/composition backend to reduce RGBA pipe copying, measured optical tuning/frame pacing, broader Windows capture compatibility and normal release signing/installer work. The simulated older themes and Black Notch remain usable alternatives.

## 1.2.1 attached Liquid Glass

Liquid Glass now joins the screen edge with the same concave quadratic bevel shoulders used by Black Notch, retaining its own glass material and independent dimensions. The canvas, fallback and black-to-transparent shade share an exact SVG path clip. Shader normals follow the attached sides and bottom corners; idle curvature matches the native hit region. A #000 shade starts at the top and fades out near the title, with its endpoint derived from the current typography, padding and track-row layout. The idle dock uses a shorter fade. Content placement remains aligned with the shared native geometry. Transparent shoulder cutouts pass mouse input through, and reveal uses vertical motion without detaching scale at the top.

Settings descriptions now reflect attachment; Liquid Glass layout sliders also expose the full validated liquid ranges instead of the older compact-glass ranges. Renderer/shared and desktop TypeScript checks, production UI bundling, all 22 tests, and GLSL ES 1.00 shader compilation/link passed. The native code is unchanged. The geometry test now exercises attached edge/shoulder/bottom hit regions in both Black Notch and Liquid Glass, with and without a media session. Visual fidelity still requires a normal Windows desktop because the previously documented capture/GPU restrictions remain. Manually check edge attachment, gradient fade near the title, all size presets, idle mode and mixed DPI.

## 1.2.2 prevent the loading-material flash

The user reported a different background for roughly one second before live desktop blur. The code started the native capture process only after revealing the dock, while the renderer displayed its opaque loading/fallback material. Each hide also stopped the process, repeating its startup cost on reopening.

The helper now stays warm while hidden, waiting on stdin with no desktop requests, capture polling or renderer stream. Fullscreen suppression, lock, suspend, changing themes and quit still stop it. Reveal and mouse interception wait for a painted live frame; the handle remains available while preparing. Only an actual failure releases a labeled fallback. The loading material is invisible and the first live canvas does not crossfade from a fake surface. A fresh capture epoch is required each opening; stale paint acknowledgements cannot release it. An unchanged native response on reopening repaints cached pixels only after that fresh read. Short reveal/retract redraws follow actual displayed visibility, keeping the scene anchored throughout the delayed reveal.

All 24 Node tests passed. New regressions exercise helper reuse with zero idle reads, fresh/unchanged frames, stale acknowledgements, pause/suppression cleanup and real component markup for loading/live/fallback visibility with and without media. Renderer/shared and desktop typechecks and production UI bundling passed. No native or optical shader change was required. Actual end-to-end Windows timing and visual startup remain unverified in this managed environment; test cold startup, repeated hover, rapid re-entry, Retry, theme changes and capture failure on the normal desktop. Initialization can still take time; the change prevents displaying a different loading background while waiting.

## 1.2.3 softer play surface and glass edges

Removed the generated Glisse rim map from the Liquid Glass play button background, disabled its rim shine and edge color locally, and replaced the directional highlight with broad, very faint illumination and a soft black perimeter gradient. Glisse backdrop refraction and button interactions remain. The dock shader now adds 7.5% maximum black shading at the contour, decaying exponentially over 13 logical pixels inward. It follows bevel shoulders, sides and rounded lower corners without shading the separate text/control layers. The existing top-to-title black fade remains.

Renderer/shared and desktop TypeScript checks, production UI bundling, all 24 Node tests, and both GLSL ES 1.00 shader compilation/link checks passed. Live visual comparison still requires a normal desktop under the previously documented GPU/capture restrictions.

## 1.2.4 capture-exclusion recovery

The user reported the exact native failure: Desktop capture stopped: the dock is not excluded from capture. The previous main process applied content protection once and cached the theme flag. It did not reassert protection after showing the window or repair a later exclusion-guard failure. This identifies the failed safeguard; the exact Windows affinity/query result was not present in the old error.

The owning Electron process now force-refreshes exclusion after layout/show, through the tray reveal action, and on Retry. A native exclusion failure stops its helper before requesting repair, reapplies protection in the owner, waits 120/240 ms and retries at most twice. No unsafe frame bypass is allowed; persistent failure remains fallback. The native guard now reports the actual affinity or Win32 query error. Capture failures are logged to a bounded app-data diagnostic file without screen images or media metadata. Child exit diagnostics and GPU compile/link/draw errors now identify their stage.

Retry also replaces the canvas, so it does not reuse a lost WebGL context. Disconnected preview/retry canvases explicitly release contexts after cleanup; a still-connected canvas is retained for development StrictMode reuse. These address recovery/resource weaknesses found during review, not a claim that a GPU fault caused this reported exclusion error.

Renderer/shared and desktop TypeScript checks, production UI/native builds and all 25 tests passed. The new fixture regression verifies an exclusion failure invokes owner repair, waits without another read, accepts a subsequent verified frame, and eventually stops on persistent failures. The real native invalid-HWND guard continues to reject capture. Live Windows exclusion recovery remains to be checked on the normal desktop because the managed environment still cannot exercise it. This release retains the softened play surface, subtle edge shading and first-frame reveal gating.

## 1.2.5 adjustable border shading and depth

The user confirmed 1.2.4 restores working desktop glass. Added independent Glass edges controls in Appearance: Black edge shade (default 35%, range 0-100) and Edge warping (default 55%, range 0-100). Both are validated, persisted and previewed through the existing draft/Apply workflow. Missing preferences receive defaults; invalid numbers and out-of-range values recover safely.

The shade follows the glass signed distance and fades inward over 18 logical pixels, with an intensity range from no shade to 40% black at the contour (14% at the default slider value). Edge warping now controls the actual normal-directed desktop sample displacement independently of subtle full-surface magnification. At the default, edge bend is around 29% stronger than the previous fixed relationship; zero removes this bend. Color separation remains separately adjustable. Settings renames the previous Lens strength control to Lens magnification to describe its remaining surface-wide effect accurately. The top-to-title black fade remains separate. Text and controls are not distorted or shaded by the backdrop shader.

Renderer/shared and desktop TypeScript checks, production UI bundling, all 25 tests and compilation/linking of both GLSL ES 1.00 programs passed. Existing optics tests now verify independent edge displacement, an unaffected flat center, preference clamp/recovery and JSON roundtrip. New visual intensity and motion tuning still need the normal Windows desktop; no live screenshot or measured frame pacing was verified here. The working native capture/exclusion path is unchanged.

## 1.2.6 Liquid Glass startup and hover recovery

The user reported intermittent loss of hover reveal and a solid fallback when launching directly into saved Liquid Glass settings. The local diagnostic log repeatedly reported capture exclusion affinity 0x0. Code review identified multiple lifecycle weaknesses.

Electron 41.2.1 SetIgnoreMouseEvents(false) removes WS_EX_LAYERED unless its persistent layered flag is set. Removing this native style can invalidate capture protection. The overlay now calls setOpacity(1) before configuring mouse pass-through, which uses Electron's supported SetLayered path while preserving full window alpha; input transitions also reapply content protection. This is based on the shipped Electron source, not a claimed observation of live Windows style changes here. Source: https://github.com/electron/electron/blob/v41.2.1/shell/browser/native_window_views.cc#L1194-L1218 . The native exclusion check remains mandatory.

The capture controller previously treated forwarding pixels as a paint acknowledgement. If the first renderer draw was skipped or lost, subsequent unchanged native frames were never forwarded again, leaving the reveal gate waiting indefinitely. It now resends verified cached pixels after fresh unchanged responses until paint is acknowledged. Renderer feedback carries a revision so a disposed context cannot invalidate a newer session. A missing readiness/paint acknowledgement gets one rebuild after five seconds, then a visible fallback after another five seconds rather than staying hidden indefinitely. Capture/renderer failure can retry on the next deliberate hover. Theme changes explicitly invalidate old state.

A late getState response could also overwrite a newer subscribed settings/capture snapshot; initial-state delivery now rejects that stale response. The dock keeps its renderer responsive while fully hidden without running capture or progress animations. Renderer crashes/unresponsiveness trigger throttled reloads, and the tray adds Recover dock for explicit recovery. IPC sends avoid unloaded/crashed renderer frames; global cursor polling continues after transient window/display exceptions.

Verification: both TypeScript checks and production UI/main bundling passed. All 33 tests passed, including eight new cases for first-frame redelivery, bounded preparation, capture retry on hover, stale revision rejection, startup snapshot ordering and Electron-style layered-window/input transitions. Existing native rejection, protocol, optics, hover state-machine and layout tests remain passing. Shader compilation/link validation also passed. Native media/capture code is unchanged.

A diagnostic launch using a separate workspace profile with Liquid Glass selected was attempted. Electron's GPU subprocess still exited with 0xC0000135 in this managed environment and the app aborted before usable desktop rendering; no successful live startup or hover verification is claimed. The window-style test is a model of Electron's implementation, not a Win32 integration test. Manual checks: cold-start with saved Liquid Glass plus fully hidden mode; repeated hover/interact/hide; missing first draw; switch themes after fallback; sleep/lock/resume; kill the capture helper; and use tray Recover dock. Check CPU/GPU idle behavior with background throttling disabled, since no measured resource budget is claimed.

## Additional 1.2.6 optical enhancements

The release version remains 1.2.6 at the user's request. This enhancement is based on the committed startup/hover fix, not the older local main. Play button refraction (0-100%, default 65) and Lower-edge reflections (0-100%, default 35) are independent validated, persistent settings under Appearance > Layered glass. Zero disables each new effect.

The play/pause surface now has a second circular shader lens. Its rim maps the existing dock background through another radial displacement before the outer dock refraction is evaluated. The button's actual DOM bounds drive its center/radius in the glass coordinate system, accounting for UI scale, reveal translation and hover/press transforms. The icon remains a sharp DOM layer. The button keeps Glisse interaction behavior but avoids applying a second CSS/SVG backdrop filter over the GPU result. No bright white rim arc was added.

Lower reflections sample the original captured desktop just outside the lower contour. A normal-directed mirrored sample is blended into a narrow inward-fading band, with a modest corner emphasis. This is a screen-space approximation of a beveled reflection, not 3D scene reconstruction or Apple's native material. Reflections depend on the nearby desktop colors and detail. The existing bounded capture margin supplies the scene; no additional screen recording or capture service is used.

Short pointer-event animation frames keep the circular lens aligned during hover/press, stop after 520ms, clean up on unmount and respect hidden/reduced-motion states. There is no permanent new animation loop or extra WebGL context.

Validation: all 36 Node tests passed, including radial symmetry/strength and no-op behavior, circle alignment through scaling/reveal/hover, preference clamp/recovery/persistence and actual rendered marker scoping to Liquid Glass. Both TypeScript checks and production UI/main builds passed. The actual blur and enhanced refraction shaders compiled and linked as GLSL ES 1.00. GPU visual quality and real motion/reflection fidelity require manual Windows verification under the previously documented environment restrictions.

The packager accepts an optional validated DOCK_PACKAGE_SUFFIX, allowing a same-version optics build without overwriting the running 1.2.6 copy. Normal package names are unchanged when the suffix is absent. The optics artifact uses MusicPlayerDock-1.2.6-optics-win-x64 while its app metadata remains version 1.2.6.

## Additional reflection-depth control (version remains 1.2.6)

Renamed Lower-edge reflections to Reflection intensity and added a separate Reflection depth slider (0-100%, default 35) under Appearance > Layered glass. Intensity controls the contribution/brightness of the sampled scene; zero disables reflection. Depth changes the inward falloff width and the normal-directed sampling footprint, suggesting a thinner or thicker lower bevel without changing reflection brightness. The default remains close to the previous fixed band. Both values validate, persist and update the preview independently.

The depth range interpolates from 2 logical pixels to the lesser of 16 pixels or 40% of the corner radius; the adjacent scene offset varies from 10 to 34 logical pixels. Sampling stays within the existing cropped scene texture, with normal texture-coordinate clamping at capture/display limits. The effect remains a screen-space approximation. Visual tuning needs the normal Windows desktop; no ray-traced or native Apple material is claimed.
