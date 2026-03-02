import type { Rect } from "../../shared/image";

export type ResizeHandle =
    | "topleft"
    | "top"
    | "topright"
    | "left"
    | "right"
    | "bottomleft"
    | "bottom"
    | "bottomright";

export type Point = {
    x: number;
    y: number;
}

export type MoveSession = {
    index: number;
    start: Point;
    origin: Rect;
}

export type ResizeSession = {
    index: number;
    handle: ResizeHandle;
    start: Point;
    startRect: Rect;
    anchor: Point;
}
