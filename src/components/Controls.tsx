import type { CSSProperties } from "react";
import type { LucideIcon } from "lucide-react";
import { ArrowRight, Dices, Download, RotateCcw, SunMoon } from "lucide-react";
import GithubIcon from "./GithubIcon";

type IconName = "arrow" | "dice" | "download" | "github" | "reset" | "theme";

const ICONS: Record<IconName, LucideIcon | React.ComponentType> = {
  arrow: ArrowRight,
  dice: Dices,
  download: Download,
  github: GithubIcon,
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
    <div className="mt-4 first:mt-0">
      <div className="mb-2 flex items-center justify-between">
        <label
          className="font-mono text-[10px] uppercase tracking-widest text-black/60 dark:text-white/55"
          htmlFor={label}
        >
          {label}
        </label>
        <output
          className="min-w-10 rounded-md bg-[color-mix(in_srgb,var(--range-accent)_14%,transparent)] px-2 py-0.5 text-center font-mono text-[10px] font-semibold text-[#171923] dark:text-white"
          htmlFor={label}
        >
          {displayValue}
        </output>
      </div>
      <input
        id={label}
        className="range-input block h-1.5 w-full cursor-pointer appearance-none rounded-full"
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
