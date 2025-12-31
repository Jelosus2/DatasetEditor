import type { Dataset, GlobalTags } from "./dataset";
import type { TagGroups } from "./tag-groups";
import type { LogType } from "./log";

export type IpcInvokeMap = {
    "dataset:load": {
        args: [isAllSaved: boolean, reloadDataset: boolean];
        result: {
            error: boolean;
            canceled?: boolean;
            message?: string;
            dataset?: Dataset;
            globalTags?: GlobalTags;
        }
    }
    "dataset:save": {
        args: [dataset: Dataset];
        result: { error: boolean; message?: string; }
    }
    "dataset:compare": {
        args: [dataset: Dataset];
        result: boolean;
    }
    "tag_groups:load": {
        args: [];
        result: { error: boolean; message?: string; tagGroups?: TagGroups; }
    }
    "tag_groups:save": {
        args: [tagGroups: TagGroups];
        result: { error: boolean; message?: string; }
    }
    "tag_groups:import": {
        args: [];
        result: {
            error: boolean;
            canceled?: boolean;
            message?: string;
            tagGroups?: TagGroups;
        }
    }
    "tag_groups:export": {
        args: [tagGroups: TagGroups];
        result: { error: boolean; canceled?: boolean; message?: string; }
    }
    "tag_groups:compare": {
        args: [tagGroups: TagGroups];
        result: boolean;
    }
}

export type IpcOnMap = {
    "app:log": {
        args: [{ type: LogType; message: string; }];
    }
}
