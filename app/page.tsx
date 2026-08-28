"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent, CSSProperties } from "react";

type Point = { x: number; y: number };

type WaveParameters = {
  width: number;
  height: number;
  seed: number;
  numberOfWaves: number;
  hueRange: number;
  saturation: number;
  lightness: number;
  baseColor: string;
  backgroundColor: string;
};

type ShapePathData = {
  vertices: Point[];
  inTangents: Point[];
  outTangents: Point[];
};

type WaveLayer = {
  id: string;
  path: string;
  shape: ShapePathData;
  gradient: {
    start: string;
    end: string;
    startPoint: Point;
    endPoint: Point;
  };
};

type WaveScene = {
  width: number;
  height: number;
  seed: number;
  backgroundColor: string;
  layers: WaveLayer[];
};

type HslColor = { hue: number; saturation: number; lightness: number };

const DEFAULT_PARAMETERS: WaveParameters = {
  width: 1920,
  height: 1080,
  seed: 199,
  numberOfWaves: 5,
  hueRange: 60,
  saturation: 60,
  lightness: 50,
  baseColor: "#6d63ff",
  backgroundColor: "#11121c",
};

const COLOR_SWATCHES = ["#6d63ff", "#ff705d", "#ffb84d", "#40c7b4", "#da67cf"];
const SAVED_COLORS_KEY = "wave-lab-saved-colors";
const PRESETS = [
  { label: "Wide", width: 1920, height: 1080 },
  { label: "Square", width: 1200, height: 1200 },
  { label: "Portrait", width: 1080, height: 1920 },
];

const WAVE_POINT_COUNT = 5;
const WAVE_SMOOTHNESS = 1;
const PRNG_GAMMA = -7046029254386353131n;
const PRNG_MIX_A = -4658895280553007687n;
const PRNG_MIX_B = -7723592293110705685n;

const toUint64 = (value: bigint) => BigInt.asUintN(64, value);

class StableRandom {
  private state: bigint;

  constructor(seed: bigint) {
    this.state = toUint64(seed);
  }

  private nextLong() {
    this.state = toUint64(this.state + PRNG_GAMMA);
    let result = this.state;
    result = toUint64((result ^ (result >> 30n)) * PRNG_MIX_A);
    result = toUint64((result ^ (result >> 27n)) * PRNG_MIX_B);
    return toUint64(result ^ (result >> 31n));
  }

  nextFloat() {
    const bits = (this.nextLong() >> 40n) & 0xffffffn;
    return Number(bits) / 16777216;
  }

  nextSignedFloat() {
    return this.nextFloat() * 2 - 1;
  }
}

function seedAsBigInt(seed: number) {
  return BigInt(Math.trunc(Number.isFinite(seed) ? seed : 1));
}

function normalizedProgress(index: number, count: number) {
  return count <= 1 ? 0.5 : index / (count - 1);
}

function lerp(start: number, end: number, fraction: number) {
  return start + (end - start) * Math.min(1, Math.max(0, fraction));
}

function normalizeHue(hue: number) {
  return ((hue % 360) + 360) % 360;
}

function adjustRelativeChannel(baseValue: number, control: number) {
  const safeBase = Math.min(1, Math.max(0, baseValue));
  const safeControl = Math.min(1, Math.max(0, control));
  return safeControl < 0.5
    ? safeBase * (safeControl / 0.5)
    : safeBase + (1 - safeBase) * ((safeControl - 0.5) / 0.5);
}

function hexToHsl(hex: string): HslColor {
  const value = hex.replace("#", "");
  const red = parseInt(value.slice(0, 2), 16) / 255;
  const green = parseInt(value.slice(2, 4), 16) / 255;
  const blue = parseInt(value.slice(4, 6), 16) / 255;
  const maximum = Math.max(red, green, blue);
  const minimum = Math.min(red, green, blue);
  const delta = maximum - minimum;
  const lightness = (maximum + minimum) / 2;

  if (delta === 0) {
    return { hue: 0, saturation: 0, lightness };
  }

  const saturation = delta / (1 - Math.abs(2 * lightness - 1));
  let hue = 0;

  if (maximum === red) {
    hue = 60 * (((green - blue) / delta) % 6);
  } else if (maximum === green) {
    hue = 60 * ((blue - red) / delta + 2);
  } else {
    hue = 60 * ((red - green) / delta + 4);
  }

  return { hue: normalizeHue(hue), saturation, lightness };
}

function hslToHex(hue: number, saturation: number, lightness: number) {
  const safeHue = normalizeHue(hue);
  const safeSaturation = Math.min(1, Math.max(0, saturation));
  const safeLightness = Math.min(1, Math.max(0, lightness));
  const chroma = (1 - Math.abs(2 * safeLightness - 1)) * safeSaturation;
  const hueSection = safeHue / 60;
  const secondary = chroma * (1 - Math.abs((hueSection % 2) - 1));
  let colorSection: [number, number, number];

  if (hueSection < 1) colorSection = [chroma, secondary, 0];
  else if (hueSection < 2) colorSection = [secondary, chroma, 0];
  else if (hueSection < 3) colorSection = [0, chroma, secondary];
  else if (hueSection < 4) colorSection = [0, secondary, chroma];
  else if (hueSection < 5) colorSection = [secondary, 0, chroma];
  else colorSection = [chroma, 0, secondary];

  const match = safeLightness - chroma / 2;
  return `#${colorSection
    .map((channel) =>
      Math.round((channel + match) * 255)
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`;
}

function generateXPositions(seed: bigint) {
  const random = new StableRandom(toUint64(seed ^ 0x4f1bbcdcbfa54001n));
  const segmentWidth = 1 / (WAVE_POINT_COUNT - 1);

  return Array.from({ length: WAVE_POINT_COUNT }, (_, index) => {
    if (index === 0) return 0;
    if (index === WAVE_POINT_COUNT - 1) return 1;
    const defaultX = index * segmentWidth;
    const jitter = random.nextSignedFloat() * segmentWidth * 0.3;
    return Math.min(1, Math.max(0, defaultX + jitter));
  });
}

function formatSvgNumber(value: number) {
  const rounded = Number(value.toFixed(3));
  return Object.is(rounded, -0) ? "0" : String(rounded);
}

function createSmoothFilledPath(
  points: Point[],
  width: number,
  height: number,
) {
  const factor = WAVE_SMOOTHNESS / 6;
  let path = `M ${formatSvgNumber(points[0].x)} ${formatSvgNumber(points[0].y)}`;
  const inTangents = points.map(() => ({ x: 0, y: 0 }));
  const outTangents = points.map(() => ({ x: 0, y: 0 }));

  for (let index = 0; index < points.length - 1; index += 1) {
    const previousPoint = points[Math.max(index - 1, 0)];
    const currentPoint = points[index];
    const nextPoint = points[index + 1];
    const afterNextPoint = points[Math.min(index + 2, points.length - 1)];
    const controlPoint1 = {
      x: currentPoint.x + (nextPoint.x - previousPoint.x) * factor,
      y: currentPoint.y + (nextPoint.y - previousPoint.y) * factor,
    };
    const controlPoint2 = {
      x: nextPoint.x - (afterNextPoint.x - currentPoint.x) * factor,
      y: nextPoint.y - (afterNextPoint.y - currentPoint.y) * factor,
    };
    outTangents[index] = {
      x: controlPoint1.x - currentPoint.x,
      y: controlPoint1.y - currentPoint.y,
    };
    inTangents[index + 1] = {
      x: controlPoint2.x - nextPoint.x,
      y: controlPoint2.y - nextPoint.y,
    };

    path += ` C ${formatSvgNumber(controlPoint1.x)} ${formatSvgNumber(controlPoint1.y)}`;
    path += ` ${formatSvgNumber(controlPoint2.x)} ${formatSvgNumber(controlPoint2.y)}`;
    path += ` ${formatSvgNumber(nextPoint.x)} ${formatSvgNumber(nextPoint.y)}`;
  }

  const vertices = [...points, { x: width, y: height }, { x: 0, y: height }];
  return {
    path: `${path} L ${width} ${height} L 0 ${height} Z`,
    shape: {
      vertices,
      inTangents: [...inTangents, { x: 0, y: 0 }, { x: 0, y: 0 }],
      outTangents: [...outTangents, { x: 0, y: 0 }, { x: 0, y: 0 }],
    },
  };
}

function generateWaveScene(parameters: WaveParameters): WaveScene {
  const seed = seedAsBigInt(parameters.seed);
  const baseHsl = hexToHsl(parameters.baseColor);
  const adjustedSaturation = adjustRelativeChannel(
    baseHsl.saturation,
    parameters.saturation / 100,
  );
  const adjustedLightness = adjustRelativeChannel(
    baseHsl.lightness,
    parameters.lightness / 100,
  );
  const xPositions = generateXPositions(seed);
  const previousLayerY = Array.from(
    { length: WAVE_POINT_COUNT },
    () => Number.NEGATIVE_INFINITY,
  );

  const layers = Array.from(
    { length: parameters.numberOfWaves },
    (_, layerIndex) => {
      const layerProgress = normalizedProgress(
        layerIndex,
        parameters.numberOfWaves,
      );
      const random = new StableRandom(
        toUint64(seed ^ toUint64(BigInt(layerIndex + 1) * PRNG_GAMMA)),
      );
      const startY = lerp(-0.48, 0.14, layerProgress);
      const slope = lerp(0.44, 0.6, layerProgress);
      const amplitude =
        lerp(0.055, 0.095, layerProgress) * (0.8 + random.nextFloat() * 0.4);
      const minimumLayerGap = lerp(0.035, 0.06, layerProgress);
      const points = Array.from(
        { length: WAVE_POINT_COUNT },
        (_, pointIndex) => {
          const xProgress = normalizedProgress(pointIndex, WAVE_POINT_COUNT);
          const baseY = startY + slope * xProgress;
          const randomY = random.nextSignedFloat() * amplitude;
          let normalizedY = baseY + randomY;

          if (layerIndex > 0) {
            normalizedY = Math.max(
              normalizedY,
              previousLayerY[pointIndex] + minimumLayerGap,
            );
          }

          normalizedY = Math.min(1.1, Math.max(-0.75, normalizedY));
          previousLayerY[pointIndex] = normalizedY;
          return {
            x: xPositions[pointIndex] * parameters.width,
            y: normalizedY * parameters.height,
          };
        },
      );

      const hue = normalizeHue(
        baseHsl.hue + (layerProgress - 0.5) * parameters.hueRange,
      );
      const layerLightness = Math.min(
        0.96,
        Math.max(0.04, adjustedLightness + (layerProgress - 0.5) * 0.16),
      );

      const pathData = createSmoothFilledPath(
        points,
        parameters.width,
        parameters.height,
      );

      return {
        id: `wave-${String(layerIndex + 1).padStart(2, "0")}`,
        ...pathData,
        gradient: {
          start: hslToHex(hue, adjustedSaturation, layerLightness + 0.1),
          end: hslToHex(
            hue + 8,
            adjustedSaturation * 0.88,
            layerLightness - 0.15,
          ),
          startPoint: {
            x: parameters.width * lerp(0.7, 0.45, layerProgress),
            y: parameters.height * lerp(-0.45, 0.1, layerProgress),
          },
          endPoint: { x: parameters.width * 0.25, y: parameters.height * 1.15 },
        },
      };
    },
  );

  return {
    width: parameters.width,
    height: parameters.height,
    seed: parameters.seed,
    backgroundColor: parameters.backgroundColor,
    layers,
  };
}

function sceneToSvg(scene: WaveScene) {
  const gradients = scene.layers
    .map(
      (layer) =>
        `<linearGradient id="${layer.id}-gradient" gradientUnits="userSpaceOnUse" x1="${formatSvgNumber(layer.gradient.startPoint.x)}" y1="${formatSvgNumber(layer.gradient.startPoint.y)}" x2="${formatSvgNumber(layer.gradient.endPoint.x)}" y2="${formatSvgNumber(layer.gradient.endPoint.y)}"><stop offset="0%" stop-color="${layer.gradient.start}"/><stop offset="100%" stop-color="${layer.gradient.end}"/></linearGradient>`,
    )
    .join("");
  const paths = scene.layers
    .map(
      (layer) =>
        `<path id="${layer.id}" d="${layer.path}" fill="url(#${layer.id}-gradient)"/>`,
    )
    .join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${scene.width}" height="${scene.height}" viewBox="0 0 ${scene.width} ${scene.height}"><title>Generated wave artwork</title><defs>${gradients}</defs><rect width="100%" height="100%" fill="${scene.backgroundColor}"/>${paths}</svg>`;
}

function sceneToAfterEffectsJsx(scene: WaveScene) {
  const sceneData = JSON.stringify(
    {
      width: scene.width,
      height: scene.height,
      seed: scene.seed,
      backgroundColor: scene.backgroundColor,
      layers: scene.layers.map((layer) => ({
        id: layer.id,
        vertices: layer.shape.vertices.map((point) => [
          Number(point.x.toFixed(3)),
          Number(point.y.toFixed(3)),
        ]),
        inTangents: layer.shape.inTangents.map((point) => [
          Number(point.x.toFixed(3)),
          Number(point.y.toFixed(3)),
        ]),
        outTangents: layer.shape.outTangents.map((point) => [
          Number(point.x.toFixed(3)),
          Number(point.y.toFixed(3)),
        ]),
        gradient: {
          start: layer.gradient.start,
          end: layer.gradient.end,
          startPoint: [
            Number(layer.gradient.startPoint.x.toFixed(3)),
            Number(layer.gradient.startPoint.y.toFixed(3)),
          ],
          endPoint: [
            Number(layer.gradient.endPoint.x.toFixed(3)),
            Number(layer.gradient.endPoint.y.toFixed(3)),
          ],
        },
      })),
    },
    null,
    2,
  );

  return `/*
 * Wave / Lab — After Effects layer export
 * Generated from seed ${scene.seed} at ${scene.width} × ${scene.height}px.
 * Run this file from After Effects: File > Scripts > Run Script File.
 */
(function () {
  var scene = ${sceneData};
  var duration = 10;
  var frameRate = 30;

  function hexToRgb(hex) {
    var value = hex.replace('#', '');
    return [
      parseInt(value.substr(0, 2), 16) / 255,
      parseInt(value.substr(2, 2), 16) / 255,
      parseInt(value.substr(4, 2), 16) / 255
    ];
  }

  function hexToColor(hex) {
    var rgb = hexToRgb(hex);
    return [rgb[0], rgb[1], rgb[2], 1];
  }

  function addWaveLayer(comp, layerData) {
    // Use one full-size solid per wave with a vector mask. Gradient Ramp
    // accepts color values through JSX reliably, unlike Shape Layer's
    // Gradient Colors property on several AE versions.
    var layer = comp.layers.addSolid(
      hexToRgb(layerData.gradient.start),
      layerData.id.replace('wave-', 'Wave '),
      scene.width,
      scene.height,
      1,
      duration
    );
    layer.name = layerData.id.replace('wave-', 'Wave ');

    var mask = layer.property('ADBE Mask Parade').addProperty('ADBE Mask Atom');
    mask.name = 'Wave Path';
    var shape = new Shape();
    shape.vertices = layerData.vertices;
    shape.inTangents = layerData.inTangents;
    shape.outTangents = layerData.outTangents;
    shape.closed = true;
    mask.property('ADBE Mask Shape').setValue(shape);
    mask.maskMode = MaskMode.ADD;
    mask.inverted = false;

    var ramp = layer.property('ADBE Effect Parade').addProperty('ADBE Ramp');
    ramp.name = 'Wave Gradient';
    ramp.property('ADBE Ramp-0001').setValue(layerData.gradient.startPoint);
    ramp.property('ADBE Ramp-0002').setValue(hexToColor(layerData.gradient.start));
    ramp.property('ADBE Ramp-0003').setValue(layerData.gradient.endPoint);
    ramp.property('ADBE Ramp-0004').setValue(hexToColor(layerData.gradient.end));
    ramp.property('ADBE Ramp-0005').setValue(1);
    ramp.property('ADBE Ramp-0006').setValue(0);
    ramp.property('ADBE Ramp-0007').setValue(0);
    return layer;
  }

  app.beginUndoGroup('Create Wave Lab Layers');

  if (!app.project) app.newProject();

  var comp = app.project.items.addComp(
    'Wave Lab — Seed ' + scene.seed,
    scene.width,
    scene.height,
    1,
    duration,
    frameRate
  );
  comp.bgColor = hexToRgb(scene.backgroundColor);

  var background = comp.layers.addSolid(
    hexToRgb(scene.backgroundColor),
    'Background',
    scene.width,
    scene.height,
    1,
    duration
  );

  for (var index = 0; index < scene.layers.length; index += 1) {
    addWaveLayer(comp, scene.layers[index]);
  }

  background.moveToEnd();
  comp.openInViewer();
  app.endUndoGroup();
})();
`;
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function Icon({
  name,
}: {
  name: "arrow" | "dice" | "download" | "reset" | "theme";
}) {
  const paths = {
    arrow: "M5 12h14M13 6l6 6-6 6",
    dice: "M4 4h6v6H4zM14 14h6v6h-6zM14 4h6v6h-6zM4 14h6v6H4zM13 11h-2M12 10v2",
    download: "M12 3v12m0 0 4-4m-4 4-4-4M4 21h16",
    reset: "M4 12a8 8 0 1 0 2.3-5.7L4 8.6M4 4v4.6h4.6",
    theme:
      "M12 3v2M12 19v2M5.6 5.6 7 7M17 17l1.4 1.4M3 12h2M19 12h2M5.6 18.4 7 17M17 7l1.4-1.4M16.5 12a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0Z",
  };

  return (
    <svg aria-hidden="true" className="icon" viewBox="0 0 24 24" fill="none">
      <path
        d={paths[name]}
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function RangeControl({
  label,
  value,
  min,
  max,
  step,
  displayValue,
  onChange,
  accent,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  displayValue: string;
  onChange: (value: number) => void;
  accent: string;
}) {
  return (
    <div className="control-group">
      <div className="control-heading">
        <label htmlFor={label}>{label}</label>
        <output htmlFor={label}>{displayValue}</output>
      </div>
      <input
        id={label}
        className="range-input"
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        style={
          {
            "--range-accent": accent,
            "--range-progress": `${((value - min) / (max - min)) * 100}%`,
          } as CSSProperties
        }
      />
    </div>
  );
}

export default function Home() {
  const [parameters, setParameters] = useState(DEFAULT_PARAMETERS);
  const [dimensionDrafts, setDimensionDrafts] = useState({
    width: String(DEFAULT_PARAMETERS.width),
    height: String(DEFAULT_PARAMETERS.height),
  });
  const [isDarkTheme, setIsDarkTheme] = useState(true);
  const [savedColors, setSavedColors] = useState<string[]>([]);
  const [hoveredLayer, setHoveredLayer] = useState<string | null>(null);
  const [exportState, setExportState] = useState<
    "idle" | "svg" | "jpg" | "jsx"
  >("idle");
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

  useEffect(() => {
    let nextColors: string[] = [];
    try {
      const storedColors = JSON.parse(
        window.localStorage.getItem(SAVED_COLORS_KEY) ?? "[]",
      );
      if (Array.isArray(storedColors)) {
        nextColors = storedColors.filter(
          (color): color is string =>
            typeof color === "string" && /^#[0-9a-f]{6}$/i.test(color),
        );
      }
    } catch {}

    const timer = window.setTimeout(() => setSavedColors(nextColors), 0);
    return () => window.clearTimeout(timer);
  }, []);

  const updateParameter = <K extends keyof WaveParameters>(
    key: K,
    value: WaveParameters[K],
  ) => {
    setParameters((current) => ({ ...current, [key]: value }));
  };

  const updateSeed = (event: ChangeEvent<HTMLInputElement>) => {
    const nextValue = Number(event.target.value);
    updateParameter(
      "seed",
      Number.isFinite(nextValue)
        ? Math.trunc(nextValue)
        : DEFAULT_PARAMETERS.seed,
    );
  };

  const updateDimensionDraft = (
    key: "width" | "height",
    event: ChangeEvent<HTMLInputElement>,
  ) => {
    setDimensionDrafts((current) => ({
      ...current,
      [key]: event.target.value,
    }));
  };

  const commitDimension = (key: "width" | "height") => {
    const parsedValue = Number(dimensionDrafts[key]);
    const nextValue = Number.isFinite(parsedValue)
      ? Math.min(5000, Math.max(240, Math.round(parsedValue)))
      : DEFAULT_PARAMETERS[key];

    setDimensionDrafts((current) => ({ ...current, [key]: String(nextValue) }));
    updateParameter(key, nextValue);
  };

  const applyDimensions = (width: number, height: number) => {
    setParameters((current) => ({ ...current, width, height }));
    setDimensionDrafts({ width: String(width), height: String(height) });
  };

  const resetParameters = () => {
    setParameters(DEFAULT_PARAMETERS);
    setDimensionDrafts({
      width: String(DEFAULT_PARAMETERS.width),
      height: String(DEFAULT_PARAMETERS.height),
    });
  };

  const randomizeSeed = () => {
    updateParameter("seed", Math.floor(Math.random() * 99999) + 1);
  };

  const saveCustomColor = (color: string) => {
    const normalizedColor = color.toLowerCase();
    if (COLOR_SWATCHES.includes(normalizedColor)) return;

    setSavedColors((current) => {
      const nextColors = [
        normalizedColor,
        ...current.filter((saved) => saved !== normalizedColor),
      ].slice(0, 12);
      window.localStorage.setItem(SAVED_COLORS_KEY, JSON.stringify(nextColors));
      return nextColors;
    });
  };

  const updateBaseColor = (event: ChangeEvent<HTMLInputElement>) => {
    updateParameter("baseColor", event.target.value);
  };

  const removeSavedColor = (color: string) => {
    setSavedColors((current) => {
      const nextColors = current.filter((saved) => saved !== color);
      window.localStorage.setItem(SAVED_COLORS_KEY, JSON.stringify(nextColors));
      return nextColors;
    });
  };

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
    <main className={`app-shell ${isDarkTheme ? "theme-dark" : "theme-light"}`}>
      <section className="workspace-grid">
        <div className="preview-column">
          <div className="canvas-viewport" ref={canvasViewportRef}>
            <div
              className="canvas-frame"
              style={{
                aspectRatio: `${parameters.width} / ${parameters.height}`,
                ...(canvasWidth && canvasHeight
                  ? { width: canvasWidth, height: canvasHeight }
                  : {}),
              }}
            >
              <svg
                className="wave-canvas"
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
                    className={
                      hoveredLayer === layer.id
                        ? "wave-layer is-hovered"
                        : "wave-layer"
                    }
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

        <aside className="controls-panel">
          <div className="section-bar panel-bar">
            <div>
              <span className="section-label">Parameters</span>
            </div>
            <div className="panel-actions">
              <button
                className="theme-toggle"
                type="button"
                onClick={() => setIsDarkTheme((current) => !current)}
                aria-label={`Switch to ${isDarkTheme ? "light" : "dark"} theme`}
              >
                <Icon name="theme" />
                <span>{isDarkTheme ? "Light" : "Dark"}</span>
              </button>
              <button
                className="icon-button"
                type="button"
                onClick={resetParameters}
                aria-label="Reset parameters"
                title="Reset parameters"
              >
                <Icon name="reset" />
              </button>
            </div>
          </div>

          <div className="panel-scroll">
            <div className="control-section">
              <div className="section-title-row">
                <h2>Canvas</h2>
              </div>
              <div className="preset-row">
                {PRESETS.map((preset) => (
                  <button
                    key={preset.label}
                    className={
                      parameters.width === preset.width &&
                      parameters.height === preset.height
                        ? "preset-button is-selected"
                        : "preset-button"
                    }
                    type="button"
                    onClick={() => applyDimensions(preset.width, preset.height)}
                  >
                    <span>{preset.label}</span>
                    <small>
                      {preset.width} × {preset.height}
                    </small>
                  </button>
                ))}
              </div>
              <div className="dimensions-grid">
                <label className="field-label">
                  <span>Width</span>
                  <input
                    type="number"
                    min="240"
                    max="5000"
                    inputMode="numeric"
                    value={dimensionDrafts.width}
                    onChange={(event) => updateDimensionDraft("width", event)}
                    onBlur={() => commitDimension("width")}
                  />
                  <small>px</small>
                </label>
                <label className="field-label">
                  <span>Height</span>
                  <input
                    type="number"
                    min="240"
                    max="5000"
                    inputMode="numeric"
                    value={dimensionDrafts.height}
                    onChange={(event) => updateDimensionDraft("height", event)}
                    onBlur={() => commitDimension("height")}
                  />
                  <small>px</small>
                </label>
              </div>
            </div>

            <div className="control-section">
              <div className="section-title-row">
                <h2>Structure</h2>
              </div>
              <div className="seed-field">
                <label className="field-label field-label-wide">
                  <span>Seed</span>
                  <input
                    type="number"
                    value={parameters.seed}
                    onChange={updateSeed}
                  />
                </label>
                <button
                  className="dice-button"
                  type="button"
                  onClick={randomizeSeed}
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
            </div>

            <div className="control-section color-section">
              <div className="section-title-row">
                <h2>Color field</h2>
              </div>
              <div className="color-input-row">
                <label className="color-picker">
                  <input
                    type="color"
                    value={parameters.baseColor}
                    onChange={updateBaseColor}
                    onBlur={() => saveCustomColor(parameters.baseColor)}
                    aria-label="Base color"
                  />
                  <span
                    className="color-preview"
                    style={{ backgroundColor: parameters.baseColor }}
                  />
                  <span>{parameters.baseColor.toUpperCase()}</span>
                </label>
                <label className="background-picker">
                  <span>BG</span>
                  <input
                    type="color"
                    value={parameters.backgroundColor}
                    onChange={(event) =>
                      updateParameter("backgroundColor", event.target.value)
                    }
                    aria-label="Background color"
                  />
                  <span
                    className="background-preview"
                    style={{ backgroundColor: parameters.backgroundColor }}
                  />
                </label>
              </div>
              <div className="swatch-row" aria-label="Color presets">
                {COLOR_SWATCHES.map((swatch) => (
                  <button
                    key={swatch}
                    className={
                      parameters.baseColor === swatch
                        ? "swatch is-selected"
                        : "swatch"
                    }
                    type="button"
                    style={{ backgroundColor: swatch }}
                    onClick={() => updateParameter("baseColor", swatch)}
                    aria-label={`Use ${swatch} as base color`}
                  />
                ))}
              </div>
              {savedColors.length > 0 && (
                <div className="saved-colors">
                  <span className="saved-colors-label">Saved colors</span>
                  <div className="saved-colors-list">
                    {savedColors.map((color) => (
                      <div className="saved-color" key={color}>
                        <button
                          className={
                            parameters.baseColor === color
                              ? "swatch is-selected"
                              : "swatch"
                          }
                          type="button"
                          style={{ backgroundColor: color }}
                          onClick={() => updateParameter("baseColor", color)}
                          aria-label={`Use saved color ${color}`}
                        />
                        <button
                          className="remove-color"
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
            </div>
          </div>

          <div className="export-panel">
            <div className="export-heading">
              <div>
                <span className="section-label">Export</span>
              </div>
            </div>
            <div className="export-buttons">
              <button
                className="export-button export-button-primary"
                type="button"
                onClick={exportSvg}
                disabled={exportState !== "idle"}
              >
                <span>
                  <Icon name="download" /> SVG
                </span>
                <Icon name="arrow" />
              </button>
              <button
                className="export-button"
                type="button"
                onClick={exportJpg}
                disabled={exportState !== "idle"}
              >
                <span>
                  <Icon name="download" /> JPG
                </span>
                <Icon name="arrow" />
              </button>
              <button
                className="export-button export-button-ae"
                type="button"
                onClick={exportAfterEffects}
                disabled={exportState !== "idle"}
              >
                <span>
                  <Icon name="download" /> AE JSX
                </span>
                <Icon name="arrow" />
              </button>
            </div>
            {exportState !== "idle" && (
              <p className="export-feedback">
                Preparing {exportState.toUpperCase()}…
              </p>
            )}
          </div>
        </aside>
      </section>

      <footer className="app-footer">
        <span>Catmull–Rom spline / cubic Bézier output</span>
        <span className="footer-divider" />
        <span>Designed for motion, exported as vector</span>
      </footer>
    </main>
  );
}
