import { DatasetService } from "@/services/datasetService";
import { useAlert } from "@/composables/useAlert";
import { defineStore } from "pinia";
import { ref, toRaw } from "vue";

interface DatasetChangeRecord {
    type: "add_tag" | "remove_tag" | "replace_tag";
    images: Set<string>;
    tags: Set<string>;
    tagPosition?: number;
    originalTag?: string;
    newTag?: string;
}

export interface Image {
    tags: Set<string>;
    path: string;
    filePath: string;
}

interface TagDiff {
    tagger: Set<string>;
    original: Set<string>;
}

export const useDatasetStore = defineStore("dataset", () => {
    const dataset = ref<Map<string, Image>>(new Map());
    const globalTags = ref<Map<string, Set<string>>>(new Map());
    const tagDiff = ref<Map<string, TagDiff>>(new Map());

    const dataVersion = ref(0);

    const datasetUndoStack = ref<DatasetChangeRecord[]>([]);
    const datasetRedoStack = ref<DatasetChangeRecord[]>([]);
    const sortMode = ref("none");

    const datasetService = new DatasetService();
    const alerts = useAlert();

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

            for (const tag of tagsArray) {
                if (!existingTagSet.has(tag)) {
                    let globalSet = rawGlobalTags.get(tag);
                    if (!globalSet) {
                        globalSet = new Set();
                        rawGlobalTags.set(tag, globalSet);
                    }
                    globalSet.add(imageId);
                }

                if (rawTagDiff.size > 0 && !existingTagSet.has(tag)) {
                    const diff = rawTagDiff.get(imageId);
                    if (!diff)
                        continue;

                    if (diff.tagger.has(tag))
                        diff.tagger.delete(tag);
                    else
                        diff.original.add(tag);
                }
            }

            const currentTagsArray = [...existingTagSet];
            let newTagsList: string[];

            if (position === -1) {
                newTagsList = [...currentTagsArray, ...missingTags];
            } else {
                const filteredCurrent = currentTagsArray.filter((tag) => !tagsArray.includes(tag));
                const actualPosition = Math.min(position - 1, filteredCurrent.length);
                filteredCurrent.splice(actualPosition, 0, ...tagsArray);
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

        const rawDataset = toRaw(dataset.value);
        const rawGlobalTags = toRaw(globalTags.value);
        const rawTagDiff = toRaw(tagDiff.value);

        for (const imageId of imagesSet) {
            const imageData = rawDataset.get(imageId);
            if (!imageData)
                continue;

            let hasAnyTag = false;
            for (const tag of tags) {
                if (imageData.tags.has(tag)) {
                    hasAnyTag = true;
                    break;
                }
            }

            if (!hasAnyTag)
                continue;

            changedImages.add(imageId);

            for (const tag of tags) {
                if (imageData.tags.has(tag)) {
                    imageData.tags.delete(tag);

                    const imagesWithTag = rawGlobalTags.get(tag);
                    if (imagesWithTag) {
                        imagesWithTag.delete(imageId);

                        if (imagesWithTag.size === 0)
                            rawGlobalTags.delete(tag);
                    }

                    if (rawTagDiff.size > 0)
                        rawTagDiff.get(imageId)?.original.delete(tag);
                }
            }
        }

        if (changedImages.size === 0)
            return;

        if (createHistory) {
            recordHistory({
                type: "remove_tag",
                images: changedImages,
                tags: new Set(tags)
            });
        }

        triggerUpdate();
    }

    function replaceTagForImages(imageIds: Iterable<string>, originalTag: string, newTag: string, createHistory: boolean = true) {
        if (!originalTag || !newTag || originalTag === newTag)
            return;

        const imagesSet = new Set(imageIds);
        if (imagesSet.size === 0)
            return;

        const changedImages = new Set<string>();

        const rawDataset = toRaw(dataset.value);
        const rawGlobalTags = toRaw(globalTags.value);
        const rawTagDiff = toRaw(tagDiff.value);

        for (const imageId of imagesSet) {
            const imageData = rawDataset.get(imageId);
            if (!imageData || !imageData.tags.has(originalTag))
                continue;

            changedImages.add(imageId);

            const tagsList = [...imageData.tags];
            const oldIndex = tagsList.indexOf(originalTag);

            tagsList.splice(oldIndex, 1);

            const existingNewIndex = tagsList.indexOf(newTag);
            if (existingNewIndex !== -1) {
                tagsList.splice(existingNewIndex, 1);

                const insertAt = existingNewIndex < oldIndex ? oldIndex - 1 : oldIndex;
                tagsList.splice(insertAt, 0, newTag);
            } else {
                tagsList.splice(oldIndex, 0, newTag);
            }

            imageData.tags = new Set(tagsList);

            const originalGlobal = rawGlobalTags.get(originalTag);
            if (originalGlobal) {
                originalGlobal.delete(imageId);

                if (originalGlobal.size === 0)
                    rawGlobalTags.delete(originalTag);
            }

            let newGlobal = rawGlobalTags.get(newTag);
            if (!newGlobal) {
                newGlobal = new Set();
                rawGlobalTags.set(newTag, newGlobal);
            }
            newGlobal.add(imageId);

            if (rawTagDiff.size > 0) {
                const diff = rawTagDiff.get(imageId);
                if (!diff)
                    continue;

                if (diff.tagger.has(newTag))
                    diff.tagger.delete(newTag);
                else
                    diff.original.add(newTag);
            }
        }

        if (changedImages.size === 0)
            return;

        if (createHistory) {
            recordHistory({
                type: "replace_tag",
                images: changedImages,
                tags: new Set([newTag]),
                originalTag,
                newTag
            });
        }

        triggerUpdate();
    }

    function undoDatasetAction() {
        const change = datasetUndoStack.value.pop();
        if (!change) return;

        switch (change.type) {
            case "add_tag":
                removeTagsFromImages(change.images, change.tags, /* createHistory = */ false);
                break;
            case "remove_tag":
                addTagsToImages(change.images, change.tags, -1, /* createHistory = */ false);
                break;
            case "replace_tag":
                if (change.newTag && change.originalTag)
                    replaceTagForImages(change.images, change.newTag, change.originalTag, /* createHistory = */ false)
                break;
        }

        datasetRedoStack.value.push(change);
        triggerUpdate();
    }

    function redoDatasetAction() {
        const change = datasetRedoStack.value.pop();
        if (!change)
            return;

        switch (change.type) {
            case "add_tag":
                addTagsToImages(change.images, change.tags, change.tagPosition, /* createHistory = */ false);
                break;
            case "remove_tag":
                removeTagsFromImages(change.images, change.tags, /* createHistory = */ false);
                break;
            case "replace_tag":
                if (change.newTag && change.originalTag)
                    replaceTagForImages(change.images, change.originalTag, change.newTag, /* createHistory = */ false);
                break;
        }

        datasetUndoStack.value.push(change);
        triggerUpdate();
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

            for (const tag of imageData.tags) {
                const globalSet = rawGlobalTags.get(tag);
                if (globalSet) {
                    globalSet.delete(imageId);

                    if (globalSet.size === 0)
                        rawGlobalTags.delete(tag);
                }
            }

            rawDataset.delete(imageId);
            rawTagDiff.delete(imageId);
        }

        if (changed)
            triggerUpdate();
    }

    function removeImage(imageId: string) {
        removeImages([imageId]);
    }

    function renameImages(mappings: { from: string; to: string; mtime?: number }[]) {
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

            for (const tag of tagsCopy) {
                const globalSet = rawGlobalTags.get(tag);
                if (globalSet) {
                    globalSet.delete(oldKey);
                    globalSet.add(newKey);
                }
            }

            const filePath = `${toFileUrl(newPath)}?v=${typeof mtime === "number" ? mtime : Date.now()}`;
            rawDataset.delete(oldKey);
            rawDataset.set(newKey, { tags: tagsCopy, path: newPath, filePath });
        }

        if (changed)
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

        if (!reload)
            resetDatasetStatus();
        triggerUpdate();
    }

    async function saveDataset() {
        if (dataset.value.size === 0) {
            alerts.showAlert("warning", "The dataset has not been loaded yet");
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
        removeImage,
        removeImages,
        renameImages,
        undoDatasetAction,
        redoDatasetAction,
        resetDatasetStatus,
        loadDataset,
        saveDataset,
        isDatasetSaved
    };
});
