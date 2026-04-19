import type { PathPoints, Vec2 } from "@/types";

export const MAP_WIDTH = 1280;
export const MAP_HEIGHT = 720;

export const PATH_POINTS: PathPoints = [
  { x: -40, y: 120 },
  { x: 220, y: 120 },
  { x: 220, y: 320 },
  { x: 520, y: 320 },
  { x: 520, y: 160 },
  { x: 820, y: 160 },
  { x: 820, y: 520 },
  { x: 360, y: 520 },
  { x: 360, y: 640 },
  { x: 1120, y: 640 },
  { x: 1120, y: 380 },
  { x: MAP_WIDTH + 40, y: 380 },
];

export const BASE_POSITION: Vec2 = {
  x: PATH_POINTS[PATH_POINTS.length - 1].x,
  y: PATH_POINTS[PATH_POINTS.length - 1].y,
};
