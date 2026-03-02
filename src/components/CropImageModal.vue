<script setup lang="ts">
import type { ResizeHandle, Point, MoveSession, ResizeSession } from "@/types/crop-image";
import type { Rect } from "../../shared/image";

import { useSettingsStore } from "@/stores/settingsStore";
import { useDatasetStore } from "@/stores/datasetStore";
import { ImageService } from "@/services/imageService";
import { useAlert } from "@/composables/useAlert";
import { ref, computed, onMounted, onUnmounted, nextTick, watch } from "vue";

const RESIZE_HANDLES: ResizeHandle[] = [
    "topleft",
    "top",
    "topright",
    "left",
    "right",
    "bottomleft",
    "bottom",
    "bottomright"
];
const DEFAULT_BUCKETS = "512, 768, 1024";
const DEFAULT_RATIOS = "1:1, 4:3, 3:2, 16:9, 9:16, 1:2, 2:1, 1:3, 3:1";
const MAX_HISTORY = 100;

const props = defineProps<{
    selectedImages: Set<string>;
}>();

const imageService = new ImageService();

const imageElement = ref<HTMLImageElement | null>(null);
const modalToggle = ref<HTMLInputElement | null>(null);
const isModalOpen = ref(false);
const currentIndex = ref(0);
const cropRects = ref<Rect[]>([]);
const activeCropIndex = ref(-1);
const liveRect = ref<Rect | null>(null);
const isDrawing = ref(false);
const drawingStart = ref<Point | null>(null);
const moveSession = ref<MoveSession | null>(null);
const resizeSession = ref<ResizeSession | null>(null);
const altPressed = ref(false);
const displaySize = ref({ width: 0, height: 0 });
const naturalSize = ref({ width: 0, height: 0 });
const snapToBuckets = ref(true);
const lockAspectRatios = ref(false);
const snapStrength = ref(1);
const bucketText = ref(DEFAULT_BUCKETS);
const aspectText = ref(DEFAULT_RATIOS);
const undoStack = ref<Rect[][]>([]);
const redoStack = ref<Rect[][]>([]);

const { showAlert } = useAlert();
const datasetStore = useDatasetStore();
const settingsStore = useSettingsStore();

const undoShortcut = computed(() => settingsStore.getSetting("shortcutUndo"));
const redoShortcut = computed(() => settingsStore.getSetting("shortcutRedo"));

const undoShortcutEnabled = computed(() => !settingsStore.shortcutConflicts.has("shortcutUndo"));
const redoShortcutEnabled = computed(() => !settingsStore.shortcutConflicts.has("shortcutRedo"));

const undoShortcutLabel = computed(() =>
    undoShortcutEnabled.value ? undoShortcut.value : `${undoShortcut.value} (conflict)`
);

const redoShortcutLabel = computed(() =>
    redoShortcutEnabled.value ? redoShortcut.value : `${redoShortcut.value} (conflict)`
);

const cropTipText = computed(() =>
    `Tip: Hold Alt to resize handles. ${undoShortcutLabel.value} / ${redoShortcutLabel.value} undo-redo crop edits`
);

const imageKeys = computed(() => {
    void datasetStore.dataVersion;
    return Array.from(datasetStore.dataset.keys());
});

const currentImageKey = computed(() => imageKeys.value[currentIndex.value] ?? null);

const currentImageName = computed(() => {
    const key = currentImageKey.value;
    if (!key)
        return "No image loaded";

    const path = datasetStore.dataset.get(key)?.path ?? key;
    const parts = path.split(/[\\/]/);

    return parts[parts.length - 1] || path;
});

const currentResolution = computed(() => {
    const { width, height } = naturalSize.value;
    if (width === 0 || height === 0)
        return "-";

    return `${width}x${height}`;
});

const cropCount = computed(() => cropRects.value.length);
const canOverwrite = computed(() => cropCount.value === 1);

const parsedBuckets = computed(() => {
    const parsed = parseBuckets(bucketText.value);
    return parsed.length > 0 ? parsed : [1];
});

const parsedAspectRatios = computed(() => {
    const parsed = expandRatios(parseAspectRatios(aspectText.value));
    return parsed.length > 0 ? parsed : [1];
});

const renderedCropRects = computed(() => cropRects.value.map((rect) => toDisplayRect(rect)));
const renderedLiveRect = computed(() => toDisplayRect(liveRect.value));

watch(imageKeys, (keys) => {
    if (keys.length === 0) {
        currentIndex.value = 0;
        resetSelection();
        return;
    }

    if (currentIndex.value > keys.length - 1)
        currentIndex.value = keys.length - 1;
    if (isModalOpen.value)
        nextTick(showImage);
});

let resizeObserver: ResizeObserver | null = null;

function clamp(value: number, min: number, max: number) {
    return Math.min(max, Math.max(min, value));
}

function cloneRects(rects: Rect[]) {
    return rects.map((rect) => ({ ...rect }));
}

function normalizeActiveCropIndex() {
    if (cropRects.value.length === 0) {
        activeCropIndex.value = -1;
        return;
    }

    if (activeCropIndex.value < 0 || activeCropIndex.value >= cropRects.value.length)
        activeCropIndex.value = cropRects.value.length - 1;
}

function pushHistory() {
    undoStack.value.push(cloneRects(cropRects.value));
    if (undoStack.value.length > MAX_HISTORY)
        undoStack.value.shift();

    redoStack.value = [];
}

function applyRectsState(next: Rect[]) {
    cropRects.value = cloneRects(next);
    normalizeActiveCropIndex();
}

function undoCrops() {
    if (undoStack.value.length === 0)
        return;

    redoStack.value.push(cloneRects(cropRects.value));
    const previous = undoStack.value.pop()!;
    applyRectsState(previous);
}

function redoCrops() {
    if (redoStack.value.length === 0)
        return;

    undoStack.value.push(cloneRects(cropRects.value));
    const next = redoStack.value.pop()!;
    applyRectsState(next);
}

function parseBuckets(bucketText: string) {
    return bucketText
        .split(",")
        .map((part) => Number.parseInt(part.trim(), 10))
        .filter((bucket) => Number.isFinite(bucket) && bucket > 0);
}

function parseAspectRatios(aspectText: string) {
    return aspectText
        .split(",")
        .map((part) => part.trim())
        .map((raw) => {
            if (!raw)
                return null;

            if (raw.includes(":")) {
                const [width, height] = raw.split(":").map(Number);
                if (Number.isFinite(width) && Number.isFinite(height) && height > 0)
                    return width / height;

                return null;
            }

            const numeric = Number(raw);
            if (Number.isFinite(numeric) && numeric > 0)
                return numeric;

            return null;
        })
        .filter((ratio): ratio is number => ratio !== null);
}

function expandRatios(ratios: number[]) {
    const output = new Set<number>();
    for (const ratio of ratios) {
        if (!Number.isFinite(ratio) || ratio <= 0)
            continue;

        output.add(ratio);
        output.add(1 / ratio);
    }

    return Array.from(output);
}

function toDisplayRect(rect: Rect | null): Rect | null {
    const { width, height } = naturalSize.value;
    if (!rect || width === 0 || height === 0)
        return null;

    const scaleX = displaySize.value.width / width;
    const scaleY = displaySize.value.height / height;

    return {
        x: rect.x * scaleX,
        y: rect.y * scaleY,
        width: rect.width * scaleX,
        height: rect.height * scaleY
    };
}

function closestAspect(target: number, ratios: number[]) {
    let best = ratios[0] ?? target;
    let bestDiff = Math.abs(target - best);

    for (const ratio of ratios) {
        const diff = Math.abs(target - ratio);
        if (diff < bestDiff) {
            best = ratio;
            bestDiff = diff;
        }
    }

    return best;
}

function findBucketTarget(width: number, height: number) {
    const ratios = parsedAspectRatios.value.length > 0
        ? parsedAspectRatios.value
        : [width / Math.max(height, 1)];

    const buckets = parsedBuckets.value;
    const power = clamp(snapStrength.value, 0, 1);

    if (power <= 0 || buckets.length === 0)
        return null;

    let best: { width: number; height: number } | null = null;
    let bestScore = Number.POSITIVE_INFINITY;

    for (const bucket of buckets) {
        for (const ratio of ratios) {
            const w = Math.round(bucket * Math.sqrt(ratio));
            const h = Math.round(bucket / Math.sqrt(ratio));
            const score = Math.hypot(width - w, height - h);

            if (score < bestScore) {
                bestScore = score;
                best = { width: w, height: h };
            }
        }
    }

    const thresholdBase = Math.max(120, Math.min(width, height) * 0.35);
    const threshold = thresholdBase * power;

    if (best && bestScore <= threshold)
        return best;

    return null;
}

function applySnapSize(width: number, height: number) {
    let nextWidth = width;
    let nextHeight = height;
    const power = clamp(snapStrength.value, 0, 1);

    if (power <= 0)
        return { width: nextWidth, height: nextHeight };

    if (lockAspectRatios.value && parsedAspectRatios.value.length > 0) {
        const currentRatio = nextWidth / Math.max(nextHeight, 1);
        const target = closestAspect(currentRatio, parsedAspectRatios.value);

        const optionA = { width: nextWidth, height: nextWidth / target };
        const optionB = { width: nextHeight * target, height: nextHeight };

        const diffA = Math.abs(optionA.height - nextHeight);
        const diffB = Math.abs(optionB.width - nextWidth);

        const chosen = diffA <= diffB ? optionA : optionB;
        const delta = diffA <= diffB ? diffA : diffB;

        const thresholdBase = Math.max(8, Math.min(nextWidth, nextHeight) * 0.25);
        const threshold = thresholdBase * power;

        if (delta <= threshold) {
            nextWidth = chosen.width;
            nextHeight = chosen.height;
        }
    }

    if (snapToBuckets.value) {
        const targetBucket = findBucketTarget(nextWidth, nextHeight);
        if (targetBucket) {
            nextWidth = targetBucket.width;
            nextHeight = targetBucket.height;
        }
    }

    return { width: nextWidth, height: nextHeight };
}

function clampRectToImage(rect: Rect): Rect {
    const natural = naturalSize.value;
    let { x, y, width, height } = rect;

    if (x < 0) {
        width += x;
        x = 0;
    }
    if (y < 0) {
        height += y;
        y = 0;
    }

    if (x + width > natural.width)
        width = natural.width - x;
    if (y + height> natural.height)
        height = natural.height - y;

    width = Math.max(0, width);
    height = Math.max(0, height);

    return { x, y, width, height };
}

function clampRectPosition(rect: Rect): Rect {
    const { width, height } = naturalSize.value;
    const maxX = Math.max(0, width - rect.width);
    const maxY = Math.max(0, height - rect.height);

    return {
        ...rect,
        x: clamp(rect.x, 0, maxX),
        y: clamp(rect.y, 0, maxY)
    };
}

function buildDragRect(start: Point, current: Point) {
    const dx = current.x - start.x;
    const dy = current.y - start.y;
    const dirX = dx >= 0 ? 1 : -1;
    const dirY = dy >= 0 ? 1 : -1;

    const snapped = applySnapSize(Math.abs(dx), Math.abs(dy));

    const rect: Rect = {
        x: dirX >= 0 ? start.x : start.x - snapped.width,
        y: dirY >= 0 ? start.y : start.y - snapped.height,
        width: snapped.width,
        height: snapped.height
    };

    return clampRectToImage(rect);
}

function anchorForHandle(handle: ResizeHandle, rect: Rect): Point {
    const right = rect.x + rect.width;
    const bottom = rect.y + rect.height;

    return {
        x: handle.includes("left") ? right : rect.x,
        y: handle.includes("top") ? bottom : rect.y
    };
}

function resizeWithHandle(startRect: Rect, handle: ResizeHandle, dx: number, dy: number) {
    const rect: Rect = { ...startRect };

    if (handle.includes("left")) {
        rect.x += dx;
        rect.width -= dx;
    }
    if (handle.includes("right")) {
        rect.width += dx;
    }
    if (handle.includes("top")) {
        rect.y += dy;
        rect.height -= dy;
    }
    if (handle.includes("bottom")) {
        rect.height += dy;
    }

    if (rect.width < 1) {
        rect.x += rect.width;
        rect.width = 1;
    }
    if (rect.height < 1) {
        rect.y += rect.height;
        rect.height = 1;
    }

    return rect;
}

function applySnapWithAnchor(rect: Rect, handle: ResizeHandle, anchor: Point) {
    const snapped = applySnapSize(rect.width, rect.height);
    let width = snapped.width;
    let height = snapped.height;

    if (width < 1)
        width = 1;
    if (height < 1)
        height = 1;

    const output: Rect = { ...rect, width, height };

    if (handle.includes("left"))
        output.x = anchor.x - width;
    else if (handle.includes("right"))
        output.x = anchor.x;

    if (handle.includes("top"))
        output.y = anchor.y - height;
    else if (handle.includes("bottom"))
        output.y = anchor.y;

    return clampRectToImage(output);
}

function resetSelection(clearHistory: boolean = true) {
    cropRects.value = [];
    activeCropIndex.value = -1;
    liveRect.value = null;
    isDrawing.value = false;
    drawingStart.value = null;
    moveSession.value = null;
    resizeSession.value = null;

    if (clearHistory) {
        undoStack.value = [];
        redoStack.value = [];
    }
}

function syncDisplaySize() {
    const element = imageElement.value;
    if (!element)
        return;

    displaySize.value = {
        width: element.clientWidth,
        height: element.clientHeight
    };
}

function observeImageResize() {
    if (!imageElement.value)
        return;

    if (!resizeObserver) {
        resizeObserver = new ResizeObserver(() => {
            syncDisplaySize();
        });
    }

    resizeObserver.observe(imageElement.value);
}

function unobserveImageResize() {
    if (resizeObserver)
        resizeObserver.disconnect();
}

function showImage() {
    const key = currentImageKey.value;
    const element = imageElement.value;
    const image = datasetStore.dataset.get(key);

    if (!key || !element || !image) {
        resetSelection();
        naturalSize.value = { width: 0, height: 0 };
        return;
    }

    naturalSize.value = { width: 0, height: 0 };
    element.src = image.filePath;
    resetSelection();
}

function previous() {
    if (currentIndex.value > 0) {
        currentIndex.value -= 1;
        nextTick(showImage);
    }
}

function next() {
    if (currentIndex.value < imageKeys.value.length - 1) {
        currentIndex.value += 1;
        nextTick(showImage);
    }
}

function onImageLoad() {
    const element = imageElement.value;
    naturalSize.value = {
        width: element?.naturalWidth ?? 0,
        height: element?.naturalHeight ?? 0
    };

    syncDisplaySize();
    observeImageResize();
}

function toNaturalPoint(event: MouseEvent): Point | null {
    const element = imageElement.value;
    if (!element || !displaySize.value.width || !displaySize.value.height)
        return null;

    const rect = element.getBoundingClientRect();
    const x = clamp(event.clientX - rect.left, 0, rect.width);
    const y = clamp(event.clientY - rect.top, 0, rect.height);

    const scaleX = element.naturalWidth / Math.max(rect.width, 1);
    const scaleY = element.naturalHeight / Math.max(rect.height, 1);

    return {
        x: x * scaleX,
        y: y * scaleY
    };
}

function handleStyle(rect: Rect, handle: ResizeHandle) {
    const cx = rect.width / 2;
    const cy = rect.height / 2;

    switch (handle) {
        case "topleft":
            return { left: "0px", top: "0px" };
        case "top":
            return { left: `${cx}px`, top: "0px" };
        case "topright":
            return { left: `${rect.width}px`, top: "0px" };
        case "left":
            return { left: "0px", top: `${cy}px` };
        case "right":
            return { left: `${rect.width}px`, top: `${cy}px` };
        case "bottomleft":
            return { left: "0px", top: `${rect.height}px` };
        case "bottom":
            return { left: `${cx}px`, top: `${rect.height}px` };
        case "bottomright":
            return { left: `${rect.width}px`, top: `${rect.height}px` };
    }
}

function startDraw(event: MouseEvent) {
    if (!isModalOpen.value || !currentImageKey.value)
        return;

    const point = toNaturalPoint(event);
    if (!point)
        return;

    isDrawing.value = true;
    drawingStart.value = point;
    liveRect.value = {
        x: point.x,
        y: point.y,
        width: 0,
        height: 0
    };
}

function startMove(index: number, event: MouseEvent) {
    if (altPressed.value)
        return;

    const rect = cropRects.value[index];
    if (!rect)
        return;

    const point = toNaturalPoint(event);
    if (!point)
        return;

    pushHistory();
    activeCropIndex.value = index;
    moveSession.value = {
        index,
        start: point,
        origin: { ...rect }
    };
}

function startResize(index: number, handle: ResizeHandle, event: MouseEvent) {
    if (!altPressed.value)
        return;

    const rect = cropRects.value[index];
    if (!rect)
        return;

    const point = toNaturalPoint(event);
    if (!point)
        return;

    pushHistory();
    activeCropIndex.value = index;
    const startRect = { ...rect };

    resizeSession.value = {
        index,
        handle,
        start: point,
        startRect,
        anchor: anchorForHandle(handle, startRect)
    };
}

function onPointerMove(event: MouseEvent) {
    if (!isModalOpen.value)
        return;

    const current = toNaturalPoint(event);
    if (!current)
        return;

    if (resizeSession.value) {
        const { index, start, startRect, handle, anchor } = resizeSession.value;
        const dx = current.x - start.x;
        const dy = current.y - start.y;
        const resized = resizeWithHandle(startRect, handle, dx, dy);
        cropRects.value[index] = applySnapWithAnchor(resized, handle, anchor);
        return;
    }

    if (moveSession.value) {
        const { index, start, origin } = moveSession.value;
        const dx = current.x - start.x;
        const dy = current.y - start.y;

        cropRects.value[index] = clampRectPosition({
            x: origin.x + dx,
            y: origin.y + dy,
            width: origin.width,
            height: origin.height
        });
        return;
    }

    if (isDrawing.value && drawingStart.value)
        liveRect.value = buildDragRect(drawingStart.value, current);
}

function onPointerUp() {
    if (resizeSession.value) {
        resizeSession.value = null;
        return;
    }
    if (moveSession.value) {
        moveSession.value = null;
        return;
    }

    if (!isDrawing.value)
        return;

    isDrawing.value = false;
    if (liveRect.value && liveRect.value.width > 4 && liveRect.value.height > 4) {
        pushHistory();
        cropRects.value.push({ ...liveRect.value });
        activeCropIndex.value = cropRects.value.length - 1;
    }

    liveRect.value = null;
    drawingStart.value = null;
}

async function save(overwrite: boolean) {
    if (cropRects.value.length === 0) {
        showAlert("error", "No crop region selected");
        return;
    }

    if (overwrite && cropRects.value.length > 1) {
        showAlert("warning", "Overwrite original only supports one crop");
        return;
    }

    const key = currentImageKey.value;
    if (!key) {
        showAlert("error", "No image selected");
        return;
    }

    const rects = cropRects.value.map((rect) => ({
        x: Math.round(rect.x),
        y: Math.round(rect.y),
        width: Math.round(rect.width),
        height: Math.round(rect.height)
    }));

    const error = await imageService.cropImage(key, rects, overwrite);

    if (!error && overwrite)
        nextTick(showImage);
}

function removeCrop(index: number) {
    if (!cropRects.value[index])
        return;

    pushHistory();
    cropRects.value.splice(index, 1);

    if (cropRects.value.length === 0)
        activeCropIndex.value = -1;
    else if (activeCropIndex.value >= cropRects.value.length)
        activeCropIndex.value = cropRects.value.length - 1;
}

function isEditableTarget(target: EventTarget | null) {
    const element = target as HTMLElement | null;
    if (!element)
        return false;

    const tag = element.tagName.toLowerCase();
    return tag === "input" || tag === "textarea" || tag === "select" || element.isContentEditable;
}

function handleModalChange(event: Event) {
    const target = event.target as HTMLInputElement;
    isModalOpen.value = target.checked;

    if (target.checked) {
        if (props.selectedImages.size > 0) {
            const selectedFirst = imageKeys.value.find((key) => props.selectedImages.has(key));
            if (selectedFirst)
                currentIndex.value = imageKeys.value.indexOf(selectedFirst);
        }

        nextTick(showImage);
    } else {
        resetSelection();
        unobserveImageResize();
    }
}

function onKeyDown(event: KeyboardEvent) {
    if (event.key === "Alt") {
        altPressed.value = true;
        return;
    }

    if (!isModalOpen.value || isEditableTarget(event.target))
        return;

    const matchesUndo = undoShortcutEnabled.value && settingsStore.matchesShortcut(undoShortcut.value, event);
    const matchesRedo = redoShortcutEnabled.value && settingsStore.matchesShortcut(redoShortcut.value, event);

    if (!matchesUndo && !matchesRedo)
        return;

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    if (matchesUndo)
        undoCrops();
    else
        redoCrops();
}

function onKeyUp(event: KeyboardEvent) {
    if (event.key === "Alt") {
        altPressed.value = false;
        resizeSession.value = null;
    }
}

function onWindowBlur() {
    altPressed.value = false;
    resizeSession.value = null;
}

onMounted(() => {
    modalToggle.value?.addEventListener("change", handleModalChange);

    window.addEventListener("mousemove", onPointerMove);
    window.addEventListener("mouseup", onPointerUp);
    window.addEventListener("keydown", onKeyDown, true);
    window.addEventListener("keyup", onKeyUp, true);
    window.addEventListener("blur", onWindowBlur);
});

onUnmounted(() => {
    modalToggle.value?.removeEventListener("change", handleModalChange);

    window.removeEventListener("mousemove", onPointerMove);
    window.removeEventListener("mouseup", onPointerUp);
    window.removeEventListener("keydown", onKeyDown, true);
    window.removeEventListener("keyup", onKeyUp, true);
    window.removeEventListener("blur", onWindowBlur);

    unobserveImageResize();
});
</script>

<template>
    <input ref="modalToggle" type="checkbox" id="crop_image_modal" class="modal-toggle" />
        <div class="modal z-50" role="dialog" @click.stop>
        <div class="modal-box h-[92vh] w-[95vw] max-w-none overflow-hidden p-0" @click.stop>
            <label for="crop_image_modal" class="absolute top-1 right-2 cursor-pointer">✕</label>
            <div class="flex h-full min-h-0">
                <section class="flex min-w-0 flex-1 flex-col p-4">
                    <div class="mb-3 flex items-start justify-between gap-3">
                        <div class="min-w-0">
                            <div class="text-xs uppercase tracking-wide text-base-content/60">Current image</div>
                            <div class="truncate text-2xl font-semibold">{{ currentImageName }}</div>
                        </div>
                        <div class="flex items-center gap-2">
                            <span class="rounded-lg border border-base-content/20 bg-base-200/40 px-3 py-1 text-sm">
                                Resolution: {{ currentResolution }}
                            </span>
                            <span class="rounded-lg border border-base-content/20 bg-base-200/40 px-3 py-1 text-sm">
                                Crop: {{ altPressed ? "handles" : "overlay" }}
                            </span>
                        </div>
                    </div>
                    <div class="flex min-h-0 flex-1 flex-col rounded-xl border border-base-content/20 bg-base-200/20 p-3">
                        <div class="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-lg border border-dashed border-base-content/20 bg-base-200/30">
                            <div v-if="!currentImageKey" class="text-center opacity-70">
                                No image loaded
                            </div>
                            <div v-else class="relative inline-block">
                                <img
                                    ref="imageElement"
                                    class="max-h-[62vh] max-w-full select-none object-contain"
                                    draggable="false"
                                    @dragstart.prevent
                                    @load="onImageLoad"
                                />
                                <div class="crop-overlay" @mousedown.prevent="startDraw">
                                    <template v-for="(renderedRect, index) in renderedCropRects" :key="`crop-${index}`">
                                        <div
                                            v-if="renderedRect"
                                            class="crop-rect"
                                            :class="{ 'crop-rect-selected': index === activeCropIndex }"
                                            :style="{
                                                left: renderedRect.x + 'px',
                                                top: renderedRect.y + 'px',
                                                width: renderedRect.width + 'px',
                                                height: renderedRect.height + 'px'
                                            }"
                                            @mousedown.stop.prevent="startMove(index, $event)"
                                        >
                                            <div class="crop-label">
                                                {{ Math.round(cropRects[index].width) }} x {{ Math.round(cropRects[index].height) }}
                                            </div>
                                            <button
                                                v-if="index === activeCropIndex"
                                                class="crop-remove-btn"
                                                type="button"
                                                @mousedown.stop.prevent
                                                @click.stop.prevent="removeCrop(index)"
                                            >
                                                ✕
                                            </button>
                                            <button
                                                v-for="handle in RESIZE_HANDLES"
                                                v-show="altPressed && index === activeCropIndex"
                                                :key="`${index}-${handle}`"
                                                type="button"
                                                class="resize-handle"
                                                :style="handleStyle(renderedRect, handle)"
                                                @mousedown.stop.prevent="startResize(index, handle, $event)"
                                            ></button>
                                        </div>
                                    </template>
                                    <div
                                        v-if="renderedLiveRect"
                                        class="crop-rect-active"
                                        :style="{
                                            left: renderedLiveRect.x + 'px',
                                            top: renderedLiveRect.y + 'px',
                                            width: renderedLiveRect.width + 'px',
                                            height: renderedLiveRect.height + 'px'
                                        }"
                                    ></div>
                                </div>
                            </div>
                        </div>
                        <div class="mt-3 flex items-center justify-between gap-2">
                            <div class="flex items-center gap-2">
                                <button class="btn btn-sm btn-outline" :disabled="currentIndex === 0" @click="previous">Previous</button>
                                <button class="btn btn-sm btn-outline" :disabled="currentIndex >= imageKeys.length - 1" @click="next">Next</button>
                                <button class="btn btn-sm" :disabled="cropCount === 0" @click="resetSelection()">Clear crops</button>
                            </div>
                            <div class="flex items-center gap-2">
                                <button class="btn btn-sm" :disabled="cropCount === 0" @click="save(false)">Save As...</button>
                                <button class="btn btn-sm btn-primary" :disabled="!canOverwrite" @click="save(true)">Overwrite original</button>
                            </div>
                        </div>
                    </div>
                </section>
                <aside class="w-[320px] shrink-0 border-l border-base-content/15 bg-base-200/10 p-4">
                    <div class="flex items-center justify-between mt-4">
                        <h3 class="text-2xl font-semibold">Crops</h3>
                        <span class="rounded-full border border-base-content/20 bg-base-200/40 px-3 py-0.5 text-sm font-semibold">
                            {{ cropCount }}
                        </span>
                    </div>
                    <div class="divider my-4"></div>
                    <h4 class="mb-2 text-xl font-semibold">Settings</h4>
                    <label class="label cursor-pointer justify-start gap-3 px-0">
                        <input v-model="snapToBuckets" type="checkbox" class="checkbox checkbox-primary checkbox-sm" />
                        <span class="label-text text-base">Snap to resolution buckets</span>
                    </label>
                    <label class="label cursor-pointer justify-start gap-3 px-0 mb-2">
                        <input v-model="lockAspectRatios" type="checkbox" class="checkbox checkbox-primary checkbox-sm" />
                        <span class="label-text text-base">Lock to aspect ratios</span>
                    </label>
                    <label>
                        <div class="px-0 pb-1 pt-0">
                            <span>Snap strength</span>
                        </div>
                        <div class="flex items-center gap-3 mb-2">
                            <input
                                v-model.number="snapStrength"
                                type="range"
                                min="0"
                                max="1"
                                step="0.05"
                                class="range [--range-fill:0] [--range-thumb:var(--color-base-100)] range-sm"
                            />
                            <span class="w-12 text-right text-sm font-semibold">{{ snapStrength.toFixed(2) }}</span>
                        </div>
                    </label>
                    <label class="form-control mt-3">
                        <div class="label px-0 pb-1 pt-0">
                            <span class="label-text">Buckets</span>
                        </div>
                        <input
                            v-model="bucketText"
                            class="input w-full mb-2 outline-none!"
                            placeholder="512, 768, 1024"
                        />
                    </label>
                    <label class="form-control mt-3">
                        <div class="label px-0 pb-1 pt-0">
                            <span class="label-text">Aspect ratios</span>
                        </div>
                        <input
                            v-model="aspectText"
                            class="input w-full outline-none!"
                            placeholder="1:1, 4:3, 3:2, 16:9"
                        />
                    </label>
                    <div class="mt-4 rounded-lg border border-info/30 bg-info p-2 text-info-content font-semibold">
                        {{ cropTipText }}
                    </div>
                </aside>
            </div>
        </div>
    </div>
</template>

<style scoped>
.crop-overlay {
    position: absolute;
    inset: 0;
    cursor: crosshair;
}

.crop-rect {
    position: absolute;
    border: 2px solid rgb(34 197 94);
    background: rgb(34 197 94 / 18%);
}

.crop-rect-active {
    position: absolute;
    border: 2px solid rgb(59 130 246);
    background: rgb(59 130 246 / 16%);
}

.crop-label {
    position: absolute;
    left: 6px;
    top: 6px;
    border-radius: 8px;
    border: 1px solid rgb(255 255 255 / 18%);
    background: rgb(0 0 0 / 55%);
    padding: 2px 8px;
    font-size: 12px;
    color: rgb(255 255 255 / 92%);
    pointer-events: none;
}

.resize-handle {
    position: absolute;
    width: 12px;
    height: 12px;
    transform: translate(-50%, -50%);
    border-radius: 3px;
    border: 1px solid rgb(15 23 42 / 80%);
    background: rgb(34 197 94);
    cursor: pointer;
}

.crop-rect-selected {
    border-color: rgb(59 130 246);
    background: rgb(59 130 246 / 16%);
}

.crop-remove-btn {
    position: absolute;
    top: 4px;
    right: 4px;
    width: 20px;
    height: 20px;
    border: 1px solid rgb(255 255 255 / 25%);
    background: rgb(0 0 0 / 55%);
    color: rgb(255 255 255);
    border-radius: 4px;
    line-height: 1;
    font-size: 14px;
    cursor: pointer;
}
</style>
