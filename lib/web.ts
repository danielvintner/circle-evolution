export function createCanvas(
  canvasContainerId: string,
  width: number,
  height: number,
) {
  const container = window.document.getElementById(canvasContainerId);
  if (!container) {
    throw new Error("Canvas container not found: " + canvasContainerId);
  }
  const canvas = window.document.createElement("canvas") as HTMLCanvasElement;
  const context = canvas.getContext("2d") as CanvasRenderingContext2D;
  canvas.setAttribute("width", width.toString());
  canvas.setAttribute("height", height.toString());
  container.append(canvas);
  return context;
}

export function makeClear(
  context: CanvasRenderingContext2D,
  style: string,
  width: number,
  height: number,
) {
  return function () {
    context.fillStyle = style;
    context.fillRect(0, 0, width, height);
  };
}
