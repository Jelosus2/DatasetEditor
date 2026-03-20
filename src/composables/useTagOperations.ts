import { useDatasetStore } from "@/stores/datasetStore";

export function useTagOperations() {
    const datasetStore = useDatasetStore();

    function validateTagPosition(position: number): number {
        if (!position || Number.isNaN(position) || position < -1)
            return -1;

        return Math.trunc(position);
    }

    function addTag(tagsInput: string, images: Set<string>, tagPosition = -1) {
        const tags = tagsInput.split(",").map((tag) => tag.trim()).filter(Boolean);
        if (tags.length === 0)
            return;

        const position = validateTagPosition(tagPosition);

        datasetStore.addTagsToImages(images, new Set(tags), position);
    }

    function addGlobalTag(tagsInput: string, tagPosition = -1) {
        const tags = tagsInput.split(",").map((tag) => tag.trim()).filter(Boolean);
        if (tags.length === 0)
            return;

        const position = validateTagPosition(tagPosition);

        datasetStore.addTagsToImages(datasetStore.dataset.keys(), new Set(tags), position);
    }

    function removeTag(tag: string, images: Set<string>) {
        if (!tag || images.size === 0)
            return;

        datasetStore.removeTagsFromImages(images, new Set([tag]));
    }

    function removeGlobalTag(tag: string) {
        const imagesWithTag = datasetStore.globalTags.get(tag);
        if (!imagesWithTag || imagesWithTag.size === 0)
            return;

        datasetStore.removeTagsFromImages(imagesWithTag, new Set([tag]));
    }

    function replaceTag(originalTag: string, newTags: string[], images: Set<string>) {
        datasetStore.replaceTagForImages(images, originalTag, newTags);
    }

    function reorderTag(imageId: string, tag: string, toIndex: number) {
        datasetStore.reorderTagInImage(imageId, tag, toIndex);
    }

    return {
        addTag,
        removeTag,
        addGlobalTag,
        removeGlobalTag,
        replaceTag,
        reorderTag,
        validateTagPosition,
    };
}
