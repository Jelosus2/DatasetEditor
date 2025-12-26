import { DatasetService } from '@/services/datasetService';
import { useAlert } from '@/composables/useAlert';
import { defineStore } from 'pinia';
import { ref, toRaw } from 'vue';

interface DatasetChangeRecord {
    type: 'add_tag' | 'remove_tag' | 'add_global_tag' | 'remove_global_tag' | 'replace_tag';
    images?: Set<string>;
    tags: Set<string>;
    tagPosition?: number;
    previousState?: Map<string, Set<string>>;
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

export const useDatasetStore = defineStore('dataset', () => {
    const images = ref<Map<string, Image>>(new Map());
    const globalTags = ref<Map<string, Set<string>>>(new Map());
    const tagDiff = ref<Map<string, TagDiff>>(new Map());

    const datasetUndoStack = ref<DatasetChangeRecord[]>([]);
    const datasetRedoStack = ref<DatasetChangeRecord[]>([]);
    const directory = ref('');
    const sortMode = ref('none');
    const onChange = ref<(() => void)[]>([]);

    const datasetService = new DatasetService();
    const alerts = useAlert();

    function setImageTags(image: string, newTags: Set<string>) {
        const current = images.value.get(image)!.tags;
        for (const tag of current) {
            if (!newTags.has(tag)) {
                const imagesWithTag = globalTags.value.get(tag);
                imagesWithTag?.delete(image);
                if (imagesWithTag?.size === 0) globalTags.value.delete(tag);
            }
        }

        for (const tag of newTags) {
            if (!globalTags.value.has(tag)) {
                globalTags.value.set(tag, new Set([image]));
            } else {
                globalTags.value.get(tag)!.add(image);
            }
        }

        images.value.get(image)!.tags = new Set(newTags);
    }

    function addTagsToImages(imageIds: Iterable<string>, tags: Set<string>, position: number = -1, createHistory: boolean = true) {
        const tagsArray = Array.from(tags);
        const imagesSet = new Set(imageIds);

        if (imagesSet.size === 0 || tagsArray.length === 0)
            return;

        const previousState = createHistory ? new Map<string, Set<string>>() : undefined;
        const changedImages = new Set<string>();

        const rawImages = toRaw(images.value);
        const rawGlobalTags = toRaw(globalTags.value);
        const rawTagDiff = toRaw(tagDiff.value);

        for (const imageId of imagesSet) {
            const imageData = rawImages.get(imageId);
            if (!imageData)
                continue;

            const currentTagsArray = [...imageData.tags];
            const existingTagSet = imageData.tags;

            const missingTags = tagsArray.filter((tag) => !existingTagSet.has(tag));
            if (position === -1 && missingTags.length === 0)
                continue;

            if (createHistory && previousState)
                previousState.set(imageId, new Set(currentTagsArray));
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

        if (createHistory && previousState) {
            pushDatasetChange({
                type: "add_tag",
                images: changedImages,
                tags: new Set(tagsArray),
                tagPosition: position,
                previousState
            });
        }

        onChange.value.forEach((fn) => fn());
    }

    function removeTagsFromImages(imageIds: Iterable<string>, tags: Set<string>, createHistory: boolean = true) {
        const imagesSet = new Set(imageIds);
        if (imagesSet.size === 0 || tags.size === 0)
            return;

        const previousState = createHistory ? new Map<string, Set<string>>() : undefined;
        const changedImages = new Set<string>();

        const rawImages = toRaw(images.value);
        const rawGlobalTags = toRaw(globalTags.value);
        const rawTagDiff = toRaw(tagDiff.value);

        for (const imageId of imagesSet) {
            const imageData = rawImages.get(imageId);
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

            if (createHistory && previousState)
                previousState.set(imageId, new Set(imageData.tags));
            changedImages.add(imageId);

            for (const tag of tags) {
                if (imageData.tags.has(tag)) {
                    imageData.tags.delete(tag);

                    const imagesWithTags = rawGlobalTags.get(tag);
                    if (imagesWithTags) {
                        imagesWithTags.delete(tag);

                        if (imagesWithTags.size === 0)
                            rawGlobalTags.delete(tag);
                    }

                    if (rawTagDiff.size > 0)
                        rawTagDiff.get(imageId)?.original.delete(tag);
                }
            }
        }

        if (changedImages.size === 0)
            return;

        if (createHistory && previousState) {
            pushDatasetChange({
                type: "remove_tag",
                images: changedImages,
                tags: new Set(tags),
                previousState
            });
        }

        onChange.value.forEach((fn) => fn());
    }

    function replaceTagForImages(imageIds: Iterable<string>, originalTag: string, newTag: string, createHistory: boolean = true) {
        if (!originalTag || !newTag || originalTag === newTag)
            return;

        const imagesSet = new Set(imageIds);
        if (imagesSet.size === 0)
            return;

        const previousState = createHistory ? new Map<string, Set<string>>() : undefined;
        const changedImages = new Set<string>();

        const rawImages = toRaw(images.value);
        const rawGlobalTags = toRaw(globalTags.value);
        const rawTagDiff = toRaw(tagDiff.value);

        for (const imageId of imagesSet) {
            const imageData = rawImages.get(imageId);
            if (!imageData || !imageData.tags.has(originalTag))
                continue;

            if (createHistory && previousState)
                previousState.set(imageId, new Set(imageData.tags));
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

        if (createHistory && previousState) {
            pushDatasetChange({
                type: "replace_tag",
                images: changedImages,
                tags: new Set([newTag]),
                originalTag,
                newTag,
                previousState
            });
        }

        onChange.value.forEach((fn) => fn());
    }

    function pushDatasetChange(change: DatasetChangeRecord) {
        datasetUndoStack.value.push(change);
        datasetRedoStack.value = [];
    }

    function undoDatasetAction() {
        const change = datasetUndoStack.value.pop();
        if (!change) return;

        switch (change.type) {
            case 'add_tag':
                for (const [image, previousTags] of change.previousState!.entries()) {
                    setImageTags(image, previousTags);
                }
                break;
            case 'add_global_tag':
                removeTagsFromImages(images.value.keys(), change.tags);
                break;
            case 'remove_tag':
                for (const [image, previousTags] of change.previousState!.entries()) {
                    setImageTags(image, previousTags);
                }
                break;
            case 'remove_global_tag':
                for (const [image, previousTags] of change.previousState!.entries()) {
                    setImageTags(image, previousTags);
                }
                break;
            case 'replace_tag':
                for (const [image, previousTags] of change.previousState!.entries()) {
                    setImageTags(image, previousTags);
                }
                break;
        }

        datasetRedoStack.value.push(change);
        onChange.value.forEach((fn) => fn());
    }

    function redoDatasetAction() {
        const change = datasetRedoStack.value.pop();
        if (!change)
            return;

        switch (change.type) {
            case "add_tag":
            case "add_global_tag":
                addTagsToImages(change.images!, change.tags, change.tagPosition, /* createHistory = */ false);
                break;
            case "remove_tag":
            case "remove_global_tag":
                removeTagsFromImages(change.images!, change.tags, /* createHistory = */ false);
                break;
            case 'replace_tag':
                replaceTagForImages(change.images!, change.originalTag!, change.newTag!, /* createHistory = */ false);
                break;
        }

        datasetUndoStack.value.push(change);
        onChange.value.forEach((fn) => fn());
    }

    function resetDatasetStatus() {
        datasetUndoStack.value = [];
        datasetRedoStack.value = [];
    }

    function removeImage(image: string) {
        const img = images.value.get(image);
        if (!img) return;

        for (const tag of img.tags) {
            const set = globalTags.value.get(tag);
            set?.delete(image);
            if (set && set.size === 0) globalTags.value.delete(tag);
        }

        images.value.delete(image);
        tagDiff.value.delete(image);
        onChange.value.forEach((fn) => fn());
    }

    function removeImages(imgs: Iterable<string>) {
        for (const image of imgs) removeImage(image);
    }

    function normalizePath(p: string) {
        return p.replace(/\\|\\\\/g, '/');
    }

    function toFileUrl(p: string) {
        const norm = normalizePath(p);
        if (/^[A-Za-z]:\//.test(norm)) return 'file:///' + norm;
        return 'file://' + norm;
    }

    function renameImages(mappings: { from: string; to: string; mtime?: number }[]) {
        if (!mappings?.length) return;
        for (const { from, to, mtime } of mappings) {
            const oldKey = normalizePath(from);
            const newPath = normalizePath(to);
            const existing = images.value.get(oldKey);
            if (!existing) continue;

            const newKey = newPath;
            const tagsCopy = new Set(existing.tags);

            for (const tag of tagsCopy) {
                const s = globalTags.value.get(tag);
                if (s) {
                    s.delete(oldKey);
                    s.add(newKey);
                }
            }

            const filePath = `${toFileUrl(newPath)}?v=${typeof mtime === 'number' ? mtime : Date.now()}`;
            images.value.delete(oldKey);
            images.value.set(newKey, { tags: tagsCopy, path: newPath, filePath });
        }
        onChange.value.forEach((fn) => fn());
    }

    async function loadDataset(reload: boolean = false) {
        const _isDatasetSaved = await isDatasetSaved();

        const result = await datasetService.loadDataset(_isDatasetSaved, reload);
        if (!result)
            return;

        images.value = result.dataset!;
        globalTags.value = result.globalTags!;

        if (!reload)
            resetDatasetStatus();
    }

    async function saveDataset() {
        if (images.value.size === 0) {
            alerts.showAlert("warning", "The dataset has not been loaded yet");
            return;
        }

        await datasetService.saveDataset(images.value);
    }

    async function isDatasetSaved() {
        return await datasetService.compareDatasets(images.value);
    }

    return {
        images,
        globalTags,
        directory,
        sortMode,
        tagDiff,
        onChange,
        addTagsToImages,
        removeTagsFromImages,
        replaceTagForImages,
        removeImage,
        removeImages,
        renameImages,
        pushDatasetChange,
        undoDatasetAction,
        redoDatasetAction,
        resetDatasetStatus,
        loadDataset,
        saveDataset,
        isDatasetSaved
    };
});
