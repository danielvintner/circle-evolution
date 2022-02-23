import { createCanvas, makeClear } from "../../lib/web.ts";
import { times } from "../../lib/util.ts";

type Minmax = { min: number; max: number };

type GraphOptions = {
  canvasWidth: number;
  canvasHeight: number;
  labelPadding: number;
  rightSegments: number;
  bottomSegments: number;
  labelFont: string;
  backgroundStyle: string;
  fontStyle: string;
  rightAxisLabel: string;
  bottomAxisLabel: string;
  axisStyle: string;
  numberLabel: string;
  rightAxisUnits: number;
  bottomAxisUnits: number;
  graphStyle: string;
  dotSize: number;
  labelOffset: number;
  fractionX: number;
  fractionY: number;
  graphMargin: number;
  lineStrokeColor: string;
  dotStrokeColor: string;
  dotFillColor: string;
  lineDotSize: number;
  graphBackgroundStyle: string;
};

const defaultOptions: GraphOptions = {
  canvasWidth: 700,
  canvasHeight: 500,
  labelPadding: 30,
  rightSegments: 10,
  bottomSegments: 10,
  labelFont: "18px serif",
  numberLabel: "14px serif",
  backgroundStyle: "#e8e8e8",
  graphBackgroundStyle: "#fefefe",
  fontStyle: "#000",
  rightAxisLabel: "Right Axis label",
  bottomAxisLabel: "Bottom Axis label",
  rightAxisUnits: 10,
  bottomAxisUnits: 10,
  axisStyle: "#000",
  graphStyle: "#000",
  dotSize: 3,
  labelOffset: 10,
  fractionX: 0,
  fractionY: 3,
  graphMargin: 10,
  lineStrokeColor: "#000",
  dotStrokeColor: "#000",
  dotFillColor: "#FFF",
  lineDotSize: 3,
};

export function createGraphManager(
  graphContainerId: string,
  addOptions: Partial<GraphOptions> = {},
) {
  const options = Object.assign({}, defaultOptions, addOptions);
  const {
    fontStyle,
    labelPadding,
    canvasHeight,
    canvasWidth,
    labelFont,
    graphMargin,
  } = options;
  const context = createCanvas(graphContainerId, canvasWidth, canvasHeight);
  const clear = makeClear(
    context,
    options.graphBackgroundStyle,
    canvasWidth,
    canvasHeight,
  );
  const drawAxis = createDrawAxis(
    context,
    canvasWidth,
    canvasHeight,
    labelPadding,
    graphMargin,
    options.axisStyle,
    options.rightSegments,
    options.bottomSegments,
    options.numberLabel,
    options.labelOffset,
    options.dotSize,
  );
  const drawTrendline = createDrawTrendline(
    context,
    canvasWidth,
    canvasHeight,
    labelPadding,
    graphMargin,
    options.lineStrokeColor,
    options.dotStrokeColor,
    options.dotFillColor,
    options.lineDotSize,
  );
  const drawLabels = createdrawLabels(
    context,
    options.rightAxisLabel,
    options.bottomAxisLabel,
    canvasWidth,
    canvasHeight,
    labelPadding,
    labelFont,
    fontStyle,
    options.backgroundStyle,
  );
  return createDrawData(
    context,
    options.fractionX,
    options.fractionY,
    drawAxis,
    drawTrendline,
    clear,
    drawLabels,
  );
}

function createDrawData(
  context: CanvasRenderingContext2D,
  fractionX: number,
  fractionY: number,
  drawAxis: (
    min: number,
    max: number,
    fraction: number,
    isrightAxis?: boolean,
  ) => void,
  drawTrendline: (
    minmaxX: Minmax,
    minmaxY: Minmax,
    dataX: number[],
    dataY: number[],
  ) => void,
  clear: () => void,
  drawLabels: () => void,
) {
  return function (
    dataX: number[],
    dataY: number[],
    mmXoverride: Partial<Minmax> = {},
    mmYoverride: Partial<Minmax> = {},
  ) {
    let [minmaxX, minmaxY] = [dataX, dataY].map(function (data) {
      return {
        min: Math.min(...data),
        max: Math.max(...data),
      };
    });
    Object.assign(minmaxX, mmXoverride);
    Object.assign(minmaxY, mmYoverride);
    clear();
    drawTrendline(minmaxX, minmaxY, dataX, dataY);
    drawLabels();
    drawAxis(minmaxX.min, minmaxX.max, fractionX, false);
    drawAxis(minmaxY.min, minmaxY.max, fractionY, true);
  };
}

function createDrawTrendline(
  context: CanvasRenderingContext2D,
  canvasWidth: number,
  canvasHeight: number,
  labelPadding: number,
  graphMargin: number,
  lineStrokeColor: string,
  dotStrokeColor: string,
  dotFillColor: string,
  lineDotSize: number,
) {
  const graphWidth = canvasWidth - labelPadding - graphMargin;
  const graphHeight = canvasHeight - labelPadding - graphMargin;
  return function (
    minmaxX: { min: number; max: number },
    minmaxY: { min: number; max: number },
    dataX: number[],
    dataY: number[],
  ) {
    const width = minmaxX.max - minmaxX.min;
    const height = minmaxY.max - minmaxY.min;
    const realCoordinates = dataX.map(function (x, index) {
      const y = dataY[index];
      const realX = graphMargin +
        Math.floor((x - minmaxX.min) / width * graphWidth);
      const realY = (canvasHeight - labelPadding) -
        Math.floor((y - minmaxY.min) / height * graphHeight);
      return { x: realX, y: realY };
    });
    context.strokeStyle = lineStrokeColor;
    context.moveTo(realCoordinates[0].x, realCoordinates[0].y);
    realCoordinates.forEach(function ({ x, y }) {
      context.lineTo(x, y);
    });
    context.stroke();
    context.fillStyle = dotFillColor;
    context.strokeStyle = dotStrokeColor;
    realCoordinates.forEach(function ({ x, y }) {
      context.beginPath();
      context.arc(x, y, lineDotSize, 0, 2 * Math.PI);
      context.closePath();
      context.fill();
      context.stroke();
    });
  };
}

function createDrawAxis(
  context: CanvasRenderingContext2D,
  canvasWidth: number,
  canvasHeight: number,
  labelPadding: number,
  graphMargin: number,
  axisStyle: string,
  rightSegments: number,
  bottomSegments: number,
  numberLabel: string,
  labelOffset: number,
  dotSize: number,
) {
  const bottomAxisData = {
    segmentCount: bottomSegments,
    maxPixels: canvasWidth - labelPadding - graphMargin,
    textAlign: "center",
    offset: canvasHeight - labelPadding,
    textBaseline: "bottom",
    graphEnd: 0,
  };
  const rightAxisData = {
    segmentCount: rightSegments,
    maxPixels: canvasHeight - labelPadding - graphMargin,
    textAlign: "right",
    offset: canvasWidth - labelPadding,
    textBaseline: "middle",
    graphEnd: 0,
  };
  return function (
    min: number,
    max: number,
    fraction: number,
    isrightAxis = false,
  ) {
    const axisData = isrightAxis ? rightAxisData : bottomAxisData;
    const segments = segmentAxis(
      min,
      max,
      axisData.maxPixels,
      axisData.segmentCount,
      axisData.offset,
      axisData.graphEnd,
      labelOffset,
      labelPadding,
      graphMargin,
      fraction,
      isrightAxis,
    );
    context.fillStyle = axisStyle;
    context.textBaseline = axisData.textBaseline as CanvasTextBaseline;
    context.font = numberLabel;
    context.textAlign = axisData.textAlign as CanvasTextAlign;
    context.strokeStyle = "rgba(100,100,100,0.3)";
    segments.forEach(function ({ endX, endY, labelX, labelY, x, y, value, distance}) {
      context.beginPath();
      context.moveTo(x, y);
      context.lineTo(endX, endY);
      context.closePath();
      context.stroke();

      context.beginPath();
      context.arc(x, y, dotSize, 0, 2 * Math.PI);
      context.closePath();
      context.fill();
      context.fillText(value, labelX, labelY, !isrightAxis ? distance - labelOffset : undefined);
    });

    context.beginPath();
    context.moveTo(graphMargin, 0);
    context.lineTo(graphMargin, canvasHeight - labelPadding);
    context.closePath();
    context.stroke();
  };
}

function segmentAxis(
  minValue: number,
  maxValue: number,
  maxPixels: number,
  segmentCount: number,
  offset: number,
  graphEnd: number,
  labelOffset: number,
  labelPadding: number,
  graphMargin: number,
  fraction: number,
  reverse = false,
): {
  endX: number;
  endY: number;
  labelX: number;
  labelY: number;
  x: number;
  y: number;
  distance: number;
  value: string;
}[] {
  const segmentValue = (maxValue - minValue) / (segmentCount + 1);
  const segmentDistance = maxPixels / (segmentCount + 1);
  return times(segmentCount, function (segmentIndex: number) {
    let coordinates;
    const distance = Math.floor(segmentDistance * (segmentIndex + 1));
    if (reverse) {
      coordinates = {
        x: offset,
        y: distance + graphMargin,
        endX: graphEnd,
        endY: distance + graphMargin,
        labelX: offset - labelOffset,
        labelY: distance + graphMargin,
        distance: segmentDistance
      };
    } else {
      coordinates = {
        x: distance + graphMargin,
        y: offset,
        endX: distance + graphMargin,
        endY: graphEnd,
        labelX: distance + graphMargin,
        labelY: offset - labelOffset,
        distance: segmentDistance
      };
    }
    return {
      ...coordinates,
      value: (minValue + segmentValue * Math.abs(
            (reverse ? segmentCount + 1 : 0) - (segmentIndex + 1),
          )).toFixed(fraction),
    };
  });
}

function createdrawLabels(
  context: CanvasRenderingContext2D,
  rightAxisLabel: string,
  bottomAxisLabel: string,
  width: number,
  height: number,
  padding: number,
  font: string,
  fontStyle: string,
  backgroundStyle: string,
) {
  return function () {
    context.fillStyle = backgroundStyle;
    context.fillRect(
      0,
      height - padding,
      width,
      height,
    );
    context.fillRect(
      width - padding,
      0,
      width,
      height,
    );
    const fontHeight = parseInt(font, 10) + 5;
    context.textBaseline = "bottom";
    context.fillStyle = fontStyle;
    context.font = font;
    context.textAlign = "center";
    const diff = (padding - fontHeight) / 2;
    context.fillText(bottomAxisLabel, (width - padding) / 2, height - diff);
    context.save();
    context.translate(width / 2, height / 2);
    context.rotate(-Math.PI / 2);
    // context.fillText(rightAxisLabel, padding, -width / 2 + padding - diff);
    context.fillText(
      rightAxisLabel,
      padding / 2,
      (width - padding + fontHeight) / 2,
    );
    context.restore();
  };
}
