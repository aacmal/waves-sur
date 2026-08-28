# Waves Vite

A single-page React application for creating deterministic layered wave artwork and exporting it
as SVG, JPG, or After Effects JSX. The application is built with Vite and runs entirely in the
browser.

## Windows commands

This project lives on a Windows filesystem. Run its toolchain through Windows `cmd.exe`, including
when working from WSL:

```bash
project_win_path="$(wslpath -w "$PWD")"
cmd.exe /d /c "cd /d $project_win_path && npm run dev"
cmd.exe /d /c "cd /d $project_win_path && npm run check"
cmd.exe /d /c "cd /d $project_win_path && npm run lint"
cmd.exe /d /c "cd /d $project_win_path && npm run build"
```

Do not install packages or run Node, npm, Vite, validation, or build commands through the WSL
toolchain.

## Structure

- `index.html` contains the static SEO metadata and application mount point.
- `src/App.tsx` contains the generator, controls, preview, and exporters.
- `src/index.css` contains the complete responsive visual system.
- `src/main.tsx` mounts the React application.
