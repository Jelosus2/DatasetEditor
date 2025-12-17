export type IpcEvents = {
    "changes_saved": (isAllSaved: boolean) => void;
    "save_all_done": () => void;
}

export type IpcEventChannel = keyof IpcEvents;
