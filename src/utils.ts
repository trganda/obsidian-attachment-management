import { TAbstractFile, TFile } from "obsidian";
import { AttachmentManagementPluginSettings, AttachmentPathSettings, SETTINGS_TYPES } from "./settings/settings";
import {
  SETTINGS_VARIABLES_NOTENAME,
  SETTINGS_VARIABLES_NOTEPATH,
  SETTINGS_VARIABLES_NOTEPARENT,
} from "./lib/constant";

export enum ATTACHMENT_RENAME_TYPE {
  // need to rename the attachment folder and file name
  BOTH = "BOTH",
  // need to rename the attachment folder
  FOLDER = "FOLDER",
  // need to rename the attachment file name
  FILE = "FILE",
  // no need to rename
  NULL = "NULL",
}

const PASTED_IMAGE_PREFIX = "Pasted image ";
const imageRegex = /.*(jpe?g|png|gif|svg|bmp|eps|webp)/i;

export const blobToArrayBuffer = (blob: Blob) => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.readAsArrayBuffer(blob);
  });
};

export function isMarkdownFile(extension: string): boolean {
  return extension === "md";
}

export function isCanvasFile(extension: string): boolean {
  return extension === "canvas";
}

export function isPastedImage(file: TAbstractFile): boolean {
  if (file instanceof TFile) {
    if (file.name.startsWith(PASTED_IMAGE_PREFIX)) {
      return true;
    }
  }
  return false;
}

export function isImage(extension: string): boolean {
  const match = extension.match(imageRegex);
  if (match !== null) {
    return true;
  }
  return false;
}

/**
 * find the first prefix difference of two paths
 * e.g.:
 *   "Resources/Untitled/Untitled 313/Untitled"
 *   "Resources/Untitled1/Untitled 313/Untitled"
 * result:
 *   "Resources/Untitled"
 *   "Resources/Untitled1"
 * @param src source path
 * @param dst destination path
 * @returns the first different prefix, otherwise, return the original path
 */
export function stripPaths(src: string, dst: string): { stripedSrc: string; stripedDst: string } {
  if (src === dst) {
    return { stripedSrc: src, stripedDst: dst };
  }

  const srcParts = src.split("/");
  const dstParts = dst.split("/");

  // if src and dst have difference count of parts,
  // we think the paths was not in a same parent folder and no need to strip the prefix
  if (srcParts.length !== dstParts.length) {
    return { stripedSrc: src, stripedDst: dst };
  }

  for (let i = 0; i < srcParts.length; i++) {
    const srcPart = srcParts[i];
    const dstPart = dstParts[i];

    // find the first different part
    if (srcPart !== dstPart) {
      return {
        stripedSrc: srcParts.slice(0, i + 1).join("/"),
        stripedDst: dstParts.slice(0, i + 1).join("/"),
      };
    }
  }

  return { stripedSrc: "", stripedDst: "" };
}

/**
 * Test if the extension is matched by pattern
 * @param extension extension of a file
 * @param pattern patterns for match extension
 * @returns true if matched, false otherwise
 */
export function testExcludeExtension(extension: string, pattern: string): boolean {
  if (!pattern || pattern === "") return false;
  return new RegExp(pattern).test(extension);
}

/**
 * Check whether the file is an attachment
 * @param settings plugins configuration
 * @param filePath file path
 * @returns true if the file is an attachment, false otherwise
 */
export function isAttachment(settings: AttachmentManagementPluginSettings, filePath: string | TAbstractFile): boolean {
  let file = null;
  if (filePath instanceof TAbstractFile) {
    file = filePath;
  } else {
    file = this.app.vault.getAbstractFileByPath(filePath);
  }

  if (file === null || !(file instanceof TFile)) {
    return false;
  }

  if (isMarkdownFile(file.extension) || isCanvasFile(file.extension)) {
    return false;
  }

  return (
    isImage(file.extension) ||
    (settings.handleAll && testExcludeExtension(file.extension, settings.excludeExtensionPattern))
  );
}

export function pathIsAnImage(path: string) {
  return path.match(imageRegex);
}

/**
 * Returns the attachment rename type based on the given attachment path settings.
 *
 * @param {AttachmentPathSettings} setting - The attachment path settings to examine.
 * @return {ATTACHMENT_RENAME_TYPE} - The attachment rename type based on the given attachment path settings.
 */
export function attachRenameType(setting: AttachmentPathSettings): ATTACHMENT_RENAME_TYPE {
  let ret = ATTACHMENT_RENAME_TYPE.NULL;

  if (setting.attachFormat.includes(SETTINGS_VARIABLES_NOTENAME)) {
    if (
      setting.attachmentPath.includes(SETTINGS_VARIABLES_NOTENAME) ||
      setting.attachmentPath.includes(SETTINGS_VARIABLES_NOTEPATH) ||
      setting.attachmentPath.includes(SETTINGS_VARIABLES_NOTEPARENT)
    ) {
      ret = ATTACHMENT_RENAME_TYPE.BOTH;
    } else {
      ret = ATTACHMENT_RENAME_TYPE.FILE;
    }
  } else if (
    setting.attachmentPath.includes(SETTINGS_VARIABLES_NOTENAME) ||
    setting.attachmentPath.includes(SETTINGS_VARIABLES_NOTEPATH) ||
    setting.attachmentPath.includes(SETTINGS_VARIABLES_NOTEPARENT)
  ) {
    ret = ATTACHMENT_RENAME_TYPE.FOLDER;
  }

  return ret;
}

export function getParentFolder(rf: TFile) {
  const parent = rf.parent;
  let parentPath = "/";
  let parentName = "/";
  if (parent) {
    parentPath = parent.path;
    parentName = parent.name;
  }
  return { parentPath, parentName };
}
