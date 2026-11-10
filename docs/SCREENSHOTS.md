# Product images

The README has four reserved image spaces. They currently show neutral SVG placeholders, so it renders without broken images before the product photos are ready.

Save the finished images in **docs/images/**. Use the exact PNG names below, then replace the corresponding `-placeholder.svg` image paths in README.md with `.png`. The HTML comments beside each image mark its position.

| Image location | Recommended size | What it should show |
| --- | --- | --- |
| `docs/images/hero.png` | 1600 x 900 | The main product image. Present Liquid Glass and Black Notch against the same clean Windows wallpaper. Use two separate captures arranged side by side, with space around the docks. Keep their connection to the top screen edge visible. |
| `docs/images/liquid-glass.png` | 1280 x 720 | A closer view of the live Liquid Glass dock while a real track is playing. Choose a wallpaper with a gentle curve or distinct tonal boundary behind the edges so blur and warping are visible. Include artwork, title, timeline, controls and the top bevel. |
| `docs/images/black-notch.png` | 1280 x 720 | The Black Notch dock playing the same track, at a similar size and crop to the glass image. Show the pure-black surface, attached shoulders, rounded bottom corners and complete playback row. |
| `docs/images/settings.png` | 1440 x 1000 | The Settings window with the Liquid Glass Appearance page selected. Show the preview and the Black edge shade / Edge warping sliders clearly. If they do not fit legibly, combine two real Settings captures into one image; keep labels readable. |

## Replace the image references

| Current README image | Finished image |
| --- | --- |
| `docs/images/hero-placeholder.svg` | `docs/images/hero.png` |
| `docs/images/liquid-glass-placeholder.svg` | `docs/images/liquid-glass.png` |
| `docs/images/black-notch-placeholder.svg` | `docs/images/black-notch.png` |
| `docs/images/settings-placeholder.svg` | `docs/images/settings.png` |

Update the matching alt text to describe the finished photo rather than a reserved space. The placeholder SVGs can be removed after the PNGs are in place and no README image references them.

## Capturing Liquid Glass accurately

The live Liquid Glass dock is excluded from compatible screen-capture tools to prevent capture feedback. A normal screenshot or screen recording may omit the dock and show the content behind it.

For a photo of the actual live effect, photograph the display with an external camera. Keep the camera square to the display and crop carefully. Do not disable capture exclusion: the dock can begin capturing its own rendered image.

The Settings material preview can be captured normally, but it uses an illustration rather than the live desktop. If you use that view for an image, identify it as an **illustrated preview** in the README caption and alt text. Do not present it as proof of live background refraction.

Black Notch can be captured with a normal screenshot. The Settings window can also be captured normally.

## Keep the set consistent

- Use the same wallpaper, track and album artwork for the two dock images.
- Keep enough desktop around each dock to show its position and screen-edge attachment.
- Use moderate glass settings so the controls remain readable and edge depth is easy to see.
- Keep the pointer away from controls unless the image is specifically demonstrating a hover state.
- Export at the recommended aspect ratios and avoid stretching or upscaling small captures.

These images are documentation assets. They are not included in the application interface.
