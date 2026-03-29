import path from "node:path";
import url from "node:url";
import fs from "fs-extra";

/**
 * @param {String} markdown
 */
function extractUpdatesList(markdown) {
    const updatesHeading = markdown.match(/^##\s+Updates\s*$/im);
    if (!updatesHeading || updatesHeading.index === undefined)
        return [];

    const sectionStart = updatesHeading.index + updatesHeading[0].length;
    const rest = markdown.slice(sectionStart);
    const nextHeadingIndex = rest.search(/^##\s+/m);
    const section = nextHeadingIndex === -1 ? rest : rest.slice(0, nextHeadingIndex);

    const items = [];
    let currentItem = "";

    for (const rawLine of section.split(/\r?\n/)) {
        const line = rawLine.trim();
        if (!line)
            continue;

        if (line.startsWith("- ")) {
            if (currentItem)
                items.push(currentItem);

            currentItem = line.slice(2).trim();
            continue;
        }

        if (currentItem)
            currentItem += ` ${line}`;
    }

    if (currentItem)
        items.push(currentItem);

    return items;
}

/**
 * @param {String} dirname
 */
async function buildReleaseNotesBundle(dirname) {
    const releaseNotesDirectory = path.join(dirname, "..", ".github", "release-notes");
    const outputPath = path.join(dirname, "release-notes.json");

    const files = (await fs.readdir(releaseNotesDirectory))
        .filter((file) => file.endsWith(".md"));

    const bundle = {};

    for (const file of files) {
        const filePath = path.join(releaseNotesDirectory, file);

        const version = file.replace(/^v/i, "").replace(/\.md$/i, "");
        const markdown = await fs.readFile(filePath, { encoding: "utf-8" });
        const updates = extractUpdatesList(markdown);

        if (updates.length > 0)
            bundle[version] = updates;

        await fs.writeJSON(outputPath, bundle, { spaces: 2 });
    }
}

/**
 * @param {String} dirname
 */
async function patchDetailsPrint(dirname) {
    if (process.platform !== "win32")
        return;

    const virtualStorePath = path.join(dirname, "..", "node_modules", ".pnpm");
    const directories = await fs.readdir(virtualStorePath);
    const targetDirectory = directories.find((directory) => directory.startsWith("app-builder-lib"));

    if (!targetDirectory)
        throw new Error("app-builder-lib not found in .pnpm store.");

    const fullPath = path.join(virtualStorePath, targetDirectory, "node_modules", "app-builder-lib", "templates", "nsis", "installSection.nsh");
    if (!await fs.pathExists(fullPath))
        throw new Error("installSection.nsh not found in app-builder-lib");

    let fileContent = await fs.readFile(fullPath, { encoding: "utf-8" });
    fileContent = fileContent.replace("SetDetailsPrint none", "SetDetailsPrint both");
    await fs.writeFile(fullPath, fileContent, { encoding: "utf-8" });
};

export default async function beforePack() {
    const dirname = path.dirname(url.fileURLToPath(import.meta.url));

    await buildReleaseNotesBundle(dirname);
    await patchDetailsPrint(dirname);
};
