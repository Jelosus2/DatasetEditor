import { app } from 'electron';
import { join } from 'node:path';

export function setPaths(isDebug) {
  const basePath = isDebug ? app.getAppPath() : app.getPath('userData');

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
