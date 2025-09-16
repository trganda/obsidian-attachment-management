import { DataAdapter, TFile, normalizePath } from "obsidian";
import { AttachmentPathSettings, ExtensionOverrideSettings } from "./settings";
import {
  SETTINGS_VARIABLES_DATES,
  SETTINGS_VARIABLES_DAY,
  SETTINGS_VARIABLES_EXTENSION,
  SETTINGS_VARIABLES_MD5,
  SETTINGS_VARIABLES_MONTH,
  SETTINGS_VARIABLES_NOTENAME,
  SETTINGS_VARIABLES_NOTEPARENT,
  SETTINGS_VARIABLES_NOTEPATH,
  SETTINGS_VARIABLES_ORIGINALNAME,
  SETTINGS_VARIABLES_YEAR,
} from "../lib/constant";
import { getRootPath } from "../commons";
import { path } from "../lib/path";
import { md5sum } from "../utils";
import { getExtensionOverrideSetting } from "../model/extensionOverride";
import { debugLog } from "src/lib/log";

/**
 * Replace template placeholders with values from `data`.
 *
 * Supported formats:
 * 1.${var}              full value
 * 2.${var[start:end]}   substring [start, end), supports negative index
 */
function expandTemplate(template: string, data: Record<string, string | number>) {
  return template.replace(/\$\{(\w+)(?:\[(\-?\d*):(\-?\d*)\])?\}/g, (match, key, start, end) => {
    if (data[key] == null) return match;
    let val = String(data[key]);

    if (start != null || end != null) {
      const len = val.length;
      let s = Number(start);
      let e = Number(end);

      if (isNaN(s)) {
        s = 0;
      } else if (s < 0) {
        s = len + s;
      }
      if (isNaN(e)) {
        e = len;
      } else if (e < 0) {
        e = len + e;
      }

      s = s < 0 ? 0 : s > len ? len : s;
      e = e < 0 ? 0 : e > len ? len : e;

      if (s < e) {
        val = val.substring(s, e);
      } else {
        val = val.substring(e, s);
      }
    }
    return val;
  });
}

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
    attachmentFile?: TFile
  ) {
    this.path = path;
    this.name = name;
    this.basename = basename;
    this.extension = extension;
    this.parentPath = parentPath;
    this.parentName = parentName;
    this.attachmentFile = attachmentFile;
  }

  async buildContext(dateFormat: string, adapter: DataAdapter): Promise<Record<string, string | number>> {
    const ctx: Record<string, string | number> = {
      [SETTINGS_VARIABLES_NOTEPATH]: this.parentPath,
      [SETTINGS_VARIABLES_NOTENAME]: this.basename,
      [SETTINGS_VARIABLES_NOTEPARENT]: this.parentName,
      [SETTINGS_VARIABLES_EXTENSION]: this.extension,
    };

    if (this.attachmentFile !== undefined) {
      const mtime = window.moment(this.attachmentFile.stat.mtime);
      ctx[SETTINGS_VARIABLES_DATES] = mtime.format(dateFormat);
      ctx[SETTINGS_VARIABLES_YEAR] = mtime.year();
      ctx[SETTINGS_VARIABLES_MONTH] = mtime.month() + 1;
      ctx[SETTINGS_VARIABLES_DAY] = mtime.date();
      ctx[SETTINGS_VARIABLES_MD5] = await md5sum(adapter, this.attachmentFile);
    } else {
      const now = window.moment();
      ctx[SETTINGS_VARIABLES_DATES] = now.format(dateFormat);
      ctx[SETTINGS_VARIABLES_YEAR] = now.year();
      ctx[SETTINGS_VARIABLES_MONTH] = now.month() + 1;
      ctx[SETTINGS_VARIABLES_DAY] = now.date();
    }
    return ctx;
  }

  /**
   * Returns a formatted attachment file name according to the provided settings.
   *
   * @param {AttachmentPathSettings} setting - attachment path settings object
   * @param {string} dateFormat - format string for date and time
   * @param {string} originalName - name of the original attachment
   * @param {string} [linkName] - optional name for the attachment link
   * @return {string} the formatted attachment file name
   */
  async getAttachFileName(
    setting: AttachmentPathSettings,
    dateFormat: string,
    originalName: string,
    adapter: DataAdapter,
    linkName?: string
  ): Promise<string> {
    const context = await this.buildContext(dateFormat, adapter);

    let attachFormat = setting.attachFormat;
    if (this.attachmentFile !== undefined) {
      const { extSetting } = getExtensionOverrideSetting(this.attachmentFile.extension, setting);
      if (extSetting !== undefined) {
        attachFormat = extSetting.attachFormat;
      }
    }

    if (attachFormat.includes(`\${${SETTINGS_VARIABLES_ORIGINALNAME}`)) {
      // we have no persistence of original name,  return current linking name
      if (originalName === "" && linkName != undefined) {
        return linkName;
      }
    }
    return expandTemplate(attachFormat, context);
  }

  /**
   * Returns the attachment path based on the given AttachmentPathSettings object.
   *
   * @param {AttachmentPathSettings} setting - An object containing the attachment path settings.
   * @return {string} The normalized attachment path.
   */
  async getAttachmentPath(setting: AttachmentPathSettings, dateFormat: string, adapter: DataAdapter): Promise<string> {
    const context = await this.buildContext(dateFormat, adapter);
    let _setting: AttachmentPathSettings | ExtensionOverrideSettings = setting;
    if (this.attachmentFile !== undefined) {
      // using extension override setting first
      const { extSetting } = getExtensionOverrideSetting(this.attachmentFile.extension, setting);
      if (extSetting !== undefined) {
        _setting = extSetting;
      }
    }
    const root = getRootPath(this.parentPath, _setting);
    debugLog("getAttachmentPath - root", root);
    const attachmentPath = expandTemplate(_setting.attachmentPath, context);
    return normalizePath(path.join(root, attachmentPath));
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
