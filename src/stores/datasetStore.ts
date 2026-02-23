import type { Dataset, GlobalTags, RenameMapping } from "../../shared/dataset";
import type { DatasetChangeRecord, TagDiffs } from "@/types/dataset-store";

import { DatasetService } from "@/services/datasetService";
import { useAlert } from "@/composables/useAlert";
import { defineStore } from "pinia";
import { ref, toRaw } from "vue";

export const useDatasetStore = defineStore("dataset", () => {
    const dataset = ref<Dataset>(new Map());
    const globalTags = ref<GlobalTags>(new Map());
    const tagDiff = ref<TagDiffs>(new Map());

    const dataVersion = ref(0);

    const datasetUndoStack = ref<DatasetChangeRecord[]>([]);
    const datasetRedoStack = ref<DatasetChangeRecord[]>([]);
    const sortMode = ref<"none" | "alphabetical">("none");

    const datasetService = new DatasetService();
    const alert = useAlert();

    function triggerUpdate() {
        dataVersion.value++;
    }

    function recordHistory(record: DatasetChangeRecord) {
        datasetUndoStack.value.push(record);
        datasetRedoStack.value = [];
    }

    function addTagsToImages(imageIds: Iterable<string>, tags: Set<string>, position: number = -1, createHistory: boolean = true) {
        const tagsArray = Array.from(tags);
        const imagesSet = new Set(imageIds);

        if (imagesSet.size === 0 || tagsArray.length === 0)
            return;

        const changedImages = new Set<string>();

        const rawDataset = toRaw(dataset.value);
        const rawGlobalTags = toRaw(globalTags.value);
        const rawTagDiff = toRaw(tagDiff.value);

        for (const imageId of imagesSet) {
            const imageData = rawDataset.get(imageId);
            if (!imageData)
                continue;

            const existingTagSet = imageData.tags;
            const missingTags = tagsArray.filter((tag) => !existingTagSet.has(tag));
            if (position === -1 && missingTags.length === 0)
                continue;

            changedImages.add(imageId);

            const currentTagsArray = [...existingTagSet];
            let newTagsList: string[];

            if (position === -1) {
                newTagsList = [...currentTagsArray];

                for (const tag of missingTags) {
                    insertTagAtIndex(
                        imageId,
                        tag,
                        newTagsList.length,
                        newTagsList,
                        existingTagSet,
                        rawGlobalTags,
                        rawTagDiff
                    );
                }
            } else {
                const filteredCurrent = currentTagsArray.filter((tag) => !tagsArray.includes(tag));
                const actualPosition = Math.min(position - 1, filteredCurrent.length);

                tagsArray.forEach((tag, offset) => {
                    insertTagAtIndex(
                        imageId,
                        tag,
                        actualPosition + offset,
                        filteredCurrent,
                        existingTagSet,
                        rawGlobalTags,
                        rawTagDiff
                    );
                });

                newTagsList = filteredCurrent;
            }

            imageData.tags = new Set(newTagsList);
        }

        if (changedImages.size === 0)
            return;

        if (createHistory) {
            recordHistory({
                type: "add_tag",
                images: changedImages,
                tags: new Set(tagsArray),
                tagPosition: position
            });
        }

        triggerUpdate();
    }

    function removeTagsFromImages(imageIds: Iterable<string>, tags: Set<string>, createHistory: boolean = true) {
        const imagesSet = new Set(imageIds);
        if (imagesSet.size === 0 || tags.size === 0)
            return;

        const changedImages = new Set<string>();
        const removedPositions = new Map<string, Map<string, number>>();

        const rawDataset = toRaw(dataset.value);
        const rawGlobalTags = toRaw(globalTags.value);
        const rawTagDiff = toRaw(tagDiff.value);

        for (const imageId of imagesSet) {
            const imageData = rawDataset.get(imageId);
            if (!imageData)
                continue;

            const currentTags = [...imageData.tags];
            const positions = new Map<string, number>();

            let hasAnyTag = false;
            for (const tag of tags) {
                if (imageData.tags.has(tag))
                    hasAnyTag = true;

                const index = currentTags.indexOf(tag);
                if (index !== -1)
                    positions.set(tag, index);
            }

            if (!hasAnyTag)
                continue;
            if (positions.size > 0)
                removedPositions.set(imageId, positions);

            changedImages.add(imageId);

            for (const tag of tags) {
                if (imageData.tags.has(tag)) {
                    imageData.tags.delete(tag);

                    removeTagMetadata(imageId, tag, rawGlobalTags, rawTagDiff);
                }
            }
        }

        if (changedImages.size === 0)
            return;

        if (createHistory) {
            recordHistory({
                type: "remove_tag",
                images: changedImages,
                tags: new Set(tags),
                tagPositions: removedPositions
            });
        }

        triggerUpdate();
    }

    function normalizeTags(input: string | Iterable<string>): string[] {
        const list = typeof input === "string" ? [input] : Array.from(input);

        return Array.from(new Set(
            list.map((tag) => tag.trim()).filter(Boolean)
        ));
    }

    function replaceTagForImages(
            imageIds: Iterable<string>,
            originalTagsInput: string | Iterable<string>,
            newTagsInput: string | Iterable<string>,
            createHistory: boolean = true
    ) {
        const originalTags = normalizeTags(originalTagsInput);
        const newTags = normalizeTags(newTagsInput);

        if (originalTags.length === 0 || newTags.length === 0)
            return;

        const originalSet = new Set(originalTags);
        const imagesSet = new Set(imageIds);
        if (imagesSet.size === 0)
            return;

        const changedImages = new Set<string>();
        const replaceBefore = new Map<string, string[]>();

        const rawDataset = toRaw(dataset.value);
        const rawGlobalTags = toRaw(globalTags.value);
        const rawTagDiff = toRaw(tagDiff.value);

        for (const imageId of imagesSet) {
            const imageData = rawDataset.get(imageId);
            if (!imageData)
                continue;

            const previousTags = new Set(imageData.tags);
            const tagsList = [...imageData.tags];

            const sourceIndexes = tagsList
                .map((tag, index) => originalSet.has(tag) ? index : -1)
                .filter((index) => index !== -1);

            if (sourceIndexes.length === 0)
                continue;

            const insertAt = Math.min(...sourceIndexes);
            const withoutSources = tagsList.filter((tag) => !originalSet.has(tag));
            const withoutTargets = withoutSources.filter((tag) => !newTags.includes(tag));
            withoutTargets.splice(Math.min(insertAt, withoutTargets.length), 0, ...newTags);

            const nextTags = new Set(withoutTargets);
            imageData.tags = nextTags;
            changedImages.add(imageId);
            replaceBefore.set(imageId, tagsList);

            for (const tag of previousTags) {
                if (!nextTags.has(tag))
                    removeTagMetadata(imageId, tag, rawGlobalTags, rawTagDiff);
            }

            for (const tag of nextTags) {
                if (!previousTags.has(tag))
                    addTagMetadata(imageId, tag, rawGlobalTags, rawTagDiff);
            }
        }

        if (changedImages.size === 0)
            return;

        if (createHistory) {
            recordHistory({
                type: "replace_tag",
                images: changedImages,
                originalTags: new Set(originalTags),
                newTags: new Set(newTags),
                replaceBefore
            });
        }

        triggerUpdate();
    }

    function restoreReplaceSnapshot(snapshot: Map<string, string[]>) {
        const rawDataset = toRaw(dataset.value);
        const rawGlobalTags = toRaw(globalTags.value);
        const rawTagDiff = toRaw(tagDiff.value);

        for (const [imageId, tagsArr] of snapshot) {
            const imageData = rawDataset.get(imageId);
            if (!imageData)
                continue;

            const previous = new Set(imageData.tags);
            const next = new Set(tagsArr);

            imageData.tags = next;

            for (const tag of previous) {
                if (!next.has(tag))
                    removeTagMetadata(imageId, tag, rawGlobalTags, rawTagDiff);
            }

            for (const tag of next) {
                if (!previous.has(tag))
                    addTagMetadata(imageId, tag, rawGlobalTags, rawTagDiff);
            }
        }

        triggerUpdate();
    }

    function reorderTagInImage(imageId: string, tag: string, toIndex: number, createHistory: boolean = true) {
        const rawDataset = toRaw(dataset.value);
        const imageData = rawDataset.get(imageId);
        if (!imageData)
            return;

        const tagsList = [...imageData.tags];
        const fromIndex = tagsList.indexOf(tag);
        if (fromIndex === -1)
            return;

        const insertIndex = Math.max(0, Math.min(toIndex, tagsList.length));
        if (insertIndex === fromIndex)
            return;

        tagsList.splice(fromIndex, 1);
        tagsList.splice(insertIndex, 0, tag);
        imageData.tags = new Set(tagsList);

        if (createHistory) {
            recordHistory({
                type: "reorder_tag",
                images: new Set([imageId]),
                tag,
                fromIndex,
                toIndex: insertIndex
            });
        }

        triggerUpdate();
    }

    function restoreTagsWithPositions(tagPositions: Map<string, Map<string, number>>) {
        const rawDataset = toRaw(dataset.value);
        const rawGlobalTags = toRaw(globalTags.value);
        const rawTagDiff = toRaw(tagDiff.value);

        for (const [imageId, positions] of tagPositions) {
            const imageData = rawDataset.get(imageId);
            if (!imageData)
                continue;

            const tagsList = [...imageData.tags];
            const ordered = [...positions.entries()].sort((a, b) => a[1] - b[1]);

            for (const [tag, index] of ordered) {
                insertTagAtIndex(
                    imageId,
                    tag,
                    index,
                    tagsList,
                    imageData.tags,
                    rawGlobalTags,
                    rawTagDiff
                )
            }

            imageData.tags = new Set(tagsList);
        }

        triggerUpdate();
    }

    function insertTagAtIndex(
        imageId: string,
        tag: string,
        index: number,
        tagsList: string[],
        existingTagSet: Set<string>,
        rawGlobalTags: GlobalTags,
        rawTagDiff: TagDiffs
    ) {
        const insertAt = Math.min(index, tagsList.length);
        tagsList.splice(insertAt, 0, tag);

        if (existingTagSet.has(tag))
            return;

        existingTagSet.add(tag);
        addTagMetadata(imageId, tag, rawGlobalTags, rawTagDiff);
    }

    function addTagMetadata(imageId: string, tag: string, rawGlobalTags: GlobalTags, rawTagDiff: TagDiffs) {
        let globalSet = rawGlobalTags.get(tag);
        if (!globalSet) {
            globalSet = new Set();
            rawGlobalTags.set(tag, globalSet);
        }
        globalSet.add(imageId);

        if (rawTagDiff.size > 0) {
            const diff = rawTagDiff.get(imageId);
            if (diff) {
                if (diff.tagger.has(tag))
                    diff.tagger.delete(tag);
                else
                    diff.original.add(tag);
            }
        }
    }

    function removeTagMetadata(imageId: string, tag: string, rawGlobalTags: GlobalTags, rawTagDiff: TagDiffs) {
        removeImageFromGlobalTags(imageId, tag, rawGlobalTags);

        if (rawTagDiff.size > 0)
            rawTagDiff.get(imageId)?.original.delete(tag);
    }

    function removeImageFromGlobalTags(imageId: string, tag: string, rawGlobalTags: GlobalTags) {
        const globalSet = rawGlobalTags.get(tag);
        if (globalSet) {
            globalSet.delete(imageId);

            if (globalSet.size === 0)
                rawGlobalTags.delete(tag);
        }
    }

    function moveImageInGlobalTags(oldId: string, newId: string, tags: Iterable<string>, rawGlobalTags: GlobalTags) {
        for (const tag of tags) {
            const globalSet = rawGlobalTags.get(tag);
            if (!globalSet)
                continue;

            globalSet.delete(oldId);
            globalSet.add(newId);
        }
    }

    function undoDatasetAction() {
        const change = datasetUndoStack.value.pop();
        if (!change) return;

        switch (change.type) {
            case "add_tag":
                removeTagsFromImages(change.images, change.tags!, /* createHistory = */ false);
                break;
            case "remove_tag":
                if (change.tagPositions && change.tagPositions.size > 0)
                    restoreTagsWithPositions(change.tagPositions);
                else
                    addTagsToImages(change.images, change.tags!, -1, /* createHistory = */ false);
                break;
            case "replace_tag":
                if (change.replaceBefore && change.replaceBefore.size > 0)
                    restoreReplaceSnapshot(change.replaceBefore);
                break;
            case "reorder_tag":
                const imageId = change.images.values().next().value;
                if (!imageId || !change.tag)
                    break;

                reorderTagInImage(imageId, change.tag, change.fromIndex!, /* createHistory = */ false);
                break;
        }

        datasetRedoStack.value.push(change);
    }

    function redoDatasetAction() {
        const change = datasetRedoStack.value.pop();
        if (!change)
            return;

        switch (change.type) {
            case "add_tag":
                addTagsToImages(change.images, change.tags!, change.tagPosition, /* createHistory = */ false);
                break;
            case "remove_tag":
                removeTagsFromImages(change.images, change.tags!, /* createHistory = */ false);
                break;
            case "replace_tag":
                if (change.originalTags && change.newTags)
                    replaceTagForImages(change.images, change.originalTags, change.newTags, /* createHistory = */ false);
                break;
            case "reorder_tag":
                const imageId = change.images.values().next().value;
                if (!imageId || !change.tag)
                    break;

                reorderTagInImage(imageId, change.tag, change.toIndex!, /* createHistory = */ false);
                break;
        }

        datasetUndoStack.value.push(change);
    }

    function removeImages(imageIds: Iterable<string>) {
        const rawDataset = toRaw(dataset.value);
        const rawGlobalTags = toRaw(globalTags.value);
        const rawTagDiff = toRaw(tagDiff.value);
        let changed = false;

        for (const imageId of imageIds) {
            const imageData = rawDataset.get(imageId);
            if (!imageData)
                continue;

            changed = true;

            for (const tag of imageData.tags)
                removeImageFromGlobalTags(imageId, tag, rawGlobalTags);

            rawDataset.delete(imageId);
            rawTagDiff.delete(imageId);
        }

        if (changed)
            triggerUpdate();
    }

    function removeImage(imageId: string) {
        removeImages([imageId]);
    }

    function renameImages(mappings: RenameMapping[]) {
        if (mappings.length === 0)
            return;

        const rawDataset = toRaw(dataset.value);
        const rawGlobalTags = toRaw(globalTags.value);
        let changed = false;

        for (const { from, to, mtime } of mappings) {
            const oldKey = normalizePath(from);
            const newPath = normalizePath(to);
            const existing = rawDataset.get(oldKey);

            if (!existing)
                continue;
            changed = true;

            const newKey = newPath;
            const tagsCopy = new Set(existing.tags);

            moveImageInGlobalTags(oldKey, newKey, tagsCopy, rawGlobalTags);

            const filePath = `${toFileUrl(newPath)}?v=${typeof mtime === "number" ? mtime : Date.now()}`;
            rawDataset.delete(oldKey);
            rawDataset.set(newKey, { tags: tagsCopy, path: newPath, filePath });
        }

        if (changed)
            triggerUpdate();
    }

    function setTagDiffFromResults(results: Map<string, string[]>) {
        const rawDataset = toRaw(dataset.value);
        const nextDiff: TagDiffs = new Map();

        for (const [name, tags] of results) {
            const imageData = rawDataset.get(name);
            if (!imageData)
                continue;

            const currentTags = imageData.tags;
            const taggerOnly = new Set<string>();
            const originalOnly = new Set<string>();

            for (const tag of tags) {
                if (!currentTags.has(tag))
                    taggerOnly.add(tag);
            }

            for (const tag of currentTags) {
                if (!tags.includes(tag))
                    originalOnly.add(tag);
            }

            if (taggerOnly.size > 0 || originalOnly.size > 0) {
                nextDiff.set(name, {
                    tagger: taggerOnly,
                    original: originalOnly
                });
            }
        }

        tagDiff.value = nextDiff;
        triggerUpdate();
    }

    function normalizePath(path: string) {
        return path.replace(/\\|\\\\/g, "/");
    }

    function toFileUrl(path: string) {
        const norm = normalizePath(path);
        if (/^[A-Za-z]:\//.test(norm))
            return "file:///" + norm;

        return "file://" + norm;
    }

    async function loadDataset(reload: boolean = false) {
        const _isDatasetSaved = await isDatasetSaved();

        const result = await datasetService.loadDataset(_isDatasetSaved, reload);
        if (!result)
            return;

        dataset.value = result.dataset!;
        globalTags.value = result.globalTags!;
        tagDiff.value = new Map();

        if (!reload)
            resetDatasetStatus();

        alert.showAlert("success", "Dataset loaded successfully");

        triggerUpdate();
    }

    async function saveDataset() {
        if (dataset.value.size === 0) {
            alert.showAlert("warning", "The dataset has not been loaded yet");
            return;
        }

        await datasetService.saveDataset(dataset.value);
    }

    async function isDatasetSaved() {
        return await datasetService.compareDatasets(dataset.value);
    }

    function resetDatasetStatus() {
        datasetUndoStack.value = [];
        datasetRedoStack.value = [];
    }

    return {
        dataset,
        globalTags,
        sortMode,
        tagDiff,
        dataVersion,
        addTagsToImages,
        removeTagsFromImages,
        replaceTagForImages,
        reorderTagInImage,
        removeImage,
        removeImages,
        renameImages,
        setTagDiffFromResults,
        undoDatasetAction,
        redoDatasetAction,
        resetDatasetStatus,
        loadDataset,
        saveDataset,
        isDatasetSaved
    }
});
