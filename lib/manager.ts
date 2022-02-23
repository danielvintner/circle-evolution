import {
  EvoOptions,
  HistoryRecord,
  PolyData,
  Polygon,
  WorkerMessage,
} from "./types.ts";
import { getPolyData, getTime, testRoundness } from "./geometry.ts";
import { times } from "./util.ts";

const defaultOptions: Readonly<EvoOptions> = Object.freeze({
  totalCount: 400000,
  refreshRate: 1000,
  minRemove: 0,
  maxRemove: 1,
  minAdd: 0,
  maxAdd: 2,
  maxCoordinate: 500,
  construction: true,
  workerCount: 1,
  incremental: true,
});

const defaultPoly: Polygon = [[100, 100], [400, 100], [400, 400], [100, 400]];

export function createStateManager(
  addOptions: Partial<EvoOptions> = {},
  polygon: Polygon = defaultPoly,
  callback: (message: string, history?: HistoryRecord[]) => void,
  stateChanged: (
    state: { paused: boolean; started: boolean; stopped: boolean },
    changer: string,
  ) => void,
) {
  const options = Object.assign({}, defaultOptions, addOptions);
  if ((options.totalCount / options.workerCount) % options.refreshRate !== 0) {
    throw new Error(
      "totalCount must be divisible by workerCount and refreshRate",
    );
  }
  const initPolygon = clonePolygon(polygon);
  const {
    statusStart,
    statusStop,
    statusPause,
    statusResume,
    notStarted,
    inProgress,
    finished,
    getStatus,
  } = (function () {
    let status = {
      paused: false,
      started: false,
      stopped: false,
    };
    const baseStateChangeMethods = {
      statusStart: () =>
        status = { started: true, paused: false, stopped: false },
      statusStop: () => status.stopped = true,
      statusPause: () => status.paused = true,
      statusResume: () => status.paused = false,
    };
    const getStateMethods = {
      inProgress: () => status.started && !status.paused && !status.stopped,
      getStatus: () => ({ ...status }),
      finished: () => status.stopped === true,
      notStarted: () => status.started === false,
    };
    const stateChangeMethods = Object.fromEntries(
      Object.entries(baseStateChangeMethods).map(
        ([name, fn]) => [name, () => {
          const state = fn();
          stateChanged(getStateMethods.getStatus(), name);
          return state;
        }],
      ),
    );
    return {
      ...baseStateChangeMethods,
      ...stateChangeMethods,
      ...getStateMethods,
    };
  }());
  const manager = createPolyManager(
    options,
    initPolygon,
    (data, history) => {
      switch (data.type) {
        case "end":
          statusStop();
          break;
      }
      callback(data.type, history);
    },
  );
  return {
    status: () => getStatus(),
    end: () => {
      if (!notStarted()) {
        manager.stop();
        statusStop();
      }
    },
    start: () => {
      if (notStarted()) {
        manager.start();
        statusStart();
      }
    },
    pause: () => {
      if (inProgress()) {
        manager.pause();
        statusPause();
      }
    },
    resume: () => {
      if (!inProgress()) {
        manager.resume();
        statusResume();
      }
    },
    forward: () => {
      if (finished()) {
        manager.forward();
        statusStart();
      }
    },
  };
}

export function makeHistoryRecord(
  points: Polygon,
  polyData: PolyData,
  generation: number,
  time: number = getTime(),
): HistoryRecord {
  return {
    polyPoints: clonePolygon(points),
    generation,
    time,
    ...polyData,
  };
}

function clonePolygon(polygon: Polygon): Polygon {
  return polygon.map((point) => [point[0], point[1]]);
}

function cloneHistoryRecord(record: HistoryRecord): HistoryRecord {
  return { ...record, polyPoints: clonePolygon(record.polyPoints) };
}

function cloneHistory(history: HistoryRecord[]): HistoryRecord[] {
  return history.map(cloneHistoryRecord);
}

function last(list: any[]) {
  return list[list.length - 1];
}

type Api = {
  addToHistory: (record: HistoryRecord) => void;
  getLastHistoryRecord: () => HistoryRecord;
  getWorkers: () => Worker[];
  getHistory: () => HistoryRecord[];
  getGenCount: () => number;
  addGeneration: (count: number) => void;
  countWorkers: () => number;
  createWorkers: (
    createMessageHandler: (index: number) => EventListener,
  ) => void;
  terminateWorker: (workerIndex: number) => void;
  terminateWorkers: () => void;
  messageWorkers: (
    messageType: string,
    data?: object,
    exceptWorkerIndex?: number,
  ) => void;
};

type HandlerCallback = (
  data: WorkerMessage,
  history?: HistoryRecord[],
) => void;

function createBindMessageHandler(
  {
    addToHistory,
    getLastHistoryRecord,
    getHistory,
    getGenCount,
    addGeneration,
    countWorkers,
    terminateWorker,
    messageWorkers,
  }: Api,
  options: EvoOptions,
  callback: HandlerCallback,
) {
  let mutationTimer = -1;
  return function (messagedWorkerIndex: number) {
    return function (event: object) {
      const { data }: { data: WorkerMessage } = event as MessageEvent;
      const { type, progress, time } = data;
      switch (type) {
        case "end":
          addGeneration(options.refreshRate);
          terminateWorker(messagedWorkerIndex);
          if (countWorkers() > 0) {
            return;
          }
          addToHistory(
            { ...getLastHistoryRecord(), generation: getGenCount(), time },
          );
          break;
        case "progress":
          addGeneration(options.refreshRate);
          callback(data);
          return;
        case "mutation":
          const { newPolyData, newPolygon, index = 0 } = data;
          if (
            !testRoundness(
              getLastHistoryRecord(),
              newPolyData as PolyData,
              options.incremental,
            )
          ) {
            return;
          }
          addToHistory(
            makeHistoryRecord(
              newPolygon as Polygon,
              newPolyData as PolyData,
              getGenCount() + (index * options.workerCount),
              time,
            ),
          );
          clearTimeout(mutationTimer);
          mutationTimer = setTimeout(function () {
            messageWorkers(
              "mutation",
              {
                polygon: newPolygon,
                roundness: newPolyData?.roundness,
                worker: messagedWorkerIndex,
              },
              messagedWorkerIndex,
            );
          }, 0);
          break;
      }
      callback(data, getHistory());
    };
  };
}

function createPolyManager(
  options: EvoOptions,
  polygon: Polygon,
  callback: HandlerCallback,
) {
  const history: HistoryRecord[] = [];
  const polyData = getPolyData(polygon);
  const { workerCount } = options;
  const api: Api = (function () {
    let generationCount = 0;
    let workersTerminated: number;
    let workers: Worker[];
    return {
      addToHistory: (record: HistoryRecord) => history.push(record),
      getLastHistoryRecord: (): HistoryRecord =>
        cloneHistoryRecord(last(history)),
      getWorkers: () => workers,
      getHistory: (): HistoryRecord[] => cloneHistory(history),
      getGenCount: (): number => generationCount,
      addGeneration: (count: number): number => generationCount += count,
      countWorkers: (): number => workerCount - workersTerminated,
      terminateWorkers: () =>
        times(workerCount, (i: number) => api.terminateWorker(i)),
      createWorkers: (
        createMessageHandler: (index: number) => EventListener,
      ) => {
        // api.addGeneration(options.refreshRate * options.workerCount);
        workersTerminated = 0;
        workers = times(
          workerCount,
          function (index: number) {
            const worker = new Worker(
              new URL("worker.ts", import.meta.url).href,
              { type: "module" },
            );
            worker.addEventListener("message", createMessageHandler(index));
            return worker;
          },
        );
      },
      terminateWorker: (workerIndex: number) => {
        api.getWorkers()[workerIndex].terminate();
        workersTerminated += 1;
      },
      messageWorkers: (
        messageType: string,
        data: object = {},
        exceptWorkerIndex?: number,
      ) => {
        api.getWorkers().forEach(function (worker, workerIndex) {
          if (workerIndex === exceptWorkerIndex) {
            return;
          }
          worker.postMessage({ type: messageType, ...data });
        });
      },
    };
  }());
  const {
    countWorkers,
    messageWorkers,
    addToHistory,
    getLastHistoryRecord,
    createWorkers,
    terminateWorkers,
  } = api;
  const createMessageHandler = createBindMessageHandler(api, options, callback);
  addToHistory(makeHistoryRecord(polygon, polyData, 0));
  createWorkers(createMessageHandler);
  return {
    start: () => messageWorkers("init", { options, polygon }),
    stop: () => terminateWorkers(),
    pause: () => messageWorkers("pause"),
    forward: () => {
      if (countWorkers() !== 0) {
        return;
      }
      createWorkers(createMessageHandler);
      messageWorkers("init", {
        options,
        polygon: getLastHistoryRecord().polyPoints,
      });
    },
    resume: () =>
      messageWorkers(
        "resume",
        { polygon: getLastHistoryRecord().polyPoints },
      ),
  };
}
