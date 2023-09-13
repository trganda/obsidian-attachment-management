import { TAbstractFile, TFile, TFolder } from "obsidian";
import { AttachmentManagementPluginSettings, AttachmentPathSettings, SETTINGS_TYPES } from "./settings/settings";
import { debugLog } from "./log";
import { stripPaths } from "./utils";

/**
 * Return the best matched override settings for the file/folder
 * @param settings plugin setting
 * @param file file need to get setting
 * @param oldPath old path of the file, it it's be renamed (option)
 * @returns { settingPath: string; setting: AttachmentPathSettings }, the best matched setting,
 * where settingPath is the relate path of this setting, it should be same with input path or is the
 * subpath of the settingPath.
 */
export function getOverrideSetting(
  settings: AttachmentManagementPluginSettings,
  file: TAbstractFile,
  oldPath = ""
): { settingPath: string; setting: AttachmentPathSettings } {
  if (Object.keys(settings.overridePath).length === 0) {
    return { settingPath: "", setting: settings.attachPath };
  }

  const candidates: Record<string, AttachmentPathSettings> = {};
  let fileType: boolean;
  let filePath: string;

  fileType = file instanceof TFile;
  fileType = !(file instanceof TFolder);

  if (oldPath === "") {
    filePath = file.path;
  } else {
    filePath = oldPath;
  }

  for (const overridePath of Object.keys(settings.overridePath)) {
    const overrideSetting = settings.overridePath[overridePath];
    if (fileType) {
      if (overridePath === filePath && overrideSetting.type === SETTINGS_TYPES.FILE) {
        // best match
        return { settingPath: overridePath, setting: overrideSetting };
      } else if (
        filePath.startsWith(overridePath) &&
        filePath.charAt(overridePath.length) === "/" &&
        overrideSetting.type === SETTINGS_TYPES.FOLDER
      ) {
        // parent path
        candidates[overridePath] = overrideSetting;
      }
    } else {
      if (overridePath === filePath && overrideSetting.type === SETTINGS_TYPES.FOLDER) {
        // best match
        return { settingPath: overridePath, setting: overrideSetting };
      } else if (
        filePath.startsWith(overridePath) &&
        filePath.charAt(overridePath.length) === "/" &&
        overrideSetting.type === SETTINGS_TYPES.FOLDER
      ) {
        // parent path
        candidates[overridePath] = overrideSetting;
      }
    }
  }

  if (Object.keys(candidates).length === 0) {
    return { settingPath: "", setting: settings.attachPath };
  }

  // sort by splitted path length, descending
  const sortedK = Object.keys(candidates).sort((a, b) =>
    a.split("/").length > b.split("/").length ? -1 : a.split("/").length < b.split("/").length ? 1 : 0
  );
  debugLog("getOverrideSetting - sortedK:", sortedK);
  for (const k of sortedK) {
    if (filePath.startsWith(k)) {
      return { settingPath: k, setting: candidates[k] };
    }
  }

  return { settingPath: "", setting: settings.attachPath };
}

/**
 * Return the best matched override settings for the file/folder on rename event.
 * We need this function to process the use case below:
 *  suppose you have override settings of a folder, and when your rename the folder,
 *  the override setting of oldPath may be updated and will not to be found
 *  in rename event that trigger by subpath of oldPath.
 * @param settings plugin setting
 * @param file file need to get setting
 * @param oldPath old path of the file, it it's be renamed (option)
 * @returns { settingPath: string; setting: AttachmentPathSettings }, the best matched setting,
 * where settingPath is the relate path of this setting, it should be same with input path or is the
 * subpath of the settingPath.
 */
export function getRenameOverrideSetting(
  settings: AttachmentManagementPluginSettings,
  file: TAbstractFile,
  oldPath: string
): { settingPath: string; setting: AttachmentPathSettings } {
  if (Object.keys(settings.overridePath).length === 0) {
    return { settingPath: "", setting: settings.attachPath };
  }

  const { settingPath: np, setting: ns } = getOverrideSetting(settings, file);
  const { settingPath: op, setting: os } = getOverrideSetting(settings, file, oldPath);

  if (ns.type === SETTINGS_TYPES.GLOBAL) {
    return { settingPath: op, setting: os };
  }

  if (os.type === SETTINGS_TYPES.GLOBAL) {
    return { settingPath: np, setting: ns };
  }

  if (ns.type === SETTINGS_TYPES.FILE && os.type === SETTINGS_TYPES.FILE) {
    // This should not happen
    debugLog("getRenameOverrideSetting - both file type setting", np, op);
    return { settingPath: "", setting: settings.attachPath };
  }

  if (ns.type === SETTINGS_TYPES.FILE && os.type === SETTINGS_TYPES.FOLDER) {
    return { settingPath: np, setting: ns };
  } else if (ns.type === SETTINGS_TYPES.FOLDER && os.type === SETTINGS_TYPES.FILE) {
    return { settingPath: op, setting: os };
  }

  if (ns.type === SETTINGS_TYPES.FOLDER && os.type === SETTINGS_TYPES.FOLDER) {
    const l = np.split("/").length;
    const r = op.split("/").length;

    if (l > r) {
      return { settingPath: np, setting: ns };
    } else if (l < r) {
      return { settingPath: op, setting: os };
    } else if (l === r) {
      return { settingPath: "", setting: settings.attachPath };
    }
  }

  return { settingPath: "", setting: settings.attachPath };
}

/**
 * Update the override setting of the renamed file
 * @param settings plugin setting
 * @param file renamed file
 * @param oldPath old path of the renamed file
 * @returns
 */
export function updateOverrideSetting(
  settings: AttachmentManagementPluginSettings,
  file: TAbstractFile,
  oldPath: string
) {
  const keys = Object.keys(settings.overridePath);
  if (keys.length === 0 || file.path === oldPath) {
    return;
  }

  const { settingPath, setting } = getOverrideSetting(settings, file, oldPath);
  const copySetting = Object.assign({}, setting);

  // if the file was overridden, skip
  if (file.path === settingPath) {
    return;
  }

  if (oldPath === settingPath) {
    settings.overridePath[file.path] = copySetting;
    delete settings.overridePath[settingPath];
    return;
  } else {
    const { stripedSrc, stripedDst } = stripPaths(oldPath, file.path);
    if (stripedSrc === settingPath) {
      settings.overridePath[stripedDst] = copySetting;
      delete settings.overridePath[settingPath];
      return;
    }
  }
}

export function deleteOverrideSetting(settings: AttachmentManagementPluginSettings, file: TAbstractFile): boolean {
  const keys = Object.keys(settings.overridePath);
  for (const key of keys) {
    if (file.path === key) {
      delete settings.overridePath[key];
      return true;
    }
  }
  return false;
}
