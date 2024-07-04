import { DataAdapter, Notice, TAbstractFile, TFile } from "obsidian";
import { AttachmentManagementPluginSettings, AttachmentPathSettings } from "./settings/settings";

import { Md5 } from "ts-md5";

const PASTED_IMAGE_PREFIX = "Pasted image ";
const ImageExtensionRegex = /^(jpe?g|png|gif|svg|bmp|eps|webp)$/i;

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
  const match = extension.match(ImageExtensionRegex);
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
export function matchExtension(extension: string, pattern: string): boolean {
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

  return !matchExtension(file.extension, settings.excludeExtensionPattern);
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

export async function MD5(adapter: DataAdapter, file: TFile): Promise<string> {
  const md5 = new Md5();

  if (!adapter.exists(file.path, true)) {
    return "";
  }

  const content = await adapter.readBinary(file.path);
  md5.appendByteArray(new Uint8Array(content));
  const ret = md5.end() as string;

  return ret.toUpperCase();
}

export function validateExtensionEntry(setting: AttachmentPathSettings, plugin: AttachmentManagementPluginSettings) {
  const wrongIndex: {
    type: "empty" | "duplicate" | "md" | "canvas" | "excluded";
    index: number;
  }[] = [];
  if (setting.extensionOverride !== undefined) {
    const extOverride = setting.extensionOverride;
    if (extOverride.some((ext) => ext.extension === "")) {
      wrongIndex.push({ type: "empty", index: extOverride.findIndex((ext) => ext.extension === "") });
    }
    const duplicate = extOverride
      .map((ext) => ext.extension)
      .filter((value, index, self) => self.indexOf(value) !== index);
    if (duplicate.length > 0) {
      duplicate.forEach((dupli) => {
        wrongIndex.push({ type: "duplicate", index: extOverride.findIndex((ext) => dupli === ext.extension) });
      });
    }
    const markdown = extOverride.filter((ext) => ext.extension === "md");
    if (markdown.length > 0) {
      wrongIndex.push({ type: "md", index: extOverride.findIndex((ext) => ext.extension === "md") });
    }
    const canvas = extOverride.filter((ext) => ext.extension === "canvas");
    if (canvas.length > 0) {
      wrongIndex.push({ type: "canvas", index: extOverride.findIndex((ext) => ext.extension === "canvas") });
    }
    const excludedFromSettings = plugin.excludeExtensionPattern.split("|");
    const excluded = extOverride.filter((ext) => excludedFromSettings.includes(ext.extension));
    if (excluded.length > 0) {
      wrongIndex.push({
        type: "excluded",
        index: extOverride.findIndex((ext) => excludedFromSettings.includes(ext.extension)),
      });
    }
  }
  return wrongIndex;
}

export function generateErrorExtensionMessage(type: "md" | "canvas" | "empty" | "duplicate" | "excluded") {
  if (type === "canvas") {
    new Notice("Canvas is not supported as an extension override.");
  } else if (type === "md") {
    new Notice("Markdown is not supported as an extension override.");
  } else if (type === "empty") {
    new Notice("Extension override cannot be empty.");
  } else if (type === "duplicate") {
    new Notice("Duplicate extension override.");
  } else if (type === "excluded") {
    new Notice("Extension override cannot be an excluded extension.");
  }
}
