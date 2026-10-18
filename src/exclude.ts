import { debugLog } from "./lib/log";
import { AttachmentManagementPluginSettings } from "./settings/settings";
import { path } from "./lib/path";

/** Apply folder exclusions to a file, including when subpaths are disabled. */
export function isFileExcluded(filePath: string, settings: AttachmentManagementPluginSettings): boolean {
  return isExcluded(path.dirname(filePath) || "/", settings);
}

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
