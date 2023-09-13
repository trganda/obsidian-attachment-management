import { debugLog } from "./log";
import { AttachmentManagementPluginSettings } from "./settings/settings";

export function isExcluded(path: string, settings: AttachmentManagementPluginSettings): boolean {

  debugLog("excludePathsArray: ", settings.excludePathsArray);

  for (const excludedPath of settings.excludePathsArray) {
    if (excludedPath.length === 0) {
      continue;
    }
    if (settings.excludeSubpaths && path.startsWith(excludedPath)) {
      debugLog("isExcluded: ", path);
      return true;
    } else {
      if (path === excludedPath) {
        return true;
      }
    }
  }

  return false;
}
