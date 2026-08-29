import { useEffect, useState } from "react";
import type { ChangeEvent, Dispatch, SetStateAction } from "react";
import { Check, Link2 } from "lucide-react";
import { Icon, RangeControl } from "./Controls";
import {
  COLOR_SWATCHES,
  DEFAULT_PARAMETERS,
  PRESETS,
  SAVED_COLORS_KEY,
} from "../lib/wave-engine";
import type { WaveParameters } from "../lib/wave-engine";

export type ExportState = "idle" | "svg" | "png" | "jsx";

type SidebarProps = {
  parameters: WaveParameters;
  setParameters: Dispatch<SetStateAction<WaveParameters>>;
  exportState: ExportState;
  onExportSvg: () => void;
  onExportPng: () => void;
  onExportAfterEffects: () => void;
  shareState: "idle" | "copied";
  onShare: () => void;
};

const surface =
  "section-card rounded-2xl border border-black/[0.07] bg-white/70 dark:border-white/[0.06] dark:bg-white/[0.03]";
const field =
  "relative block min-h-14 min-w-0 rounded-xl border border-transparent bg-black/[0.05] px-3 py-2 transition focus-within:border-[#3948d766] focus-within:bg-black/[0.07] focus-within:ring-2 focus-within:ring-[#3948d712] dark:bg-white/[0.05] dark:focus-within:border-[#d8ff7266] dark:focus-within:bg-white/[0.08] dark:focus-within:ring-[#d8ff7212]";

export function Sidebar({
  parameters,
  setParameters,
  exportState,
  onExportSvg,
  onExportPng,
  onExportAfterEffects,
  shareState,
  onShare,
}: SidebarProps) {
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

  const panelProps = {
    parameters,
    dimensionDrafts,
    setDimensionDrafts,
    savedColors,
    updateParameter,
    applyDimensions,
    commitDimension,
    resetParameters,
    saveCustomColor,
    removeSavedColor,
  };

  return (
    <>
      {/* Single aside — flex-col on mobile (below canvas), flex-row child on desktop */}
      <aside className="
        flex min-h-0 w-full flex-1 flex-col overflow-hidden
        border-t border-black/[0.07]
        bg-white/50 backdrop-blur-2xl
        dark:border-white/[0.06] dark:bg-[#0d0f1a]/80
        min-[900px]:h-full min-[900px]:w-[340px] min-[900px]:flex-none
        min-[900px]:border-t-0 min-[900px]:border-l
      ">
        <SidebarToolbar
          resetParameters={resetParameters}
          shareState={shareState}
          onShare={onShare}
        />
        <SidebarScrollBody {...panelProps} />
        <SidebarExportFooter
          exportState={exportState}
          onExportSvg={onExportSvg}
          onExportPng={onExportPng}
          onExportAfterEffects={onExportAfterEffects}
        />
      </aside>
    </>
  );
}

// ─── Shared sub-components ────────────────────────────────────────────────────

type PanelProps = {
  parameters: WaveParameters;
  dimensionDrafts: { width: string; height: string };
  setDimensionDrafts: Dispatch<SetStateAction<{ width: string; height: string }>>;
  savedColors: string[];
  updateParameter: <K extends keyof WaveParameters>(key: K, value: WaveParameters[K]) => void;
  applyDimensions: (width: number, height: number) => void;
  commitDimension: (key: "width" | "height") => void;
  saveCustomColor: (color: string) => void;
  removeSavedColor: (color: string) => void;
};

function SidebarToolbar({
  resetParameters,
  shareState,
  onShare,
}: {
  resetParameters: () => void;
  shareState: "idle" | "copied";
  onShare: () => void;
}) {
  return (
    <div className="flex shrink-0 items-center justify-between border-b border-black/[0.06] px-4 py-3 dark:border-white/[0.05]">
      <div className="flex items-center gap-2">
        <span className="font-mono text-[11px] font-medium uppercase tracking-widest text-black/65 dark:text-white/55">
          Parameters
        </span>
      </div>
      <div className="flex gap-1.5">

        <button
          className="grid size-8 place-items-center rounded-lg text-black/55 transition hover:bg-black/[0.06] hover:text-black/75 dark:text-white/50 dark:hover:bg-white/[0.07] dark:hover:text-white/75"
          type="button"
          onClick={resetParameters}
          aria-label="Reset parameters"
          title="Reset parameters"
        >
          <Icon name="reset" />
        </button>
        <button
          className={`grid size-8 place-items-center rounded-lg transition ${
            shareState === "copied"
              ? "text-emerald-500 dark:text-emerald-400"
              : "text-black/55 hover:bg-black/[0.06] hover:text-black/75 dark:text-white/50 dark:hover:bg-white/[0.07] dark:hover:text-white/75"
          }`}
          type="button"
          onClick={onShare}
          aria-label="Copy share link"
          title={shareState === "copied" ? "Copied!" : "Copy share link"}
        >
          {shareState === "copied"
            ? <Check className="size-4" strokeWidth={2} aria-hidden="true" />
            : <Link2 className="size-4" strokeWidth={1.7} aria-hidden="true" />}
        </button>
      </div>
    </div>
  );
}

function SidebarScrollBody({
  parameters,
  dimensionDrafts,
  setDimensionDrafts,
  savedColors,
  updateParameter,
  applyDimensions,
  commitDimension,
  saveCustomColor,
  removeSavedColor,
}: PanelProps) {
  const [hexDraft, setHexDraft] = useState(parameters.baseColor);

  useEffect(() => {
    // Keep the draft in sync when the selected swatch or reset action changes the base color.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHexDraft(parameters.baseColor);
  }, [parameters.baseColor]);

  const applyHex = (raw: string) => {
    const clean = raw.trim().replace(/^#/, "");
    if (/^[0-9a-f]{6}$/i.test(clean)) {
      const color = `#${clean.toLowerCase()}`;
      updateParameter("baseColor", color);
      saveCustomColor?.(color);
    }
    // always reset draft to canonical value
    setHexDraft(parameters.baseColor);
  };

  return (
    <div className="sidebar-scroll min-h-0 flex-1 overflow-y-auto px-3 py-3 space-y-2.5">
      {/* Canvas */}
      <section className={surface + " p-4"}>
        <SectionLabel>Canvas</SectionLabel>
        <div className="mb-3 grid grid-cols-3 gap-1.5">
          {PRESETS.map((preset) => {
            const selected =
              parameters.width === preset.width &&
              parameters.height === preset.height;
            return (
              <button
                key={preset.label}
                className={`flex min-h-[52px] min-w-0 flex-col items-start justify-center gap-0.5 rounded-xl border px-2.5 py-2 text-left font-mono text-[10px] uppercase tracking-wide transition ${
                  selected
                    ? "border-[#3948d760] bg-[#3948d712] text-[#3948d7] dark:border-[#d8ff7260] dark:bg-[#d8ff7212] dark:text-[#d8ff72]"
                    : "border-transparent bg-black/[0.04] text-black/60 hover:bg-black/[0.07] hover:text-black/80 dark:bg-white/[0.04] dark:text-white/55 dark:hover:bg-white/[0.07] dark:hover:text-white/80"
                }`}
                type="button"
                onClick={() => applyDimensions(preset.width, preset.height)}
              >
                <span className="font-semibold">{preset.label}</span>
                <small className="max-w-full overflow-hidden text-ellipsis whitespace-nowrap text-[9px] normal-case tracking-tight opacity-60">
                  {preset.width}×{preset.height}
                </small>
              </button>
            );
          })}
        </div>
        <div className="grid grid-cols-2 gap-2">
          {(["width", "height"] as const).map((key) => (
            <label className={field} key={key}>
              <span className="mb-1 block font-mono text-[10px] uppercase tracking-widest text-black/60 dark:text-white/50">
                {key}
              </span>
              <input
                className="w-[calc(100%-22px)] appearance-none border-0 bg-transparent p-0 font-mono text-sm font-semibold text-[#171923] dark:text-white outline-none"
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
              <small className="absolute bottom-2.5 right-3 font-mono text-[9px] text-black/45 dark:text-white/40">
                px
              </small>
            </label>
          ))}
        </div>
      </section>

      {/* Structure */}
      <section className={surface + " p-4"}>
        <SectionLabel>Structure</SectionLabel>
        <div className="mb-4 flex gap-2">
          <label className={`${field} flex-1`}>
            <span className="mb-1 block font-mono text-[10px] uppercase tracking-widest text-black/60 dark:text-white/50">
              Seed
            </span>
            <input
              className="w-full border-0 bg-transparent p-0 font-mono text-sm font-semibold text-[#171923] dark:text-white outline-none"
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
            className="grid w-11 place-items-center rounded-xl border border-transparent bg-black/[0.05] text-black/55 transition hover:bg-black/[0.09] hover:text-[#3948d7] dark:bg-white/[0.05] dark:text-white/50 dark:hover:bg-white/[0.09] dark:hover:text-[#d8ff72]"
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
        <RangeControl
          label="rotation"
          value={parameters.rotation}
          min={0}
          max={360}
          step={1}
          displayValue={`${parameters.rotation}°`}
          onChange={(value) => updateParameter("rotation", value)}
          accent={parameters.baseColor}
        />
      </section>

      {/* Color field */}
      <section className={surface + " p-4"}>
        <SectionLabel>Color Field</SectionLabel>
        {/* Color picker row: swatch + hex text input */}
        <div className="mb-3 flex items-center gap-2">
          {/* Native color picker trigger */}
          <label
            className="relative shrink-0 cursor-pointer"
            aria-label="Open color picker"
            title="Pick color"
          >
            <input
              className="absolute size-px opacity-0"
              type="color"
              value={parameters.baseColor}
              onChange={(event) => {
                updateParameter("baseColor", event.target.value);
                setHexDraft(event.target.value);
              }}
              onBlur={() => saveCustomColor?.(parameters.baseColor)}
              aria-label="Base color picker"
            />
            <span
              className="block size-10 rounded-xl border-2 border-black/10 shadow-sm transition hover:scale-105 active:scale-95 dark:border-white/10"
              style={{ backgroundColor: parameters.baseColor }}
            />
          </label>
          {/* Editable hex input */}
          <div className="flex flex-1 items-center gap-1 rounded-xl border border-transparent bg-black/[0.05] px-3 py-2 transition focus-within:border-[#3948d766] focus-within:bg-black/[0.07] dark:bg-white/[0.05] dark:focus-within:border-[#d8ff7266]">
            <span className="shrink-0 font-mono text-sm font-semibold text-black/40 dark:text-white/35">#</span>
            <input
              className="min-w-0 flex-1 bg-transparent font-mono text-sm font-semibold uppercase text-[#171923] outline-none dark:text-white"
              type="text"
              maxLength={6}
              value={hexDraft.replace(/^#/, "").toUpperCase()}
              onChange={(e) => setHexDraft("#" + e.target.value)}
              onBlur={() => applyHex(hexDraft)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.currentTarget.blur();
                }
              }}
              aria-label="Hex color value"
              spellCheck={false}
            />
          </div>
        </div>
        <div className="mb-4 flex flex-wrap gap-1.5" aria-label="Color presets">
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
          <div className="mb-4 border-t border-black/[0.06] pt-3 dark:border-white/[0.06]">
            <span className="mb-2 block font-mono text-[10px] uppercase tracking-widest text-black/55 dark:text-white/45">
              Saved
            </span>
            <div className="flex flex-wrap gap-1.5">
              {savedColors.map((color) => (
                <div className="group relative" key={color}>
                  <ColorSwatch
                    color={color}
                    selected={parameters.baseColor === color}
                    onSelect={() => updateParameter("baseColor", color)}
                  />
                  <button
                    className="absolute -right-1.5 -top-1.5 grid size-4 scale-75 place-items-center rounded-full border-2 border-[#0d0f1a] bg-white p-0 text-xs leading-none text-[#0b0c12] opacity-0 transition group-hover:scale-100 group-hover:opacity-100 focus:scale-100 focus:opacity-100"
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
  );
}

function SidebarExportFooter({
  exportState,
  onExportSvg,
  onExportPng,
  onExportAfterEffects,
}: {
  exportState: ExportState;
  onExportSvg: () => void;
  onExportPng: () => void;
  onExportAfterEffects: () => void;
}) {
  return (
    <div className="shrink-0 border-t border-black/[0.06] bg-white/30 px-3 py-3 backdrop-blur-sm dark:border-white/[0.05] dark:bg-black/20">
      <div className="mb-2 flex items-center gap-2">
        <span className="font-mono text-[10px] font-medium uppercase tracking-widest text-[#3948d7] dark:text-[#d8ff72]">
          Export
        </span>
        {exportState !== "idle" && (
          <span className="animate-pulse font-mono text-[10px] text-black/40 dark:text-white/35">
            · Preparing {exportState.toUpperCase()}…
          </span>
        )}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <ExportButton
          className="bg-[#b9f36f] text-[#14200a] hover:bg-[#c9ff7e]"
          label="SVG"
          onClick={onExportSvg}
          disabled={exportState !== "idle"}
        />
        <ExportButton
          className="bg-[#ffd083] text-[#281a06] hover:bg-[#ffdc9f]"
          label="PNG"
          onClick={onExportPng}
          disabled={exportState !== "idle"}
        />
        <ExportButton
          className="col-span-2 bg-[#948cff] text-[#100d2d] hover:bg-[#aaa4ff]"
          label="After Effects JSX"
          onClick={onExportAfterEffects}
          disabled={exportState !== "idle"}
        />
      </div>
      <a
        className="mt-3 block text-center font-mono text-[10px] tracking-wide text-black/45 transition-colors hover:text-[#3948d7] dark:text-white/40 dark:hover:text-[#d8ff72]"
        href="https://wanakerta.com/"
        target="_blank"
        rel="noreferrer"
      >
        Created by Wanakerta
      </a>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-3 font-mono text-[10px] font-semibold uppercase tracking-widest text-black/60 dark:text-white/50">
      {children}
    </h2>
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
      className={`size-7 rounded-lg border-[2.5px] p-0 transition-transform hover:scale-110 active:scale-95 ${
        selected
          ? "border-white/80 ring-2 ring-offset-1 ring-offset-transparent dark:ring-black/50"
          : "border-transparent hover:border-white/50"
      }`}
      type="button"
      style={{ backgroundColor: color }}
      onClick={onSelect}
      aria-label={`Use ${color} as base color`}
      aria-pressed={selected}
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
      className={`flex min-h-11 items-center justify-between gap-2 rounded-xl border border-transparent px-3 py-2 font-mono text-[11px] font-medium tracking-wide transition hover:not-disabled:-translate-y-0.5 hover:not-disabled:shadow-md ${className}`}
      type="button"
      onClick={onClick}
      disabled={disabled}
    >
      <span className="flex items-center gap-2">
        <Icon name="download" />
        {label}
      </span>
      <Icon name="arrow" />
    </button>
  );
}
