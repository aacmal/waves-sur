import type { CSSProperties } from "react";
import type { LucideIcon } from "lucide-react";
import {
  ArrowRight,
  Dices,
  Download,
  GitFork,
  RotateCcw,
  SunMoon,
} from "lucide-react";

type IconName = "arrow" | "dice" | "download" | "github" | "reset" | "theme";

const ICONS: Record<IconName, LucideIcon> = {
  arrow: ArrowRight,
  dice: Dices,
  download: Download,
  github: GitFork,
  reset: RotateCcw,
  theme: SunMoon,
};

export function Icon({ name }: { name: IconName }) {
  const LucideIcon = ICONS[name];
  return <LucideIcon aria-hidden="true" className="size-4" strokeWidth={1.7} />;
}

type RangeControlProps = {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  displayValue: string;
  accent: string;
  onChange: (value: number) => void;
};

export function RangeControl({
  label,
  value,
  min,
  max,
  step,
  displayValue,
  accent,
  onChange,
}: RangeControlProps) {
  const rangeStyle = {
    "--range-accent": accent,
    "--range-progress": `${((value - min) / (max - min)) * 100}%`,
  } as CSSProperties;

  return (
    <div className="mt-[18px] first:mt-0">
      <div className="mb-2.5 flex items-center justify-between">
        <label
          className="font-mono text-[11px] uppercase text-[#555966] dark:text-[#b4b4bd]"
          htmlFor={label}
        >
          {label}
        </label>
        <output
          className="min-w-10 rounded-lg bg-[color-mix(in_srgb,var(--range-accent)_12%,transparent)] px-2 py-1 text-center font-mono text-[11px] uppercase text-[#171923] dark:text-white"
          htmlFor={label}
        >
          {displayValue}
        </output>
      </div>
      <input
        id={label}
        className="range-input block h-2 w-full cursor-pointer appearance-none rounded-lg"
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        style={rangeStyle}
      />
    </div>
  );
}
