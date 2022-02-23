export function times(size: number, fn: Function) {
  return Array.from(Array(size)).map(function (value, index: number) {
    return fn(index);
  });
}

export function getRandomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
