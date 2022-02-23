import { makeEvolutionSequence } from "./geometry.ts";
import { EvoOptions, Polygon, WorkerMessage } from "./types.ts";

const {
  clearTimer,
  setTimerId,
  runSequence,
  setSequence,
  post,
  getProgress,
  setMutationTimerId,
  setPause,
  getPause,
} = (function () {
  let timerId: number;
  let mutationTimerId: number;
  let sequence: Function;
  let progress = 0;
  let pause = false;
  return {
    clearTimer: () => {
      clearTimeout(mutationTimerId);
      clearTimeout(timerId);
    },
    setPause: (value: boolean) => pause = value,
    setTimerId: (newTimerId: number) => timerId = newTimerId,
    setMutationTimerId: (newTimerId: number) => mutationTimerId = newTimerId,
    runSequence: (progress: number, polygon: Polygon) =>
      sequence(progress, polygon),
    setSequence: (newSequence: Function) => sequence = newSequence,
    getPause: () => pause,
    getProgress: () => progress,
    post: (data: WorkerMessage) => {
      progress = data.progress;
      self.postMessage(data);
    },
  };
}());

function init({ options, polygon }: {
  options: EvoOptions;
  polygon: Polygon;
}) {
  setPause(false);
  setSequence(makeEvolutionSequence(
    options,
    setTimerId,
    getPause,
    post,
  ));
  runSequence(0, polygon);
}

function mutation({ polygon }: {
  polygon: Polygon;
}) {
  runSequence(getProgress() + 1, polygon);
}

self.addEventListener("message", function (event) {
  const { data } = (event as MessageEvent);
  const { type } = data;
  switch (type) {
    case "resume":
      setPause(false);
      mutation(data);
      break;
    case "pause":
      clearTimer();
      setPause(true);
      break;
    case "init":
      init(data);
      break;
    case "mutation":
      clearTimer();
      setMutationTimerId(setTimeout(function () {
        mutation(data);
      }, 0));
      break;
  }
});
