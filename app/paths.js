import { app } from 'electron';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

export function setPaths(isDebug) {
  const basePath = isDebug
    ? app.getAppPath()
    : existsSync(join(process.resourcesPath, 'tagger'))
      ? process.resourcesPath
      : join(process.env.PROGRAMDATA || 'C:\\ProgramData', 'dataset-editor');

  const dataPath = join(basePath, 'Data');
  const tagGroupsPath = join(dataPath, 'TagGroups');
  const tagAutocompletionsPath = join(dataPath, 'TagAutocompletions');
  const taggerPath = join(basePath, 'tagger');

  return {
    dataPath,
    tagGroupsPath,
    tagAutocompletionsPath,
    taggerPath,
  };
}
