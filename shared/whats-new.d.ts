export type WhatsNewState = {
    lastSeenVersion: string | null;
}

export type WhatsNewEntry = {
    version: string;
    updates: string[];
}

export type WhatsNewPayload = {
    currentVersion: string;
    shouldAutoOpen: boolean;
    entries: WhatsNewEntry[];
    unseenEntries: WhatsNewEntry[];
}
