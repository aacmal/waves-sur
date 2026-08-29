import { useEffect, useMemo, useRef, useState } from "react";
import { Sidebar } from "./components/Sidebar";
import type { ExportState } from "./components/Sidebar";
import {
  PopoverAnchor,
  Popover,
  PopoverContent,
} from "./components/ui/popover";
import { RotateCcw, SunMoon } from "lucide-react";
import {
  DEFAULT_PARAMETERS,
  downloadBlob,
  generateWaveScene,
  parametersToSearchParams,
  sceneToAfterEffectsJsx,
  sceneToSvg,
  searchParamsToParameters,
} from "./lib/wave-engine";
import { Icon } from "./components/Controls";

export default function App() {
  // Initialize from URL query params if present
  const [parameters, setParameters] = useState(() => {
    const sp = new URLSearchParams(window.location.search);
    return { ...DEFAULT_PARAMETERS, ...searchParamsToParameters(sp) };
  });
  const [isDarkTheme, setIsDarkTheme] = useState(true);
  const [shareState, setShareState] = useState<"idle" | "copied">("idle");
  const [hoveredLayer, setHoveredLayer] = useState<string | null>(null);
  const [activeLayerId, setActiveLayerId] = useState<string | null>(null);
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const [popoverPoint, setPopoverPoint] = useState({ x: 960, y: 540 });
  const [exportState, setExportState] = useState<ExportState>("idle");
  const canvasViewportRef = useRef<HTMLDivElement>(null);
  const canvasSvgRef = useRef<SVGSVGElement>(null);
  const [canvasViewport, setCanvasViewport] = useState({
    width: 0,
    maxHeight: 0,
  });
  const scene = useMemo(() => generateWaveScene(parameters), [parameters]);

  // Dark mode
  useEffect(() => {
    document.documentElement.classList.toggle("dark", isDarkTheme);
    return () => document.documentElement.classList.remove("dark");
  }, [isDarkTheme]);

  useEffect(() => {
    const viewport = canvasViewportRef.current;
    if (!viewport) return;

    const updateCanvasViewport = () => {
      const isMobile = window.innerWidth < 900;
      setCanvasViewport({
        width: viewport.clientWidth,
        maxHeight: isMobile
          ? Math.round(window.innerHeight * 0.45)
          : Math.max(240, viewport.clientHeight),
      });
    };

    updateCanvasViewport();
    const resizeObserver = new ResizeObserver(updateCanvasViewport);
    resizeObserver.observe(viewport);
    window.addEventListener("resize", updateCanvasViewport);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", updateCanvasViewport);
    };
  }, []);

  const canvasRatio = parameters.width / parameters.height;
  const canvasWidth =
    canvasViewport.width > 0
      ? Math.min(canvasViewport.width, canvasViewport.maxHeight * canvasRatio)
      : undefined;
  const canvasHeight = canvasWidth ? canvasWidth / canvasRatio : undefined;
  const activeLayer = scene.layers.find((layer) => layer.id === activeLayerId);
  const panelLayer = activeLayer ?? scene.layers[0];
  const activeLayerOverride = activeLayerId
    ? parameters.colorOverrides?.[activeLayerId]
    : undefined;

  const updatePopoverPoint = (clientX: number, clientY: number) => {
    const svg = canvasSvgRef.current;
    if (!svg) return;

    const rect = svg.getBoundingClientRect();
    if (!rect.width || !rect.height) return;

    setPopoverPoint({
      x: Math.min(
        scene.width,
        Math.max(0, ((clientX - rect.left) / rect.width) * scene.width),
      ),
      y: Math.min(
        scene.height,
        Math.max(0, ((clientY - rect.top) / rect.height) * scene.height),
      ),
    });
  };

  const exportSvg = () => {
    setExportState("svg");
    downloadBlob(
      new Blob([sceneToSvg(scene)], { type: "image/svg+xml;charset=utf-8" }),
      `wave-${parameters.seed}.svg`,
    );
    window.setTimeout(() => setExportState("idle"), 700);
  };

  const exportAfterEffects = () => {
    setExportState("jsx");
    downloadBlob(
      new Blob([sceneToAfterEffectsJsx(scene)], {
        type: "text/javascript;charset=utf-8",
      }),
      `wave-${parameters.seed}-after-effects.jsx`,
    );
    window.setTimeout(() => setExportState("idle"), 700);
  };

  const exportJpg = async () => {
    setExportState("jpg");
    const svgBlob = new Blob([sceneToSvg(scene)], {
      type: "image/svg+xml;charset=utf-8",
    });
    const objectUrl = URL.createObjectURL(svgBlob);
    const image = new Image();

    try {
      await new Promise<void>((resolve, reject) => {
        image.onload = () => resolve();
        image.onerror = () => reject(new Error("Could not render the SVG"));
        image.src = objectUrl;
      });

      const canvas = document.createElement("canvas");
      canvas.width = scene.width;
      canvas.height = scene.height;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Canvas is not available");
      context.fillStyle = scene.backgroundColor;
      context.fillRect(0, 0, scene.width, scene.height);
      context.drawImage(image, 0, 0, scene.width, scene.height);

      const jpgBlob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/jpeg", 0.96),
      );
      if (jpgBlob) downloadBlob(jpgBlob, `wave-${parameters.seed}.jpg`);
    } finally {
      URL.revokeObjectURL(objectUrl);
      setExportState("idle");
    }
  };

  const shareUrl = async () => {
    const sp = parametersToSearchParams(parameters);
    const url = `${window.location.origin}${window.location.pathname}?${sp.toString()}`;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // Fallback for browsers without clipboard API
      const ta = document.createElement("textarea");
      ta.value = url;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      document.execCommand("copy");
      ta.remove();
    }
    setShareState("copied");
    window.setTimeout(() => setShareState("idle"), 2000);
  };

  return (
    <main className="flex h-full w-full flex-col overflow-hidden bg-[#f0eff5] text-[#171923] dark:bg-[#080910] dark:text-[#f7f5ef]">
      {/* Top header bar */}
      <header className="flex h-13 shrink-0 items-center justify-between border-b border-black/[0.07] px-5 dark:border-white/6 max-[680px]:px-3">
        <div className="flex items-center gap-2.5">
          {/* Animated wave logo icon */}
          <div className="relative flex h-8 w-8 items-center justify-center overflow-hidden rounded-lg bg-linear-to-br from-violet-600 to-indigo-800 shadow-lg shadow-indigo-900/30">
            <img
              src="/favicon-32x32.png"
              alt="Waves Sur Logo"
            />
          </div>
          <div className="flex flex-col leading-none">
            <h1 className="font-bold tracking-tight">
              Waves Sur
            </h1>
            <p className="mt-0.5 font-mono text-[9px] uppercase tracking-widest text-gray-800 dark:text-white/25">
              Wave Generator
            </p>
          </div>
        </div>

        {/* Right side: theme toggle only */}
        <div className="flex items-center gap-1.5">
          <a
            className="grid size-8 place-items-center rounded-lg text-black/55 transition hover:bg-black/[0.06] hover:text-black/75 dark:text-white/50 dark:hover:bg-white/[0.07] dark:hover:text-white/75"
            href="https://github.com/aacmal/waves-sur"
            target="_blank"
            rel="noreferrer"
            aria-label="View Waves Sur on GitHub"
            title="View on GitHub"
          >
            <Icon name="github" />
          </a>
          <button
            className="flex h-8 items-center gap-1.5 rounded-lg px-2.5 font-mono text-[10px] uppercase tracking-wide text-black/55 transition hover:bg-black/[0.06] hover:text-black/80 dark:text-white/50 dark:hover:bg-white/[0.07] dark:hover:text-white/75"
            type="button"
            onClick={() => setIsDarkTheme((v) => !v)}
            aria-label={`Switch to ${isDarkTheme ? "light" : "dark"} theme`}
          >
            <SunMoon className="size-4" strokeWidth={1.7} aria-hidden="true" />
            <span className="max-[500px]:hidden">{isDarkTheme ? "Light" : "Dark"}</span>
          </button>
        </div>
      </header>

      {/* Body: canvas area + sidebar */}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden min-[900px]:flex-row">
        {/* Canvas area */}
        <div
          className="canvas-area-bg flex shrink-0 items-center justify-center min-[900px]:min-h-0 min-[900px]:min-w-0 min-[900px]:flex-1"
          ref={canvasViewportRef}
        >
          {/* JS-sized: fit (not fill) with correct aspect ratio on all viewports */}
          <div
            className="relative isolate overflow-hidden"
            style={{
              aspectRatio: `${parameters.width} / ${parameters.height}`,
              ...(canvasWidth && canvasHeight
                ? { width: canvasWidth, height: canvasHeight }
                : {}),
            }}
          >
            <Popover
              open={isPopoverOpen}
              onOpenChange={setIsPopoverOpen}
            >
            <svg
              ref={canvasSvgRef}
              className="absolute inset-0 block size-full"
              xmlns="http://www.w3.org/2000/svg"
              width={scene.width}
              height={scene.height}
              viewBox={`0 0 ${scene.width} ${scene.height}`}
              preserveAspectRatio="none"
              role="img"
              aria-label="Generated layered wave illustration"
            >
              <defs>
                {scene.layers.map((layer) => (
                  <linearGradient
                    key={`${layer.id}-gradient`}
                    id={`${layer.id}-gradient`}
                    gradientUnits="userSpaceOnUse"
                    x1={layer.gradient.startPoint.x}
                    y1={layer.gradient.startPoint.y}
                    x2={layer.gradient.endPoint.x}
                    y2={layer.gradient.endPoint.y}
                  >
                    <stop offset="0%" stopColor={layer.gradient.start} />
                    <stop offset="100%" stopColor={layer.gradient.end} />
                  </linearGradient>
                ))}
              </defs>
              <rect
                width="100%"
                height="100%"
                fill={
                  scene.layers[0]
                    ? `url(#${scene.layers[0].id}-gradient)`
                    : scene.backgroundColor
                }
              />
              {scene.layers.map((layer) => (
                <g
                  key={layer.id}
                  role="button"
                  tabIndex={0}
                  aria-label={`Wave ${layer.id.replace("wave-", "")}`}
                  aria-expanded={isPopoverOpen && activeLayerId === layer.id}
                  aria-haspopup="dialog"
                  data-wave-trigger="true"
                  className="group outline-none"
                  onMouseEnter={() => setHoveredLayer(layer.id)}
                  onMouseLeave={() => setHoveredLayer(null)}
                  onFocus={() => setHoveredLayer(layer.id)}
                  onBlur={() => setHoveredLayer(null)}
                  onPointerDown={(event) => {
                    event.stopPropagation();
                    updatePopoverPoint(event.clientX, event.clientY);
                    if (activeLayerId === layer.id && isPopoverOpen) {
                      setIsPopoverOpen(false);
                    } else {
                      setActiveLayerId(layer.id);
                      setIsPopoverOpen(true);
                    }
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      const rect = event.currentTarget.getBoundingClientRect();
                      updatePopoverPoint(
                        rect.left + rect.width / 2,
                        rect.top + rect.height / 2,
                      );
                      if (activeLayerId === layer.id && isPopoverOpen) {
                        setIsPopoverOpen(false);
                      } else {
                        setActiveLayerId(layer.id);
                        setIsPopoverOpen(true);
                      }
                    }
                  }}
                >
                  <path
                    className={`cursor-pointer opacity-95 transition-[opacity,filter] duration-200 group-focus-visible:opacity-100 group-focus-visible:[filter:saturate(1.22)_brightness(1.07)] ${hoveredLayer === layer.id || (isPopoverOpen && activeLayerId === layer.id) ? "opacity-100 [filter:saturate(1.22)_brightness(1.07)]" : ""}`}
                    d={layer.path}
                    fill={`url(#${layer.id}-gradient)`}
                  />
                </g>
              ))}
              <PopoverAnchor asChild>
                <foreignObject
                  key={`${activeLayerId ?? "none"}-${popoverPoint.x}-${popoverPoint.y}`}
                  x={popoverPoint.x}
                  y={popoverPoint.y}
                  width="1"
                  height="1"
                  aria-hidden="true"
                  style={{ opacity: 0, pointerEvents: "none" }}
                />
              </PopoverAnchor>
            </svg>
              <PopoverContent
                forceMount
                side="top"
                align="center"
                sideOffset={10}
                collisionPadding={16}
                className="wave-popover-content w-auto min-w-48"
                aria-hidden={!isPopoverOpen}
                inert={!isPopoverOpen}
                onPointerDownOutside={(event) => {
                  const target = event.target;
                  if (
                    target instanceof Element &&
                    target.closest("[data-wave-trigger]")
                  ) {
                    event.preventDefault();
                  }
                }}
              >
                <h2 className="mb-2.5 font-mono text-[11px] tracking-wide text-[#d8ff72]">
                  Override this color
                </h2>
                <div className="flex items-center gap-2">
                  <input
                    className="size-10 cursor-pointer rounded-lg border border-white/15 bg-transparent p-0"
                    type="color"
                    value={
                      activeLayerOverride ?? panelLayer.gradient.start
                    }
                    onChange={(event) =>
                      setParameters((current) => ({
                          ...current,
                          colorOverrides: {
                            ...current.colorOverrides,
                            [panelLayer.id]: event.target.value,
                        },
                      }))
                    }
                    aria-label="Override this color"
                  />
                  {activeLayerOverride && (
                    <button
                      className="grid size-8 place-items-center rounded-lg text-[#b4b4bd] transition hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#d8ff72]"
                      type="button"
                      onClick={() =>
                        setParameters((current) => {
                          const colorOverrides = {
                            ...current.colorOverrides,
                          };
                          delete colorOverrides[panelLayer.id];
                          return { ...current, colorOverrides };
                        })
                      }
                      aria-label="Reset color override"
                      title="Reset color override"
                    >
                      <RotateCcw aria-hidden="true" className="size-4" />
                    </button>
                  )}
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </div>

        {/* Sidebar */}
        <Sidebar
          parameters={parameters}
          setParameters={setParameters}
          exportState={exportState}
          onExportSvg={exportSvg}
          onExportJpg={exportJpg}
          onExportAfterEffects={exportAfterEffects}
          shareState={shareState}
          onShare={shareUrl}
        />
      </div>
    </main>
  );
}
