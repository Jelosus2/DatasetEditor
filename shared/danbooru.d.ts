export type DanbooruWikiPage = {
    body: string;
}

export type DanbooruPostPreview = {
    id: number;
    mediaType: "image" | "video";
    mediaUrl: string;
    previewUrl: string;
    postUrl: string;
}
