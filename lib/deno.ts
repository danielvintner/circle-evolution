import { createStateManager } from "./manager.ts";
import { Polygon } from "./types.ts";

const defaultPoly: Polygon = [[100, 100], [400, 100], [400, 400], [100, 400]];

const manager = createStateManager(
  { workerCount: 4 },
  defaultPoly,
  function (message, history = []) {
    if (message === "end") {
      console.log("**************** RESULT ****************")
      console.log(history.map(gen => `${gen.roundness} ${gen.generation}\n`).join(''))
    }
  },
  function (state, changer) {
    console.warn(state);
  },
);

manager.start();
