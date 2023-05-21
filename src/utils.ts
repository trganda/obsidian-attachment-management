import { App, TAbstractFile, TFile, TFolder } from "obsidian";
import { LinkMatch, getAllLinkMatchesInFile } from "./lib/linkDetector";
import { AttachmentManagementPluginSettings, AttachmentPathSettings, SETTINGS_TYPES } from "./settings/settings";
import {
  SETTINGS_VARIABLES_DATES,
  SETTINGS_VARIABLES_NOTENAME,
  SETTINGS_VARIABLES_NOTEPATH,
  SETTINGS_VARIABLES_NOTEPARENT,
} from "./lib/constant";
import { path } from "./lib/path";

export enum ATTACHMENT_RENAME_TYPE {
  // need to rename the attachment folder and file name
  ATTACHMENT_RENAME_TYPE_BOTH = "BOTH",
  // need to rename the attachment folder
  ATTACHMENT_RENAME_TYPE_FOLDER = "FOLDER",
  // need to rename the attachment file name
  ATTACHMENT_RENAME_TYPE_FILE = "FILE",
  // no need to rename
  ATTACHMENT_RENAME_TYPE_NULL = "NULL",
}

const PASTED_IMAGE_PREFIX = "Pasted image ";
const imageRegex = /.*(jpe?g|png|gif|svg|bmp|eps|webp)/i;
const bannerRegex = /!\[\[(.*?)\]\]/i;

export const DEBUG = !(process.env.BUILD_ENV === "production");
if (DEBUG) console.log("DEBUG is enabled");

export function debugLog(...args: unknown[]) {
  if (DEBUG) {
    console.log(new Date().toISOString().slice(11, 23), ...args);
  }
}

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

export async function getAttachmentsInVault(
  settings: AttachmentManagementPluginSettings,
  app: App,
  type: "all" | "links"
): Promise<Record<string, Set<string>>> {
  let attachmentsRecord: Record<string, Set<string>> = {};

  // if (type === "links") {
  attachmentsRecord = await getAttachmentsInVaultByLinks(settings, app);
  // } else {
  //   let allFiles = app.vault.getFiles();
  //   let attachments: TFile[] = [];

  //   for (let i = 0; i < allFiles.length; i++) {
  //     if (!["md", "canvas"].includes(allFiles[i].extension)) {
  //       continue;
  //     }
  //     if (type === "all") {
  //       attachments.push(allFiles[i]);
  // 			addToSet(attachmentsSet, allFiles[i].path);
  //     }
  //   }
  // }
  return attachmentsRecord;
}

// refer https://github.com/ozntel/oz-clear-unused-images-obsidian/blob/master/src/util.ts#LL48C21-L48C21
export async function getAttachmentsInVaultByLinks(
  settings: AttachmentManagementPluginSettings,
  app: App
): Promise<Record<string, Set<string>>> {
  const attachmentsRecord: Record<string, Set<string>> = {};
  const resolvedLinks = app.metadataCache.resolvedLinks;
  if (resolvedLinks) {
    for (const [mdFile, links] of Object.entries(resolvedLinks)) {
      const attachmentsSet: Set<string> = new Set();
      for (const [filePath, nr] of Object.entries(links)) {
        if (await isAttachment(settings, filePath)) {
          addToSet(attachmentsSet, filePath);
        }
      }
      addToRecord(attachmentsRecord, mdFile, attachmentsSet);
    }
  }
  // Loop Files and Check Frontmatter/Canvas
  const allFiles = app.vault.getFiles();
  for (let i = 0; i < allFiles.length; i++) {
    const obsFile = allFiles[i];
    const attachmentsSet: Set<string> = new Set();
    // Check Frontmatter for md files and additional links that might be missed in resolved links
    if (isMarkdownFile(obsFile.extension)) {
      // Frontmatter
      const fileCache = app.metadataCache.getFileCache(obsFile);
      if (fileCache === null) {
        continue;
      }
      if (fileCache.frontmatter) {
        const frontmatter = fileCache.frontmatter;
        for (const k of Object.keys(frontmatter)) {
          if (typeof frontmatter[k] === "string") {
            if (frontmatter[k].match(bannerRegex) || pathIsAnImage(frontmatter[k])) {
              const fileName = frontmatter[k].match(bannerRegex)[1];
              const file = app.metadataCache.getFirstLinkpathDest(fileName, obsFile.path);
              if (file && (await isAttachment(settings, file.path))) {
                addToSet(attachmentsSet, file.path);
              }
            }
          }
        }
      }
      // Any Additional Link
      const linkMatches: LinkMatch[] = await getAllLinkMatchesInFile(obsFile, app);
      for (const linkMatch of linkMatches) {
        if (await isAttachment(settings, linkMatch.linkText)) {
          addToSet(attachmentsSet, linkMatch.linkText);
        }
      }
    } else if (isCanvasFile(obsFile.extension)) {
      // check canvas for links
      const fileRead = await app.vault.cachedRead(obsFile);
      const canvasData = JSON.parse(fileRead);
      // debugLog("canvasData", canvasData);
      if (canvasData.nodes && canvasData.nodes.length > 0) {
        for (const node of canvasData.nodes) {
          // node.type: 'text' | 'file'
          if (node.type === "file") {
            if (await isAttachment(settings, node.file)) {
              addToSet(attachmentsSet, node.file);
            }
          } else if (node.type == "text") {
            const linkMatches: LinkMatch[] = await getAllLinkMatchesInFile(obsFile, app, node.text);
            for (const linkMatch of linkMatches) {
              if (await isAttachment(settings, linkMatch.linkText)) {
                addToSet(attachmentsSet, linkMatch.linkText);
              }
            }
          }
        }
      }
    }
    addToRecord(attachmentsRecord, obsFile.path, attachmentsSet);
  }
  return attachmentsRecord;
}

/**
 * Check whether the file is an attachment
 * @param settings plugins configuration
 * @param filePath file path
 * @returns true if the file is an attachment, false otherwise
 */
export async function isAttachment(settings: AttachmentManagementPluginSettings, filePath: string): Promise<boolean> {
  const file = this.app.vault.getAbstractFileByPath(filePath);
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

export function addToRecord(record: Record<string, Set<string>>, key: string, value: Set<string>) {
  if (record[key] === undefined) {
    record[key] = value;
    return;
  }
  const valueSet = record[key];

  for (const val of value) {
    addToSet(valueSet, val);
  }

  record[key] = valueSet;
}

export function addToSet(setObj: Set<string>, value: string) {
  if (!setObj.has(value)) {
    setObj.add(value);
  }
}

export function pathIsAnImage(path: string) {
  return path.match(imageRegex);
}

export function attachRenameType(setting: AttachmentPathSettings): ATTACHMENT_RENAME_TYPE {
  let ret = ATTACHMENT_RENAME_TYPE.ATTACHMENT_RENAME_TYPE_NULL;

  if (
    setting.attachFormat.includes(SETTINGS_VARIABLES_NOTENAME) ||
    setting.attachFormat.includes(SETTINGS_VARIABLES_DATES)
  ) {
    if (
      setting.attachmentPath.includes(SETTINGS_VARIABLES_NOTENAME) ||
      setting.attachmentPath.includes(SETTINGS_VARIABLES_NOTEPATH) ||
      setting.attachmentPath.includes(SETTINGS_VARIABLES_NOTEPARENT)
    ) {
      ret = ATTACHMENT_RENAME_TYPE.ATTACHMENT_RENAME_TYPE_BOTH;
    } else {
      ret = ATTACHMENT_RENAME_TYPE.ATTACHMENT_RENAME_TYPE_FILE;
    }
  } else if (
    setting.attachmentPath.includes(SETTINGS_VARIABLES_NOTENAME) ||
    setting.attachmentPath.includes(SETTINGS_VARIABLES_NOTEPATH) ||
    setting.attachmentPath.includes(SETTINGS_VARIABLES_NOTEPARENT)
  ) {
    ret = ATTACHMENT_RENAME_TYPE.ATTACHMENT_RENAME_TYPE_FOLDER;
  }

  return ret;
}

// export function needToRename(settings: AttachmentPathSettings, attachPath: string, attachName: string, noteName: string, link: string): boolean {
//   const linkPath = path.posix.dirname(link);
//   const linkName = path.posix.basename(link, path.posix.extname(link));

//   if (linkName.length !== attachName.length) {
//     return true;
//   }

//   if (attachPath !== linkPath) {
//     return true;
//   } else {
//     if (settings.attachFormat.includes(SETTINGS_VARIABLES_NOTENAME) && !linkName.includes(noteName)) {
//       return true;
//     }
//     // suppose the ${notename} was in format
//     const noNoteNameAttachFormat = settings.attachFormat.split(SETTINGS_VARIABLES_NOTENAME);
//     if (settings.attachFormat.includes(SETTINGS_VARIABLES_DATES)) {
//       for (const formatPart in noNoteNameAttachFormat) {
//         // suppose the ${date} was in format, split each part and search in linkName
//         const splited = formatPart.split(SETTINGS_VARIABLES_DATES);
//         for (const part in splited) {
//           if (!linkName.includes(part)) {
//             return true;
//           }
//         }
//       }
//     }
//   }

//   return false;
// }

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
