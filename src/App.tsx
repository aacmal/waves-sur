import { useEffect, useMemo, useRef, useState } from "react";
import { Sidebar } from "./components/Sidebar";
import type { ExportState } from "./components/Sidebar";
import {
  DEFAULT_PARAMETERS,
  downloadBlob,
  generateWaveScene,
  sceneToAfterEffectsJsx,
  sceneToSvg,
} from "./lib/wave-engine";

export default function App() {
  const [parameters, setParameters] = useState(DEFAULT_PARAMETERS);
  const [hoveredLayer, setHoveredLayer] = useState<string | null>(null);
  const [exportState, setExportState] = useState<ExportState>("idle");
  const canvasViewportRef = useRef<HTMLDivElement>(null);
  const [canvasViewport, setCanvasViewport] = useState({
    width: 0,
    maxHeight: 0,
  });
  const scene = useMemo(() => generateWaveScene(parameters), [parameters]);

  useEffect(() => {
    const viewport = canvasViewportRef.current;
    if (!viewport) return;

    const updateCanvasViewport = () => {
      setCanvasViewport({
        width: viewport.clientWidth,
        maxHeight: Math.max(240, window.innerHeight - 88),
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

  return (
    <main className="min-h-screen w-full bg-[#f2f2ee] text-[#171923] transition-colors dark:bg-[#0b0c12] dark:text-[#f7f5ef]">
      <section className="grid min-h-[calc(100vh-76px)] grid-cols-[minmax(0,1fr)_360px] max-[900px]:min-h-0 max-[900px]:grid-cols-1">
        <div className="flex min-h-[calc(100vh-76px)] min-w-0 flex-col px-7 pb-5 pt-6 max-[900px]:min-h-0 max-[680px]:px-3.75 max-[680px]:pb-4.5 max-[680px]:pt-4">
          <div
            className="flex min-h-0 w-full flex-1 items-center justify-center overflow-hidden"
            ref={canvasViewportRef}
          >
            <div
              className="relative isolate overflow-hidden rounded-4xl border-2 border-slate-200 bg-[#11121c] max-[680px]:rounded-2xl"
              style={{
                aspectRatio: `${parameters.width} / ${parameters.height}`,
                ...(canvasWidth && canvasHeight
                  ? { width: canvasWidth, height: canvasHeight }
                  : {}),
              }}
            >
              <svg
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
                <rect width="100%" height="100%" fill={scene.backgroundColor} />
                {scene.layers.map((layer) => (
                  <path
                    key={layer.id}
                    className={`opacity-95 transition-[opacity,filter] duration-200 ${hoveredLayer === layer.id ? "opacity-100 [filter:saturate(1.22)_brightness(1.07)]" : ""}`}
                    d={layer.path}
                    fill={`url(#${layer.id}-gradient)`}
                    onMouseEnter={() => setHoveredLayer(layer.id)}
                    onMouseLeave={() => setHoveredLayer(null)}
                  />
                ))}
              </svg>
            </div>
          </div>
        </div>

        <Sidebar
          parameters={parameters}
          setParameters={setParameters}
          exportState={exportState}
          onExportSvg={exportSvg}
          onExportJpg={exportJpg}
          onExportAfterEffects={exportAfterEffects}
        />
      </section>
    </main>
  );
}
