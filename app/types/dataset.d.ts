export type RenamePlanEntry = {
    imageFrom: string;
    imageTo: string;
    txtFrom: string | null;
    txtTo: string | null;
    hasConflict: boolean;
    reason?: string;
}
