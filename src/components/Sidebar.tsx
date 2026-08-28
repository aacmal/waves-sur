import { useEffect, useState } from "react";
import type { ChangeEvent, Dispatch, SetStateAction } from "react";
import { Icon, RangeControl } from "./Controls";
import {
  COLOR_SWATCHES,
  DEFAULT_PARAMETERS,
  PRESETS,
  SAVED_COLORS_KEY,
} from "../lib/wave-engine";
import type { WaveParameters } from "../lib/wave-engine";

export type ExportState = "idle" | "svg" | "jpg" | "jsx";

type SidebarProps = {
  parameters: WaveParameters;
  setParameters: Dispatch<SetStateAction<WaveParameters>>;
  exportState: ExportState;
  onExportSvg: () => void;
  onExportJpg: () => void;
  onExportAfterEffects: () => void;
};

const surface =
  "rounded-[18px] border border-black/12 bg-black/[0.026] dark:border-white/8 dark:bg-white/[0.026]";
const field =
  "relative block min-h-16 min-w-0 rounded-xl border border-transparent bg-[#e1e2e7] px-3 py-2.5 transition focus-within:border-[#3948d785] focus-within:ring-3 focus-within:ring-[#3948d714] dark:bg-[#242632] dark:focus-within:border-[#d8ff7285] dark:focus-within:ring-[#d8ff7214]";

export function Sidebar({
  parameters,
  setParameters,
  exportState,
  onExportSvg,
  onExportJpg,
  onExportAfterEffects,
}: SidebarProps) {
  const [isDarkTheme, setIsDarkTheme] = useState(true);
  const [savedColors, setSavedColors] = useState<string[]>(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(SAVED_COLORS_KEY) ?? "[]");
      return Array.isArray(stored)
        ? stored.filter(
            (color): color is string =>
              typeof color === "string" && /^#[0-9a-f]{6}$/i.test(color),
          )
        : [];
    } catch {
      return [];
    }
  });
  const [dimensionDrafts, setDimensionDrafts] = useState({
    width: String(parameters.width),
    height: String(parameters.height),
  });

  useEffect(() => {
    document.documentElement.classList.toggle("dark", isDarkTheme);
    return () => document.documentElement.classList.remove("dark");
  }, [isDarkTheme]);

  const updateParameter = <K extends keyof WaveParameters>(
    key: K,
    value: WaveParameters[K],
  ) => setParameters((current) => ({ ...current, [key]: value }));

  const applyDimensions = (width: number, height: number) => {
    setParameters((current) => ({ ...current, width, height }));
    setDimensionDrafts({ width: String(width), height: String(height) });
  };

  const commitDimension = (key: "width" | "height") => {
    const parsed = Number(dimensionDrafts[key]);
    const value = Number.isFinite(parsed)
      ? Math.min(5000, Math.max(240, Math.round(parsed)))
      : DEFAULT_PARAMETERS[key];
    setDimensionDrafts((current) => ({ ...current, [key]: String(value) }));
    updateParameter(key, value);
  };

  const resetParameters = () => {
    setParameters(DEFAULT_PARAMETERS);
    setDimensionDrafts({
      width: String(DEFAULT_PARAMETERS.width),
      height: String(DEFAULT_PARAMETERS.height),
    });
  };

  const saveCustomColor = (color: string) => {
    const normalized = color.toLowerCase();
    if (COLOR_SWATCHES.includes(normalized)) return;
    setSavedColors((current) => {
      const next = [
        normalized,
        ...current.filter((item) => item !== normalized),
      ].slice(0, 12);
      localStorage.setItem(SAVED_COLORS_KEY, JSON.stringify(next));
      return next;
    });
  };

  const removeSavedColor = (color: string) => {
    setSavedColors((current) => {
      const next = current.filter((item) => item !== color);
      localStorage.setItem(SAVED_COLORS_KEY, JSON.stringify(next));
      return next;
    });
  };

  return (
    <aside className="flex h-[calc(100vh-76px)] min-h-0 min-w-0 flex-col overflow-hidden rounded-l-[26px] border border-black/12 bg-white/60 shadow-[0_18px_50px_rgb(32_35_48/10%)] backdrop-blur-2xl max-[900px]:h-auto max-[900px]:rounded-none dark:border-white/8 dark:bg-[#151620]/92 dark:shadow-[0_18px_54px_rgb(0_0_0/24%)]">
      <div className="flex min-h-16 shrink-0 items-center justify-between px-4 pb-2.5 pt-3 max-[680px]:px-3">
        <span className="font-mono text-xs font-medium tracking-wide text-[#3948d7] dark:text-[#d8ff72]">
          Parameters
        </span>
        <div className="flex gap-2">
          <button
            className="flex min-h-9 items-center gap-2 rounded-xl border border-transparent bg-[#e1e2e7] dark:bg-[#242632] px-3 font-mono text-[11px] uppercase tracking-wide text-[#555966] dark:text-[#b4b4bd] transition hover:-translate-y-px hover:border-black/20 dark:hover:border-white/14 hover:text-[#3948d7] dark:hover:text-[#d8ff72] max-[680px]:w-9 max-[680px]:justify-center max-[680px]:p-0"
            type="button"
            onClick={() => setIsDarkTheme((value) => !value)}
            aria-label={`Switch to ${isDarkTheme ? "light" : "dark"} theme`}
          >
            <Icon name="theme" />
            <span className="max-[680px]:hidden">
              {isDarkTheme ? "Light" : "Dark"}
            </span>
          </button>
          <button
            className="grid size-9 place-items-center rounded-xl border border-transparent bg-[#e1e2e7] dark:bg-[#242632] text-[#555966] dark:text-[#b4b4bd] transition hover:-translate-y-px hover:border-black/20 dark:hover:border-white/14 hover:text-[#3948d7] dark:hover:text-[#d8ff72]"
            type="button"
            onClick={resetParameters}
            aria-label="Reset parameters"
            title="Reset parameters"
          >
            <Icon name="reset" />
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto px-3 pb-4 pt-1 [scrollbar-color:rgba(255,255,255,.14)_transparent] scrollbar-thin max-[900px]:grid max-[900px]:grid-cols-3 max-[900px]:gap-2.5 max-[680px]:block max-[680px]:px-2.5 max-[680px]:pb-2.5">
        <section
          className={`${surface} mb-2.5 p-4 max-[900px]:m-0 max-[680px]:mb-2 max-[680px]:p-3.5`}
        >
          <h2 className="mb-3.5 text-base font-medium tracking-tight">
            Canvas
          </h2>
          <div className="mb-2.5 grid grid-cols-3 gap-2">
            {PRESETS.map((preset) => {
              const selected =
                parameters.width === preset.width &&
                parameters.height === preset.height;
              return (
                <button
                  key={preset.label}
                  className={`flex min-h-14 min-w-0 flex-col items-start justify-center gap-1 rounded-xl border px-2.5 py-2 text-left font-mono text-[11px] uppercase transition ${selected ? "border-[#3948d773] dark:border-[#d8ff7273] bg-[#3948d71f] dark:bg-[#d8ff721f] text-[#3948d7] dark:text-[#d8ff72]" : "border-transparent bg-[#e1e2e7] dark:bg-[#242632] text-[#555966] dark:text-[#b4b4bd] hover:border-black/20 dark:hover:border-white/14 hover:text-[#171923] dark:hover:text-white"}`}
                  type="button"
                  onClick={() => applyDimensions(preset.width, preset.height)}
                >
                  <span>{preset.label}</span>
                  <small className="max-w-full overflow-hidden text-ellipsis whitespace-nowrap text-[10px] normal-case tracking-tight opacity-70">
                    {preset.width} × {preset.height}
                  </small>
                </button>
              );
            })}
          </div>
          <div className="grid grid-cols-2 gap-2">
            {(["width", "height"] as const).map((key) => (
              <label className={field} key={key}>
                <span className="mb-1.5 block font-mono text-[11px] uppercase tracking-wide text-[#555966] dark:text-[#b4b4bd]">
                  {key}
                </span>
                <input
                  className="w-[calc(100%-22px)] appearance-none border-0 bg-transparent p-0 font-mono text-sm font-medium text-[#171923] dark:text-white outline-none"
                  type="number"
                  min="240"
                  max="5000"
                  inputMode="numeric"
                  value={dimensionDrafts[key]}
                  onChange={(event) =>
                    setDimensionDrafts((current) => ({
                      ...current,
                      [key]: event.target.value,
                    }))
                  }
                  onBlur={() => commitDimension(key)}
                />
                <small className="absolute bottom-3 right-3 font-mono text-[10px] text-[#858792]">
                  px
                </small>
              </label>
            ))}
          </div>
        </section>

        <section
          className={`${surface} mb-2.5 p-4 max-[900px]:m-0 max-[680px]:mb-2 max-[680px]:p-3.5`}
        >
          <h2 className="mb-3.5 text-base font-medium tracking-tight">
            Structure
          </h2>
          <div className="mb-[18px] flex gap-2">
            <label className={`${field} flex-1`}>
              <span className="mb-1.5 block font-mono text-[11px] uppercase tracking-wide text-[#555966] dark:text-[#b4b4bd]">
                Seed
              </span>
              <input
                className="w-full border-0 bg-transparent p-0 font-mono text-sm font-medium text-[#171923] dark:text-white outline-none"
                type="number"
                value={parameters.seed}
                onChange={(event: ChangeEvent<HTMLInputElement>) =>
                  updateParameter(
                    "seed",
                    Number.isFinite(Number(event.target.value))
                      ? Math.trunc(Number(event.target.value))
                      : DEFAULT_PARAMETERS.seed,
                  )
                }
              />
            </label>
            <button
              className="grid w-12 place-items-center rounded-xl border border-transparent bg-[#e1e2e7] dark:bg-[#242632] text-[#555966] dark:text-[#b4b4bd] transition hover:-translate-y-px hover:border-black/20 dark:hover:border-white/14 hover:text-[#3948d7] dark:hover:text-[#d8ff72]"
              type="button"
              onClick={() =>
                updateParameter("seed", Math.floor(Math.random() * 99999) + 1)
              }
              aria-label="Randomize seed"
              title="Randomize seed"
            >
              <Icon name="dice" />
            </button>
          </div>
          <RangeControl
            label="waves"
            value={parameters.numberOfWaves}
            min={1}
            max={32}
            step={1}
            displayValue={String(parameters.numberOfWaves).padStart(2, "0")}
            onChange={(value) => updateParameter("numberOfWaves", value)}
            accent={parameters.baseColor}
          />
        </section>

        <section
          className={`${surface} mb-2.5 p-4 max-[900px]:m-0 max-[680px]:mb-2 max-[680px]:p-3.5`}
        >
          <h2 className="mb-3.5 text-base font-medium tracking-tight">
            Color field
          </h2>
          <div className="mb-3 flex items-center gap-2">
            <label className="flex min-h-10 flex-1 cursor-pointer items-center gap-2 overflow-hidden rounded-xl border border-transparent bg-[#e1e2e7] dark:bg-[#242632] py-1.5 pl-1.5 pr-2.5 font-mono text-[11px] text-[#555966] dark:text-[#b4b4bd] transition hover:-translate-y-px hover:border-black/20 dark:hover:border-white/14">
              <input
                className="absolute size-px opacity-0"
                type="color"
                value={parameters.baseColor}
                onChange={(event) =>
                  updateParameter("baseColor", event.target.value)
                }
                onBlur={() => saveCustomColor(parameters.baseColor)}
                aria-label="Base color"
              />
              <span
                className="block size-7 rounded-lg border border-white/15"
                style={{ backgroundColor: parameters.baseColor }}
              />
              <span>{parameters.baseColor.toUpperCase()}</span>
            </label>
          </div>
          <div
            className="mb-[18px] flex flex-wrap gap-2"
            aria-label="Color presets"
          >
            {COLOR_SWATCHES.map((color) => (
              <ColorSwatch
                key={color}
                color={color}
                selected={parameters.baseColor === color}
                onSelect={() => updateParameter("baseColor", color)}
              />
            ))}
          </div>
          {savedColors.length > 0 && (
            <div className="mb-[22px] border-t border-white/8 pt-3">
              <span className="mb-2 block font-mono text-[11px] uppercase tracking-wide text-[#858792]">
                Saved colors
              </span>
              <div className="flex flex-wrap gap-2">
                {savedColors.map((color) => (
                  <div className="group relative" key={color}>
                    <ColorSwatch
                      color={color}
                      selected={parameters.baseColor === color}
                      onSelect={() => updateParameter("baseColor", color)}
                    />
                    <button
                      className="absolute -right-1.5 -top-1.5 grid size-4 scale-80 place-items-center rounded-full border-2 border-[#151620] bg-white p-0 text-xs leading-none text-[#0b0c12] opacity-0 transition group-hover:scale-100 group-hover:opacity-100 focus:scale-100 focus:opacity-100 max-[680px]:scale-100 max-[680px]:opacity-100"
                      type="button"
                      onClick={() => removeSavedColor(color)}
                      aria-label={`Remove saved color ${color}`}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
          <RangeControl
            label="hue-range"
            value={parameters.hueRange}
            min={0}
            max={360}
            step={1}
            displayValue={`${parameters.hueRange}°`}
            onChange={(value) => updateParameter("hueRange", value)}
            accent={parameters.baseColor}
          />
          <RangeControl
            label="saturation"
            value={parameters.saturation}
            min={0}
            max={100}
            step={1}
            displayValue={`${parameters.saturation}%`}
            onChange={(value) => updateParameter("saturation", value)}
            accent={parameters.baseColor}
          />
          <RangeControl
            label="lightness"
            value={parameters.lightness}
            min={0}
            max={100}
            step={1}
            displayValue={`${parameters.lightness}%`}
            onChange={(value) => updateParameter("lightness", value)}
            accent={parameters.baseColor}
          />
        </section>
      </div>

      <section
        className={`${surface} m-3 mt-0 shrink-0 p-4 max-[680px]:m-2.5 max-[680px]:mt-0 max-[680px]:p-3.5`}
      >
        <span className="mb-3 block font-mono text-xs font-medium tracking-wide text-[#3948d7] dark:text-[#d8ff72]">
          Export
        </span>
        <div className="grid grid-cols-2 gap-2">
          <ExportButton
            className="bg-[#b9f36f] text-[#14200a] hover:bg-[#cbff87]"
            label="SVG"
            onClick={onExportSvg}
            disabled={exportState !== "idle"}
          />
          <ExportButton
            className="bg-[#ffd083] text-[#281a06] hover:bg-[#ffdc9f]"
            label="JPG"
            onClick={onExportJpg}
            disabled={exportState !== "idle"}
          />
          <ExportButton
            className="col-span-2 bg-[#948cff] text-[#100d2d] hover:bg-[#aaa4ff]"
            label="AE JSX"
            onClick={onExportAfterEffects}
            disabled={exportState !== "idle"}
          />
        </div>
        {exportState !== "idle" && (
          <p className="mb-0 mt-2.5 text-center font-mono text-[11px] uppercase text-[#3948d7] dark:text-[#d8ff72]">
            Preparing {exportState.toUpperCase()}…
          </p>
        )}
      </section>
    </aside>
  );
}

function ColorSwatch({
  color,
  selected,
  onSelect,
}: {
  color: string;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      className={`size-7 rounded-lg border-[3px] border-transparent p-0 transition hover:border-[#151620] hover:ring-2 hover:ring-white ${selected ? "border-[#151620] ring-2 ring-white" : ""}`}
      type="button"
      style={{ backgroundColor: color }}
      onClick={onSelect}
      aria-label={`Use ${color} as base color`}
    />
  );
}

function ExportButton({
  className,
  label,
  onClick,
  disabled,
}: {
  className: string;
  label: string;
  onClick: () => void;
  disabled: boolean;
}) {
  return (
    <button
      className={`flex min-h-12 items-center justify-between gap-2 rounded-xl border border-transparent px-3 py-2.5 text-xs transition hover:not-disabled:-translate-y-px ${className}`}
      type="button"
      onClick={onClick}
      disabled={disabled}
    >
      <span className="flex items-center gap-2">
        <Icon name="download" /> {label}
      </span>
      <Icon name="arrow" />
    </button>
  );
}
