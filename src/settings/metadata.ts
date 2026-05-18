import { DataAdapter, TFile, normalizePath } from "obsidian";
import { AttachmentPathSettings, DEFAULT_SETTINGS } from "./settings";
import {
  SETTINGS_VARIABLES_DATES,
  SETTINGS_VARIABLES_MD5,
  SETTINGS_VARIABLES_NOTENAME,
  SETTINGS_VARIABLES_NOTEPARENT,
  SETTINGS_VARIABLES_NOTEPATH,
  SETTINGS_VARIABLES_ORIGINALNAME,
} from "../lib/constant";
import { getRootPath } from "../commons";
import { path } from "../lib/path";
import { md5sum } from "../utils";
import { getExtensionOverrideSetting } from "../model/extensionOverride";
import { debugLog } from "../lib/log";

/**
 * Metadata of notes file
 */
class Metadata {
  /** path of file */
  path: string;

  /** name of file (with extension) */
  name: string;

  /** basename of file (without extension) */
  basename: string;

  /** extension of file */
  extension: string;

  /** parent path of file */
  parentPath = "";

  /** parent path basename of file */
  parentName = "";

  attachmentFile?: TFile;

  constructor(
    path: string,
    name: string,
    basename: string,
    extension: string,
    parentPath: string,
    parentName: string,
    attachmentFile?: TFile,
  ) {
    this.path = path;
    this.name = name;
    this.basename = basename;
    this.extension = extension;
    this.parentPath = parentPath;
    this.parentName = parentName;
    this.attachmentFile = attachmentFile;
  }

  /**
   * Returns a formatted attachment file name according to the provided settings.
   *
   * @param {AttachmentPathSettings} setting - attachment path settings object
   * @param {string} dateFormat - format string for date and time
   * @param {TFile} originalAttach - the original attachment file
   * @return {string} the formatted attachment file name
   */
  async getAttachFileName(
    setting: AttachmentPathSettings,
    dateFormat: string,
    originalAttach: TFile,
    adapter: DataAdapter,
  ): Promise<string> {
    // Anchor ${date} to the attachment's ctime
    const dateTime = window.moment(originalAttach.stat.ctime).format(dateFormat);

    let md5 = "";
    let attachFormat = DEFAULT_SETTINGS.attachPath.attachFormat;
    if (this.attachmentFile !== undefined) {
      md5 = await md5sum(adapter, this.attachmentFile);
      const { extSetting } = getExtensionOverrideSetting(this.attachmentFile.extension, setting);
      if (extSetting !== undefined) {
        attachFormat = extSetting.attachFormat;
      } else {
        attachFormat = setting.attachFormat;
      }
    }

    if (attachFormat.trim() === SETTINGS_VARIABLES_ORIGINALNAME) {
      return originalAttach.basename;
    }

    return attachFormat
      .replace(`${SETTINGS_VARIABLES_DATES}`, dateTime)
      .replace(`${SETTINGS_VARIABLES_NOTENAME}`, this.basename)
      .replace(`${SETTINGS_VARIABLES_MD5}`, md5);
  }

  /**
   * Returns the attachment path based on the given AttachmentPathSettings object.
   *
   * @param {AttachmentPathSettings} setting - An object containing the attachment path settings.
   * @return {string} The normalized attachment path.
   */
  getAttachmentPath(setting: AttachmentPathSettings): string {
    let root = "";
    let attachPath = "";

    if (this.attachmentFile !== undefined) {
      // using extension override setting first
      const { extSetting } = getExtensionOverrideSetting(this.attachmentFile.extension, setting);
      if (extSetting !== undefined) {
        root = getRootPath(this.parentPath, extSetting);
        attachPath = path.join(
          root,
          extSetting.attachmentPath
            .replace(`${SETTINGS_VARIABLES_NOTEPATH}`, this.parentPath)
            .replace(`${SETTINGS_VARIABLES_NOTENAME}`, this.basename)
            .replace(`${SETTINGS_VARIABLES_NOTEPARENT}`, this.parentName),
        );

        return normalizePath(attachPath);
      }
    }

    root = getRootPath(this.parentPath, setting);
    debugLog("getAttachmentPath - root", root);
    attachPath = path.join(
      root,
      setting.attachmentPath
        .replace(`${SETTINGS_VARIABLES_NOTEPATH}`, this.parentPath)
        .replace(`${SETTINGS_VARIABLES_NOTENAME}`, this.basename)
        .replace(`${SETTINGS_VARIABLES_NOTEPARENT}`, this.parentName),
    );

    return normalizePath(attachPath);
  }
}

/**
 * Returns a new instance of Metadata for the given file path.
 *
 * @param {string} file - The full path to the file.
 * @return {Metadata} A new instance of Metadata containing information about the file.
 */
export function getMetadata(file: string, attach?: TFile): Metadata {
  const parentPath = path.dirname(file);
  const parentName = path.basename(parentPath);
  const name = path.basename(file);
  const extension = path.extname(file);
  const basename = path.basename(file, extension);

  return new Metadata(file, name, basename, extension, parentPath, parentName, attach);
}
