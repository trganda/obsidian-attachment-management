import { getExtensionOverrideSetting } from "src/model/extensionOverride";
import { AttachmentPathSettings, AttachmentManagementPluginSettings, OriginalNameStorage } from "src/settings/settings";
import { SETTINGS_VARIABLES_ORIGINALNAME } from "./constant";

export function containOriginalNameVariable(setting: AttachmentPathSettings, ext: string): boolean {
  const { extSetting } = getExtensionOverrideSetting(ext, setting);
  if (
    (extSetting !== undefined && extSetting.attachFormat.contains(SETTINGS_VARIABLES_ORIGINALNAME)) ||
    setting.attachFormat.contains(SETTINGS_VARIABLES_ORIGINALNAME)
  ) {
    return true;
  }
  return false;
}

export function saveOriginalName(
  settings: AttachmentManagementPluginSettings,
  setting: AttachmentPathSettings,
  ext: string,
  data: OriginalNameStorage
) {
  if (settings.originalNameStorage === undefined) {
    settings.originalNameStorage = [];
  }

  if (containOriginalNameVariable(setting, ext)) {
    settings.originalNameStorage
      .filter((n) => n.md5 == data.md5)
      .forEach((n) => settings.originalNameStorage.remove(n));
    settings.originalNameStorage.push(data);
  }
}

export function loadOriginalName(
  settings: AttachmentManagementPluginSettings,
  setting: AttachmentPathSettings,
  ext: string,
  md5: string
): OriginalNameStorage | undefined {
  if (containOriginalNameVariable(setting, ext)) {
    const first = settings.originalNameStorage.find((data) => data.md5 === md5);
    const last = settings.originalNameStorage.reverse().find((data) => data.md5 === md5);

    if (first === undefined || last == undefined) {
      return undefined;
    }
    if (first.md5 === last.md5 && first.n === last.n) {
      return last;
    } else if (first.md5 === last.md5 && first.n !== last.n) {
      // remove duplicated item, choice the oldder one
      settings.originalNameStorage.remove(first);
      return last;
    }
  }
  return undefined;
}

export function rmOriginalName(settings: AttachmentManagementPluginSettings, md5: string) {
  const prepares = settings.originalNameStorage.filter((data) => (data.md5 = md5));
  prepares.forEach((p) => {
    settings.originalNameStorage.remove(p);
  });
}
