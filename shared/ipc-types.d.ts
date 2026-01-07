import type { SettingsDefinition, Settings } from "./settings-schema";
import type { Dataset, GlobalTags } from "./dataset";
import type { AppStatusPayload } from "./app-status";
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
    "settings:get_schema": {
        args: [];
        result: SettingsDefinition[];
    }
    "settings:load": {
        args: [];
        result: Settings;
    }
    "settings:update": {
        args: [partial: Partial<Settings>];
        result: {
            error: boolean;
            message?: string;
            settings?: Settings;
        }
    }
    "settings:compare": {
        args: [settings: Settings];
        result: boolean;
    }
    "settings:action": {
        args: [actionId: string];
        result: {
            error: boolean;
            canceled?: boolean;
            message?: string;
        }
    }
    "utilities:open_url": {
        args: [url: string];
        result: void;
    }
    "utilities:restart_app": {
        args: [];
        result: void;
    }
    "update:check": {
        args: [];
        result: {
            error: boolean;
            isUpdateAvailable?: boolean;
            message?: string;
        };
    }
    "update:download": {
        args: [];
        result: {
            error: boolean;
            message?: string;
        };
    }
    "update:install": {
        args: [];
        result: void;
    }
    "update:availability": {
        args: [];
        result: boolean;
    }
}

export type IpcOnMap = {
    "app:log": {
        args: [{ type: LogType; message: string; }];
    }
    "app:status": {
        args: [AppStatusPayload];
    }
    "app:update_available": {
        args: [];
    }
    "app:update_progress": {
        args: [progress: number];
    }
    "app:update_downloaded": {
        args: [];
    }
    "app:update_error": {
        args: [];
    }
}
