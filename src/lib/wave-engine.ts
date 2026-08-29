type Point = { x: number; y: number };

export type WaveParameters = {
  width: number;
  height: number;
  seed: number;
  numberOfWaves: number;
  rotation: number;
  hueRange: number;
  saturation: number;
  lightness: number;
  baseColor: string;
  colorOverrides?: Record<string, string>;
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

export type WaveScene = {
  width: number;
  height: number;
  seed: number;
  backgroundColor: string;
  layers: WaveLayer[];
};

type HslColor = { hue: number; saturation: number; lightness: number };

export const DEFAULT_PARAMETERS: WaveParameters = {
  width: 1920,
  height: 1080,
  seed: 199,
  numberOfWaves: 5,
  rotation: 0,
  hueRange: 60,
  saturation: 60,
  lightness: 50,
  baseColor: "#6d63ff",
  colorOverrides: {},
};

const BACKGROUND_COLOR = "#11121c";

export const COLOR_SWATCHES = [
  "#6d63ff",
  "#ff705d",
  "#ffb84d",
  "#40c7b4",
  "#da67cf",
];
export const SAVED_COLORS_KEY = "wave-lab-saved-colors";
export const PRESETS = [
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

function rotatePoint(point: Point, angle: number, width: number, height: number) {
  const centerX = width / 2;
  const centerY = height / 2;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const offsetX = point.x - centerX;
  const offsetY = point.y - centerY;

  return {
    x: centerX + offsetX * cos - offsetY * sin,
    y: centerY + offsetX * sin + offsetY * cos,
  };
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
  let hue: number;

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
  closingPoints: Point[],
  extensionLength = 0,
) {
  const factor = WAVE_SMOOTHNESS / 6;
  const inTangents = points.map(() => ({ x: 0, y: 0 }));
  const outTangents = points.map(() => ({ x: 0, y: 0 }));
  const controlPoints1: Point[] = [];
  const controlPoints2: Point[] = [];

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
    controlPoints1.push(controlPoint1);
    controlPoints2.push(controlPoint2);
  }

  const firstPoint = points[0];
  const lastPoint = points[points.length - 1];
  const firstOutTangent = controlPoints1[0]
    ? {
        x: controlPoints1[0].x - firstPoint.x,
        y: controlPoints1[0].y - firstPoint.y,
      }
    : { x: 1, y: 0 };
  const lastInTangent = controlPoints2[controlPoints2.length - 1]
    ? {
        x: lastPoint.x - controlPoints2[controlPoints2.length - 1].x,
        y: lastPoint.y - controlPoints2[controlPoints2.length - 1].y,
      }
    : { x: 1, y: 0 };
  const firstTangentLength = Math.hypot(firstOutTangent.x, firstOutTangent.y) || 1;
  const lastTangentLength = Math.hypot(lastInTangent.x, lastInTangent.y) || 1;
  const startPoint = {
    x: firstPoint.x - (firstOutTangent.x / firstTangentLength) * extensionLength,
    y: firstPoint.y - (firstOutTangent.y / firstTangentLength) * extensionLength,
  };
  const endPoint = {
    x: lastPoint.x + (lastInTangent.x / lastTangentLength) * extensionLength,
    y: lastPoint.y + (lastInTangent.y / lastTangentLength) * extensionLength,
  };
  const startControlPoint1 = {
    x: startPoint.x + (firstPoint.x - startPoint.x) * 0.67,
    y: startPoint.y + (firstPoint.y - startPoint.y) * 0.67,
  };
  const startControlPoint2 = {
    x: firstPoint.x - firstOutTangent.x,
    y: firstPoint.y - firstOutTangent.y,
  };
  const endControlPoint1 = {
    x: lastPoint.x + lastInTangent.x,
    y: lastPoint.y + lastInTangent.y,
  };
  const endControlPoint2 = {
    x: endPoint.x - (endPoint.x - lastPoint.x) * 0.33,
    y: endPoint.y - (endPoint.y - lastPoint.y) * 0.33,
  };
  const hasExtension = extensionLength > 0;
  const pathStart = hasExtension ? startPoint : firstPoint;
  let path = `M ${formatSvgNumber(pathStart.x)} ${formatSvgNumber(pathStart.y)}`;
  if (hasExtension) {
    path += ` C ${formatSvgNumber(startControlPoint1.x)} ${formatSvgNumber(startControlPoint1.y)}`;
    path += ` ${formatSvgNumber(startControlPoint2.x)} ${formatSvgNumber(startControlPoint2.y)}`;
    path += ` ${formatSvgNumber(firstPoint.x)} ${formatSvgNumber(firstPoint.y)}`;
  }

  for (let index = 0; index < controlPoints1.length; index += 1) {
    const controlPoint1 = controlPoints1[index];
    const controlPoint2 = controlPoints2[index];
    const nextPoint = points[index + 1];

    path += ` C ${formatSvgNumber(controlPoint1.x)} ${formatSvgNumber(controlPoint1.y)}`;
    path += ` ${formatSvgNumber(controlPoint2.x)} ${formatSvgNumber(controlPoint2.y)}`;
    path += ` ${formatSvgNumber(nextPoint.x)} ${formatSvgNumber(nextPoint.y)}`;
  }

  if (hasExtension) {
    path += ` C ${formatSvgNumber(endControlPoint1.x)} ${formatSvgNumber(endControlPoint1.y)}`;
    path += ` ${formatSvgNumber(endControlPoint2.x)} ${formatSvgNumber(endControlPoint2.y)}`;
    path += ` ${formatSvgNumber(endPoint.x)} ${formatSvgNumber(endPoint.y)}`;
  }

  const closingPath = closingPoints
    .map(
      (point) =>
        ` L ${formatSvgNumber(point.x)} ${formatSvgNumber(point.y)}`,
    )
    .join("");
  return {
    path: `${path}${closingPath} Z`,
    shape: {
      vertices: [
        ...(hasExtension ? [startPoint] : []),
        ...points,
        ...(hasExtension ? [endPoint] : []),
        ...closingPoints,
      ],
      inTangents: [
        ...(hasExtension ? [{ x: 0, y: 0 }] : []),
        ...inTangents,
        ...(hasExtension ? [{ x: endControlPoint2.x - endPoint.x, y: endControlPoint2.y - endPoint.y }] : []),
        ...closingPoints.map(() => ({ x: 0, y: 0 })),
      ],
      outTangents: [
        ...(hasExtension ? [{ x: startControlPoint1.x - startPoint.x, y: startControlPoint1.y - startPoint.y }] : []),
        ...outTangents,
        ...(hasExtension ? [{ x: 0, y: 0 }] : []),
        ...closingPoints.map(() => ({ x: 0, y: 0 })),
      ],
    },
  };
}

export function generateWaveScene(parameters: WaveParameters): WaveScene {
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
  const rotationDegrees = ((parameters.rotation % 360) + 360) % 360;
  const rotation = (rotationDegrees * Math.PI) / 180;
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

      const pathPoints = points.map((point) =>
        rotatePoint(point, rotation, parameters.width, parameters.height),
      );
      const fillMargin = Math.hypot(parameters.width, parameters.height) * 1.2;
      const closingPoints =
        rotationDegrees === 0
          ? [
              { x: parameters.width, y: parameters.height },
              { x: 0, y: parameters.height },
            ]
          : [
              rotatePoint(
                {
                  x: parameters.width + fillMargin,
                  y: parameters.height + fillMargin,
                },
                rotation,
                parameters.width,
                parameters.height,
              ),
              rotatePoint(
                { x: -fillMargin, y: parameters.height + fillMargin },
                rotation,
                parameters.width,
                parameters.height,
              ),
            ];
      const pathData = createSmoothFilledPath(
        pathPoints,
        closingPoints,
        rotationDegrees === 0 ? 0 : fillMargin,
      );

      const layerId = `wave-${String(layerIndex + 1).padStart(2, "0")}`;
      const colorOverride = parameters.colorOverrides?.[layerId];
      const safeColorOverride =
        colorOverride && /^#[0-9a-f]{6}$/i.test(colorOverride)
          ? colorOverride.toLowerCase()
          : null;
      const layerBaseHsl = safeColorOverride
        ? hexToHsl(safeColorOverride)
        : baseHsl;
      const layerSaturation = safeColorOverride
        ? adjustRelativeChannel(
            layerBaseHsl.saturation,
            parameters.saturation / 100,
          )
        : adjustedSaturation;
      const layerLightnessBase = safeColorOverride
        ? adjustRelativeChannel(
            layerBaseHsl.lightness,
            parameters.lightness / 100,
          )
        : adjustedLightness;
      const hue = normalizeHue(
        layerBaseHsl.hue + (layerProgress - 0.5) * parameters.hueRange,
      );
      const layerLightness = Math.min(
        0.96,
        Math.max(0.04, layerLightnessBase + (layerProgress - 0.5) * 0.16),
      );

      return {
        id: layerId,
        ...pathData,
        gradient: {
          start: hslToHex(hue, layerSaturation, layerLightness + 0.1),
          end: hslToHex(hue + 8, layerSaturation * 0.88, layerLightness - 0.15),
          startPoint: rotatePoint(
            {
              x: parameters.width * lerp(0.7, 0.45, layerProgress),
              y: parameters.height * lerp(-0.45, 0.1, layerProgress),
            },
            rotation,
            parameters.width,
            parameters.height,
          ),
          endPoint: rotatePoint(
            { x: parameters.width * 0.25, y: parameters.height * 1.15 },
            rotation,
            parameters.width,
            parameters.height,
          ),
        },
      };
    },
  );

  return {
    width: parameters.width,
    height: parameters.height,
    seed: parameters.seed,
    backgroundColor: BACKGROUND_COLOR,
    layers,
  };
}

export function sceneToSvg(scene: WaveScene) {
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

  const canvasFill = scene.layers[0]
    ? `url(#${scene.layers[0].id}-gradient)`
    : scene.backgroundColor;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${scene.width}" height="${scene.height}" viewBox="0 0 ${scene.width} ${scene.height}"><title>Generated wave artwork</title><defs>${gradients}</defs><rect width="100%" height="100%" fill="${canvasFill}"/>${paths}</svg>`;
}

export function sceneToAfterEffectsJsx(scene: WaveScene) {
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
  const canvasFill = scene.layers[0]?.gradient.start ?? scene.backgroundColor;
  comp.bgColor = hexToRgb(canvasFill);

  var background = comp.layers.addSolid(
    hexToRgb(canvasFill),
    'Background',
    scene.width,
    scene.height,
    1,
    duration
  );

  if (scene.layers.length > 0) {
    var backgroundRamp = background.property('ADBE Effect Parade').addProperty('ADBE Ramp');
    backgroundRamp.name = 'Canvas Gradient';
    backgroundRamp.property('ADBE Ramp-0001').setValue(scene.layers[0].gradient.startPoint);
    backgroundRamp.property('ADBE Ramp-0002').setValue(hexToColor(scene.layers[0].gradient.start));
    backgroundRamp.property('ADBE Ramp-0003').setValue(scene.layers[0].gradient.endPoint);
    backgroundRamp.property('ADBE Ramp-0004').setValue(hexToColor(scene.layers[0].gradient.end));
    backgroundRamp.property('ADBE Ramp-0005').setValue(1);
    backgroundRamp.property('ADBE Ramp-0006').setValue(0);
    backgroundRamp.property('ADBE Ramp-0007').setValue(0);
  }

  for (var index = 0; index < scene.layers.length; index += 1) {
    addWaveLayer(comp, scene.layers[index]);
  }

  background.moveToEnd();
  comp.openInViewer();
  app.endUndoGroup();
})();
`;
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
