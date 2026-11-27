#!/usr/bin/env node

import { readFile } from "node:fs/promises";

const args = process.argv.slice(2);
const inputPath = args.find((arg) => arg.startsWith("--candidate="))?.slice("--candidate=".length);
const model = args.find((arg) => arg.startsWith("--model="))?.slice("--model=".length) ?? "structured-fallback";

const fallback = () => {
  const size = 32;
  const heights = [];
  for (let z = 0; z < size; z++) for (let x = 0; x < size; x++) {
    const ridge = Math.exp(-((x - z * .74 - 6) ** 2) / 34);
    const valley = Math.exp(-((x + z * .38 - 17) ** 2) / 48);
    heights.push(ridge * 8 - valley * 3 + Math.sin(x * .28 + z * .17) * .22);
  }
  return { size, heights };
};

const candidate = inputPath ? JSON.parse(await readFile(inputPath, "utf8")) : fallback();
const size = Number(candidate.size);
const heights = candidate.heights.map(Number);
if (!Number.isInteger(size) || size < 2 || heights.length !== size * size) {
  throw new Error("candidate must contain integer size >= 2 and size*size heights");
}

const at = (x, z) => heights[z * size + x];
let slope = 0;
let curvature = 0;
let seamError = 0;
let ridgeContinuity = 0;
let drainageDensity = 0;
for (let z = 1; z < size - 1; z++) for (let x = 1; x < size - 1; x++) {
  const center = at(x, z);
  const dx = (at(x + 1, z) - at(x - 1, z)) * .5;
  const dz = (at(x, z + 1) - at(x, z - 1)) * .5;
  slope += Math.hypot(dx, dz);
  curvature += Math.abs(at(x + 1, z) + at(x - 1, z) + at(x, z + 1) + at(x, z - 1) - center * 4);
  drainageDensity += Math.max(0, .7 - Math.hypot(dx, dz));
  ridgeContinuity += Math.abs(dx) < .7 && Math.abs(dz) > .15 ? 1 : 0;
}
for (let i = 0; i < size; i++) seamError += Math.abs(at(0, i) - at(size - 1, i));
const interior = (size - 2) ** 2;
const report = {
  model,
  size,
  elevationRange: [Math.min(...heights), Math.max(...heights)],
  meanSlope: slope / interior,
  meanCurvature: curvature / interior,
  ridgeContinuity: ridgeContinuity / interior,
  drainageDensity: drainageDensity / interior,
  tileSeamError: seamError / size,
  estimatedAssetCost: size * size * 3,
  runtimeInference: false,
};
console.log(JSON.stringify(report, null, 2));
