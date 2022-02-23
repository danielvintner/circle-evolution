import { findIntersections } from "./deps.ts";
import { EvoOptions, PolyData, Polygon, WorkerMessage } from "./types.ts";
import { getRandomInt, times } from "./util.ts";

function getRegularPolyCoordinate(polyRadius: number, polyPointCount: number) {
  return function (coordinate: number, index: number, fn: Function = Math.cos) {
    return Math.round(
      polyRadius * fn(2 * Math.PI * index / polyPointCount),
    ) + coordinate;
  };
}

function generateRegularPoly(
  polyX: number,
  polyY: number,
  polyRadius: number,
  polyPointCount: number,
): Polygon {
  const getCoordinate = getRegularPolyCoordinate(polyRadius, polyPointCount);
  return times(polyPointCount, function (index: number) {
    return [getCoordinate(polyX, index), getCoordinate(polyY, index, Math.sin)];
  });
}

function transform(
  points: Polygon,
  addPoints: Polygon,
  transformAt: number,
  numRemove: number,
) {
  const pointsBefore = points.slice(0, transformAt);
  const pointsAfter = points.slice(transformAt + numRemove);
  return [...pointsBefore, ...addPoints, ...pointsAfter];
}

export function generateTransformer(options: EvoOptions) {
  const randomFunc = options.getRandomInt || getRandomInt;
  const { minAdd, maxAdd, maxCoordinate, minRemove, maxRemove } = options;
  return function (points: Polygon) {
    const addPoints = times(randomFunc(minAdd, maxAdd), function () {
      return [randomFunc(0, maxCoordinate), randomFunc(0, maxCoordinate)];
    });
    const numRemove = randomFunc(minRemove, maxRemove);
    const transformAt = randomFunc(0, points.length);
    return transform(points, addPoints, transformAt, numRemove);
  };
}

export function findBestRegularPolygon(polyRadius: number): Polygon {
  let numPoints: number = 3;
  let previousPoly: Polygon = [];
  let regularPoly: Polygon = [];
  do {
    previousPoly = regularPoly;
    regularPoly = generateRegularPoly(
      polyRadius,
      polyRadius,
      polyRadius,
      numPoints,
    );
    numPoints += 1;
  } while (
    previousPoly.length === 0 ||
    getRoundness(regularPoly) > getRoundness(previousPoly)
  );
  return previousPoly;
}

export function getX(point: [number, number]): number {
  return point[0];
}

export function getY(point: [number, number]): number {
  return point[1];
}

function getPoint2(
  points: Polygon,
  index: number,
): [number, number] {
  return points[index + 1] || points[0];
}

export function isSimple(points: Polygon) {
  const intersections = (findIntersections as Function)(
    { type: "Polygon", coordinates: points },
  );
  return intersections.length === 0;
}

export function getArea(points: Polygon): number {
  return Math.abs(points.reduce(function (total: number, point, index, points) {
    const point2 = getPoint2(points, index);
    return total + (getX(point) * getY(point2) * 0.5) -
      (getX(point2) * getY(point) * 0.5);
  }, 0));
}

export function getPerimeter(points: Polygon): number {
  return points.reduce(function (total: number, point, index, points) {
    const point2 = getPoint2(points, index);
    return total +
      Math.sqrt(
        (getX(point) - getX(point2)) ** 2 + (getY(point) - getY(point2)) ** 2,
      );
  }, 0);
}

export function getRoundness(points: Polygon): number {
  return getRoundnessFromData(getArea(points), getPerimeter(points));
}

function getRoundnessFromData(area: number, perimeter: number) {
  return area / perimeter ** 2;
}

export function getPolyData(points: Polygon): PolyData {
  const area = getArea(points);
  const perimeter = getPerimeter(points);
  return {
    roundness: getRoundnessFromData(area, perimeter),
    area,
    perimeter,
  };
}

export function testRoundness(
  oldPolyData: PolyData,
  newPolyData: PolyData,
  incremental = true,
) {
  return (incremental === (oldPolyData.roundness < newPolyData.roundness));
}

export function getTime(): number {
  return (new Date()).getTime();
}

function sequenceMessage(
  type: string,
  progress: number,
  data: object = {},
): WorkerMessage {
  return {
    type,
    progress,
    time: getTime(),
    ...data,
  };
}

export function makeEvolutionSequence(
  options: EvoOptions,
  setTimerId: Function,
  isPaused: Function,
  callback: Function,
  transformerFunc?: Function,
) {
  const transformer = transformerFunc || generateTransformer(options);
  const { refreshRate, totalCount, incremental, workerCount } = options;
  const workerTotalCount = Math.floor(totalCount / workerCount);
  const evolutionSequence = function (progress: number, polygon: Polygon) {
    if (isPaused()) {
      return;
    }
    const to = Math.min(
      workerTotalCount - refreshRate * (progress + 1),
      refreshRate,
    );
    let polyPoints: Polygon = [...polygon];
    let polyData = getPolyData(polyPoints);
    for (let i = 0; i < to; i += 1) {
      const newPolygon: Polygon = transformer(polyPoints);
      if (!isSimple(newPolygon)) {
        continue;
      }
      const newPolyData = getPolyData(newPolygon);
      if (testRoundness(polyData, newPolyData, incremental)) {
        polyPoints = newPolygon;
        polyData = newPolyData;
        callback(
          sequenceMessage(
            "mutation",
            progress,
            { index: i, newPolygon, newPolyData },
          ),
        );
      }
    }
    if (refreshRate * (progress + 1) >= workerTotalCount) {
      callback(sequenceMessage("end", progress));
      return;
    }
    callback(sequenceMessage("progress", progress));
    const params = [progress + 1, ...[...arguments].slice(1, 5), transformer];
    setTimerId(
      setTimeout(() => evolutionSequence(progress + 1, polyPoints), 0),
    );
  };
  return evolutionSequence;
}
