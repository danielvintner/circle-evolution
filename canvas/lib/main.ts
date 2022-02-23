import { CanvasOptions, Polygon } from "../../lib/types.ts";
import { getX, getY } from "../../lib/geometry.ts";
import { createCanvas, makeClear } from "../../lib/web.ts";

const defaultOptions: Readonly<CanvasOptions> = Object.freeze({
  maxCoordinate: 500,
  pointPadding: 5,
  polyStyle: "#000",
  pointStrokeStyle: "#000",
  pointFillStyle: "#FFF",
  historyStyle: "#666",
  backgroundStyle: "#FFF",
});

export function createCanvasManager(
  canvasContainerId: string,
  addOptions: Partial<CanvasOptions> = {},
) {
  const options = Object.assign({}, defaultOptions, addOptions);
  const size = options.maxCoordinate + options.pointPadding;
  const context = createCanvas(canvasContainerId, size, size);
  const drawPolygon = createDrawPolygon(context, options.polyStyle);
  const drawPoints = createDrawPoints(
    context,
    options.pointStrokeStyle,
    options.pointFillStyle,
    options.pointPadding,
  );
  const drawHistory = createDrawHistory(
    context,
    options.historyStyle,
    drawPolygon,
  );
  return (function () {
    let history: Polygon[] = [];
    let drawIndex: number = 0;
    let settings = {
      history: false,
      points: true,
      polygon: true,
    };
    const clear = makeClear(context, options.backgroundStyle, size, size);
    return {
      clear,
      draw: () => {
        clear();
        if (!history || history.length === 0) {
          return;
        }
        const currentPolygon: Polygon = history[drawIndex];
        settings.history && drawHistory(history.slice(0, drawIndex + 1));
        settings.polygon && drawPolygon(currentPolygon);
        settings.points && drawPoints(currentPolygon);
      },
      setHistory: (newHistory: Polygon[]) => {
        history = newHistory;
        drawIndex = history.length - 1;
      },
      setSettings: (
        setting: keyof typeof settings,
        value: boolean,
      ) => settings[setting] = value,
      setIndex: (newIndex: number) => drawIndex = newIndex,
    };
  }());
}

function createDrawHistory(
  context: CanvasRenderingContext2D,
  style: string,
  drawPolygon: (polygon: Polygon, style: string) => void,
) {
  return function (history: Polygon[]) {
    history.forEach(function (polygon: Polygon) {
      drawPolygon(polygon, style);
    });
  };
}

function createDrawPolygon(
  context: CanvasRenderingContext2D,
  style: string,
) {
  return function (polygon: Polygon, styleOverride = style) {
    context.strokeStyle = styleOverride;
    context.beginPath();
    context.moveTo(getX(polygon[0]), getY(polygon[0]));
    polygon.forEach(function (point) {
      context.lineTo(getX(point), getY(point));
    });
    context.closePath();
    context.stroke();
  };
}

function createDrawPoints(
  context: CanvasRenderingContext2D,
  strokeStyle: string,
  fillStyle: string,
  radius: number = 10,
) {
  return function (polygon: Polygon) {
    context.strokeStyle = strokeStyle;
    context.fillStyle = fillStyle;
    polygon.forEach(function (point) {
      const x = getX(point);
      const y = getY(point);
      context.beginPath();
      context.arc(getX(point), getY(point), radius, 0, 2 * Math.PI);
      context.closePath();
      context.fill();
      context.stroke();
    });
  };
}
