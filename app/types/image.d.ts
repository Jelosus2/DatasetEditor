export type ImageHash = {
    file: string;
    hash: number[];
}

export type DuplicatesWorkerPayload = {
    type: string;
    file: string;
    method: "dhash" | "phash";
}
