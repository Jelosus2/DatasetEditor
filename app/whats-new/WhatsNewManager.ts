import type { WhatsNewState, WhatsNewEntry, WhatsNewPayload } from "../../shared/whats-new.js";

import { Utilities } from "../utils/Utilities.js";
import { App } from "../App.js";
import { app } from "electron";
import fs from "fs-extra";

export class WhatsNewManager {
    private buildDefaultState(): WhatsNewState {
        return { lastSeenVersion: null };
    }

    async getPayload(): Promise<WhatsNewPayload> {
        const currentVersion = app.getVersion();
        const state = await this.loadState();
        const entries = await this.loadEntries(currentVersion);

        const unseenEntries = state.lastSeenVersion === null
            ? entries
            : entries.filter((entry) => this.compareVersions(entry.version, state.lastSeenVersion!) > 0);

        const shouldAutoOpen = state.lastSeenVersion === null || this.compareVersions(currentVersion, state.lastSeenVersion) > 0;

        return {
            currentVersion,
            shouldAutoOpen,
            entries,
            unseenEntries
        };
    }

    async markCurrentVersionAsSeen() {
        await this.saveState({ lastSeenVersion: app.getVersion() });
    }

    private async loadState(): Promise<WhatsNewState> {
        try {
            if (!await fs.pathExists(App.paths.whatsNewStatePath))
                return this.buildDefaultState();

            return fs.readJSON(App.paths.whatsNewStatePath);
        } catch (error) {
            console.error(error);
            App.logger?.error(`[What's New Manager] Failed to load state: ${Utilities.getErrorMessage(error)}`);
            return this.buildDefaultState();
        }
    }

    private async loadEntries(currentVersion: string): Promise<WhatsNewEntry[]> {
        try {
            if (!await fs.pathExists(App.paths.releaseNotesPath))
                return [];

            const releaseNotes: Record<string, string[]> = await fs.readJSON(App.paths.releaseNotesPath);

            return Object.entries(releaseNotes)
                .map(([version, updates]) => ({ version, updates }))
                .filter((entry) => this.compareVersions(entry.version, currentVersion) <= 0)
                .sort((a, b) => this.compareVersions(b.version, a.version));
        } catch (error) {
            console.error(error);
            App.logger?.error(`[What's New Manager] Failed to load release notes: ${Utilities.getErrorMessage(error)}`);
            return [];
        }
    }

    private async saveState(state: WhatsNewState) {
        await fs.outputJSON(App.paths.whatsNewStatePath, state, { spaces: 2, encoding: "utf-8" });
    }

    private compareVersions(a: string, b: string) {
        const aParts = a.split(".").map((part) => Number(part));
        const bParts = b.split(".").map((part) => Number(part));
        const maxLength = Math.max(aParts.length, bParts.length);

        for (let i = 0; i < maxLength; i++) {
            const aPart = aParts[i] ?? 0;
            const bPart = bParts[i] ?? 0;

            if (aPart > bPart)
                return 1;
            if (aPart < bPart)
                return -1;
        }

        return 0;
    }
}
