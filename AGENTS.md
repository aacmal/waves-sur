# Agent instructions

## Windows project execution

This repository is stored on a Windows filesystem and may be accessed from WSL. Never run or
install the project toolchain inside WSL. This includes `node`, `npm`, `npx`, Vite, development
servers, tests, type checks, linting, builds, and previews. Do not create a WSL-native
`node_modules` directory or modify the lockfile using a WSL toolchain.

Use WSL only for inspection, editing, Git operations, and path conversion. Run project commands
through Windows `cmd.exe`:

```bash
project_win_path="$(wslpath -w "$PWD")"
cmd.exe /d /c "cd /d $project_win_path && <project-command>"
```

Standard validation:

```bash
project_win_path="$(wslpath -w "$PWD")"
cmd.exe /d /c "cd /d $project_win_path && npm run check"
cmd.exe /d /c "cd /d $project_win_path && npm run lint"
cmd.exe /d /c "cd /d $project_win_path && npm run build"
```

If a Windows command fails, diagnose the Windows failure. Never fall back to WSL-native package
commands.

## Project rules

- Keep static SEO metadata in `index.html`.
- Use Tailwind CSS for layout and component styling. Keep native CSS only for theme variables,
  browser-specific range pseudo-elements, and behavior Tailwind cannot express clearly.
- Keep the generator deterministic and ensure SVG, JPG, and After Effects JSX exports consume the
  same generated scene.
- Per-layer color overrides are optional six-digit hex colors keyed by stable layer ids (for
  example, `wave-02`). Apply them in the generator so the preview and all exporters stay aligned;
  an override becomes that layer's color base while preserving gradient variation from the HSL
  controls.
- Preserve responsive canvas sizing, including portrait canvases constrained to viewport height.
- Preserve saved custom colors and their removal behavior in local storage.
