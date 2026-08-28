<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Wave / Lab — Agent Handoff Guide

This document is the source of truth for agents working in this repository. The project is a
standalone Next.js web application for generating deterministic, layered procedural wave artwork.
Do not assume context from another repository or another conversation; inspect this project first.

## Windows project execution

This repository is stored on a Windows filesystem and may be accessed by an agent running in WSL.
Never run or install the project toolchain inside WSL. This includes `node`, `npm`, `npx`, package
installation, Next.js commands, dev servers, tests, type checks, linting, builds, and previews.
Do not create a WSL-native `node_modules` directory or modify the lockfile using a WSL toolchain.

WSL may be used for read-only inspection, editing source files, Git inspection, and converting the
current path. Run every project command with the Windows environment through `cmd.exe`:

```bash
project_win_path="$(wslpath -w "$PWD")"
cmd.exe /d /c "cd /d $project_win_path && <project-command>"
```

Examples:

```bash
project_win_path="$(wslpath -w "$PWD")"
cmd.exe /d /c "cd /d $project_win_path && npm run dev"
cmd.exe /d /c "cd /d $project_win_path && npm run check"
cmd.exe /d /c "cd /d $project_win_path && npm run lint"
cmd.exe /d /c "cd /d $project_win_path && npm run build"
```

If dependencies must be installed or changed, use the same Windows `cmd.exe` pattern and only do
so when the user has explicitly requested or authorized the dependency change. Never fall back to
WSL-native package commands when a Windows command fails; diagnose or report the Windows failure.

## Project identity

- Name: `waves`
- Root: `Q:\\repositories\\waves`
- Framework: Next.js `16.3.3` App Router
- UI runtime: React `19.2.8` and TypeScript
- Styling: Tailwind CSS v4 import plus handcrafted CSS in `app/globals.css`
- Fonts: `Space_Grotesk` and `DM_Mono` through `next/font/google`
- Rendering: entirely client-side in the single route `/`
- External services: none; generation is deterministic and local

The current product is intentionally a one-page playground. Keep the generator immersive and
full-width: a large artboard occupies the main area and controls live in a scrollable sidebar.
There is no hero section. Avoid replacing the visual language with generic dashboard cards, a
marketing landing page, or a default component-library layout.

## Repository map

```text
app/
├── globals.css   # Theme tokens, responsive layout, controls, artboard styling
├── layout.tsx    # Root metadata, next/font setup, global CSS import
└── page.tsx     # Client page, generator, preview, controls, and exporters
public/           # Static assets, currently minimal
package.json      # Scripts and dependencies
tsconfig.json     # TypeScript settings; ES2020 is required for BigInt literals
```

The primary implementation file is deliberately `app/page.tsx`. Do not split the page into
multiple routes unless the user explicitly requests a new navigation structure.

## Next.js working rule

This repository uses a Next.js version with breaking changes from older examples. Before writing
Next.js code, read the relevant guide under `node_modules/next/dist/docs/`, resolved relative to
this repository. At minimum, consult the relevant App Router page/layout, client component, CSS,
font, and interactive-app guidance for a UI change. Keep the generated `next dev` agent-rules
block in this file intact.

## Visual direction

The intended design language is closer to a focused creative tool than a SaaS dashboard:

- dark mode is the default; light mode is available through the top-bar theme toggle;
- the artboard is the visual priority and stretches across the available main column;
- the right sidebar contains compact, labeled controls with sliders and numeric fields;
- typography uses the loaded display and mono fonts, not browser defaults;
- use thin borders, restrained labels, strong spacing, and visible interaction states;
- preserve the current wave canvas, layer hover highlighting, guide toggle, reset action, and
  responsive mobile stacking;
- keep all controls keyboard-accessible and retain visible focus states.

When changing the UI, inspect the existing tokens and neighboring selectors in
`app/globals.css` before introducing new patterns. Keep theme overrides working in both
`.theme-dark` and `.theme-light`.

## Generator model

The generator is deterministic: the same parameters always produce the same scene.

### Parameters

`WaveParameters` currently contains:

- `width` and `height`: output resolution in pixels, clamped to `240..5000`;
- `seed`: integer seed used by the deterministic random source;
- `numberOfWaves`: layer count, `1..32`;
- `hueRange`: hue drift across the stack, `0..360` degrees;
- `saturation`: relative saturation, `0..100` percent;
- `lightness`: relative lightness, `0..100` percent;
- `baseColor`: six-digit hex base color;
- `backgroundColor`: six-digit hex background color.

The default scene is `1920 × 1080`, seed `199`, five waves, hue range `60`, saturation `60`,
lightness `50`, base `#6d63ff`, and background `#11121c`.

### Geometry

The current algorithm uses five top-edge points per wave. X positions are shared across layers
and receive deterministic jitter except at the two edges. Each layer then generates a sloped,
randomized Y position, enforces a minimum gap from the previous layer, and clamps the normalized
Y range. The top edge is smoothed with cubic Bézier segments using a Catmull–Rom-style factor of
`1 / 6`; the path is closed with bottom-right and bottom-left canvas corners.

`WaveLayer` stores both representations:

- `path`: serialized SVG path data used by the browser preview and SVG/JPG exporters;
- `shape`: vertices, incoming tangents, and outgoing tangents used to build the After Effects
  vector mask;
- `gradient`: start/end colors and absolute start/end points.

The deterministic random source is implemented by `StableRandom` with 64-bit BigInt arithmetic.
Do not replace it with `Math.random()` or change its constants casually; that would make existing
seeds produce different artwork. If the algorithm changes, compare the browser preview, SVG, JPG,
and JSX output for the same seed before handing off.

## Resolution and preview behavior

Width and height inputs use draft strings so users can type multi-digit values without the first
partial value being clamped prematurely. The draft is committed on blur and then clamped to
`240..5000`. Preset buttons and reset must update both the numeric parameters and draft strings.

The preview is responsive but must preserve the output aspect ratio:

```text
canvasRatio = width / height
canvasWidth = min(available preview width, viewport width × canvasRatio)
canvasHeight = canvasWidth / canvasRatio
```

`canvasViewportRef` uses `ResizeObserver`; `.canvas-viewport` has a maximum height of `100vw`.
Portrait canvases therefore reduce their display width to stay within that height instead of being
stretched or cropped. The displayed preview is scaled to fit the screen; export dimensions remain
the exact user-defined pixel dimensions.

## Exporters

All exporters consume the same generated `WaveScene`.

### SVG

`sceneToSvg()` emits a standalone SVG with the requested `width`, `height`, and `viewBox`, one
linear gradient per wave, one direct `<path>` per wave, and a background `<rect>`. Keep wave paths
as separate elements so vector applications can identify them individually.

### JPG

`exportJpg()` serializes the same SVG, renders it into a canvas at the requested pixel dimensions,
and downloads a JPEG at quality `0.96`. Keep the background fill because JPEG has no transparency.

### After Effects JSX

`sceneToAfterEffectsJsx()` embeds the scene geometry and colors into a self-contained ExtendScript
file. The generated script:

1. creates a composition at the requested width and height;
2. creates a background solid;
3. creates one full-size editable layer per wave;
4. adds a vector `Wave Path` mask using the exported vertices and Bézier tangents;
5. adds an editable `Wave Gradient` effect with the exact start/end colors and points;
6. opens the composition for the user.

The current JSX approach intentionally uses a solid layer plus vector mask plus `Gradient Ramp`.
This preserves colors more reliably than setting Shape Layer `Gradient Colors`, which is not
consistently writable across After Effects versions. Do not silently revert to a solid-color-only
fallback. A browser cannot create a native `.aep` directly; `.jsx` is the handoff format that the
user runs from `File → Scripts → Run Script File` and then saves as an `.aep` project.

## Interaction and state conventions

- Keep `generateWaveScene(parameters)` pure and memoized from page state.
- Do not put browser-only APIs such as `window`, `Image`, `Blob`, `ResizeObserver`, or
  `URL.createObjectURL` in server-rendered code; the page is a client component.
- Revoke object URLs after downloads/renders.
- Keep export buttons disabled while an asynchronous export is running.
- Preserve deterministic seed behavior when changing colors, resolution, layer count, or HSL
  controls.
- When adding a parameter, update the type, default state, generator, preview, and every relevant
  exporter together.
- Keep text labels and aria labels descriptive; controls should remain usable without hover.

## Validation workflow

Use the Windows project path and Windows Node toolchain for all validation commands:

```bash
project_win_path="$(wslpath -w "$PWD")"
cmd.exe /d /c "cd /d $project_win_path && npm run check"
cmd.exe /d /c "cd /d $project_win_path && npm run lint"
cmd.exe /d /c "cd /d $project_win_path && npm run build"
```

For a local visual check, start the server through Windows, then inspect `http://localhost:3000`:

```bash
project_win_path="$(wslpath -w "$PWD")"
cmd.exe /d /c "cd /d $project_win_path && npm run dev"
```

Exercise at least:

- width/height typing, including typing `1920` from an empty field;
- minimum/maximum resolution clamping on blur;
- wide, square, and portrait presets;
- changing wave count, seed, palette, and HSL controls;
- light/dark theme toggle;
- guide toggle and layer hover highlighting;
- SVG, JPG, and AE JSX download actions.

Also run `git diff --check`. Line-ending conversion warnings from Git are acceptable; actual
whitespace errors are not.

## Handoff checklist

Before handing this project to another agent, report:

- the files changed and the user-visible behavior changed;
- whether the generator algorithm or only presentation/export changed;
- the validation commands that passed;
- any limitation that requires testing in an installed After Effects version;
- any uncommitted changes that predated the current task.

Keep this document updated whenever the route structure, parameter model, export format, or
validation workflow changes.
