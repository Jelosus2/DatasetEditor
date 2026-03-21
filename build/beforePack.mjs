import path from "node:path";
import url from "node:url";
import fs from "fs-extra";

const patchDetailsPrint = async () => {
    if (process.platform !== "win32")
        return;

    const _dirname = path.dirname(url.fileURLToPath(import.meta.url));
    const virtualStorePath = path.join(_dirname, "..", "node_modules", ".pnpm");

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

export default patchDetailsPrint;
