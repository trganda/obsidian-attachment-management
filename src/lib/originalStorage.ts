import { getExtensionOverrideSetting } from "../model/extensionOverride";
import { AttachmentManagementPluginSettings, AttachmentPathSettings, OriginalNameStorage } from "../settings/settings";
import { SETTINGS_VARIABLES_ORIGINALNAME } from "./constant";

export function containsOriginalNameVariable(setting: AttachmentPathSettings, ext: string): boolean {
  const { extSetting } = getExtensionOverrideSetting(ext, setting);
  if (extSetting !== undefined) {
    return extSetting.attachFormat.includes(SETTINGS_VARIABLES_ORIGINALNAME);
  }
  return setting.attachFormat.includes(SETTINGS_VARIABLES_ORIGINALNAME);
}

export function saveOriginalName(
  settings: AttachmentManagementPluginSettings,
  setting: AttachmentPathSettings,
  ext: string,
  data: OriginalNameStorage,
) {
  if (settings.originalNameStorage === undefined) {
    settings.originalNameStorage = [];
  }
  if (!containsOriginalNameVariable(setting, ext)) {
    return;
  }
  settings.originalNameStorage.filter((n) => n.md5 === data.md5).forEach((n) => settings.originalNameStorage.remove(n));
  settings.originalNameStorage.push(data);
}

export function loadOriginalName(
  settings: AttachmentManagementPluginSettings,
  setting: AttachmentPathSettings,
  ext: string,
  md5: string,
): OriginalNameStorage | undefined {
  if (!containsOriginalNameVariable(setting, ext)) {
    return undefined;
  }
  return settings.originalNameStorage.find((data) => data.md5 === md5);
}

export function rmOriginalName(settings: AttachmentManagementPluginSettings, md5: string) {
  settings.originalNameStorage
    .filter((data) => data.md5 === md5)
    .forEach((p) => settings.originalNameStorage.remove(p));
}
