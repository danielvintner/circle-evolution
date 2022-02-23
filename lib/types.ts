export type CanvasOptions = {
  maxCoordinate: number;
  pointPadding: number;
  polyStyle: string;
  pointStrokeStyle: string;
  pointFillStyle: string;
  historyStyle: string;
  backgroundStyle: string;
};

export type EvoOptions = {
  totalCount: number;
  refreshRate: number;
  minAdd: number;
  maxAdd: number;
  maxCoordinate: number;
  minRemove: number;
  maxRemove: number;
  construction: boolean;
  workerCount: number;
  incremental: boolean;
  getRandomInt?: Function;
};

export type WorkerMessage = {
  type: string;
  progress: number;
  time: number;
  newPolygon?: Polygon;
  newPolyData?: PolyData;
  index?: number;
};

export type Polygon = [number, number][];

export type HistoryRecord = {
  polyPoints: Polygon;
  generation: number;
  time: number;
  roundness: number;
  area: number;
  perimeter: number;
};

export type PolyData = {
  roundness: number;
  area: number;
  perimeter: number;
};
