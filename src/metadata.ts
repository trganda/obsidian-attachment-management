import { normalizePath } from "obsidian";
import { AttachmentPathSettings } from "./settings/settings";
import {
  SETTINGS_VARIABLES_DATES,
  SETTINGS_VARIABLES_NOTENAME,
  SETTINGS_VARIABLES_NOTEPARENT,
  SETTINGS_VARIABLES_NOTEPATH,
  SETTINGS_VARIABLES_ORIGINALNAME,
} from "./lib/constant";
import { getRootPath } from "./commons";
import { path } from "./lib/path";

class Metadata {
  /** path of file */
  path: string;

  /** name of file (with extension) */
  name: string;

  /** basename of file (without extension) */
  basename: string;

  /** extension of file */
  extension: string;

  parentPath: string = "/";

  parentName: string = "/";

  constructor(path: string, name: string, basename: string, extension: string, parentPath: string, parentName: string) {
    this.path = path;
    this.name = name;
    this.basename = basename;
    this.extension = extension;
    this.parentPath = parentPath;
    this.parentName = parentName;
  }

  getAttachFileName(setting: AttachmentPathSettings, dateFormat: string, originalName: string, linkName?: string) {
    const dateTime = window.moment().format(dateFormat);
    // we have no persistence of original name,  return current linking name
    if (originalName === "" && linkName != undefined) {
      return linkName;
    }
    return setting.attachFormat
      .replace(`${SETTINGS_VARIABLES_DATES}`, dateTime)
      .replace(`${SETTINGS_VARIABLES_NOTENAME}`, this.basename)
      .replace(`${SETTINGS_VARIABLES_ORIGINALNAME}`, originalName);
  }

  getAttachmentPath(setting: AttachmentPathSettings): string {
    const root = getRootPath(this.parentPath, setting);

    const attachPath = path.join(
      root,
      setting.attachmentPath
        .replace(`${SETTINGS_VARIABLES_NOTEPATH}`, this.parentPath)
        .replace(`${SETTINGS_VARIABLES_NOTENAME}`, this.basename)
        .replace(`${SETTINGS_VARIABLES_NOTEPARENT}`, this.parentName)
    );
    return normalizePath(attachPath);
  }
}

export function getMetadata(file: string): Metadata {
  const parentPath = path.dirname(file);
  const parentName = path.basename(parentPath);
  const name = path.basename(file);
  const extension = path.extname(file);
  const basename = path.basename(file, extension);

  return new Metadata(file, name, basename, extension, parentPath, parentName);
}
