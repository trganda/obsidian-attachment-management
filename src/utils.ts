import { App, DataAdapter, Notice, TAbstractFile, TFile } from "obsidian";
import { AttachmentManagementPluginSettings, AttachmentPathSettings } from "./settings/settings";
import { t } from "./i18n/index";
import {
  SETTINGS_VARIABLES_DATES,
  SETTINGS_VARIABLES_NOTENAME,
  SETTINGS_VARIABLES_NOTEPARENT,
  SETTINGS_VARIABLES_NOTEPATH,
  SETTINGS_VARIABLES_MD5,
  SETTINGS_VARIABLES_ORIGINALNAME,
} from "./lib/constant";

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
export function isAttachment(
  app: App,
  settings: AttachmentManagementPluginSettings,
  filePath: string | TAbstractFile,
): boolean {
  let file = null;
  if (filePath instanceof TAbstractFile) {
    file = filePath;
  } else {
    file = app.vault.getAbstractFileByPath(filePath);
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

export async function md5sum(adapter: DataAdapter, file: TFile): Promise<string> {
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
    new Notice(t("errors.canvasNotSupported"));
  } else if (type === "md") {
    new Notice(t("errors.markdownNotSupported"));
  } else if (type === "empty") {
    new Notice(t("errors.extensionEmpty"));
  } else if (type === "duplicate") {
    new Notice(t("errors.duplicateExtension"));
  } else if (type === "excluded") {
    new Notice(t("errors.excludedExtension"));
  }
}

const ALLOWED_FORMAT_VARS = [
  SETTINGS_VARIABLES_DATES,
  SETTINGS_VARIABLES_NOTENAME,
  SETTINGS_VARIABLES_MD5,
  SETTINGS_VARIABLES_ORIGINALNAME,
];
const ILLEGAL_FILENAME_CHARS = /[\\/:*?"<>|]/;
const VAR_TOKEN_RE = /\$\{[^}]+\}/g;

export type AttachFormatError =
  | { type: "empty" }
  | { type: "illegalChar"; char: string }
  | { type: "unknownVariable"; name: string };

export function validateAttachFormat(value: string): AttachFormatError | null {
  const trimmed = value.trim();
  if (trimmed.length === 0) return { type: "empty" };

  const stripped = trimmed.replace(VAR_TOKEN_RE, "");
  const bad = stripped.match(ILLEGAL_FILENAME_CHARS);
  if (bad) return { type: "illegalChar", char: bad[0] };

  const vars = trimmed.match(VAR_TOKEN_RE) ?? [];
  for (const v of vars) {
    if (!ALLOWED_FORMAT_VARS.includes(v)) {
      return { type: "unknownVariable", name: v };
    }
  }
  return null;
}

export function attachFormatErrorMessage(err: AttachFormatError): string {
  switch (err.type) {
    case "empty":
      return t("errors.attachFormatEmpty");
    case "illegalChar":
      return t("errors.attachFormatIllegalChar", { char: err.char });
    case "unknownVariable":
      return t("errors.attachFormatUnknownVariable", { name: err.name });
  }
}

const ALLOWED_PATH_VARS = [SETTINGS_VARIABLES_NOTEPATH, SETTINGS_VARIABLES_NOTENAME, SETTINGS_VARIABLES_NOTEPARENT];
// "/" is allowed because attachmentPath is a path, not a filename.
const ILLEGAL_PATH_CHARS = /[\\:*?"<>|]/;

export type AttachmentPathError =
  | { type: "empty" }
  | { type: "illegalChar"; char: string }
  | { type: "unknownVariable"; name: string };

export function validateAttachmentPath(value: string): AttachmentPathError | null {
  const trimmed = value.trim();
  if (trimmed.length === 0) return { type: "empty" };

  const stripped = trimmed.replace(VAR_TOKEN_RE, "");
  const bad = stripped.match(ILLEGAL_PATH_CHARS);
  if (bad) return { type: "illegalChar", char: bad[0] };

  const vars = trimmed.match(VAR_TOKEN_RE) ?? [];
  for (const v of vars) {
    if (!ALLOWED_PATH_VARS.includes(v)) {
      return { type: "unknownVariable", name: v };
    }
  }
  return null;
}

export function attachmentPathErrorMessage(err: AttachmentPathError): string {
  switch (err.type) {
    case "empty":
      return t("errors.attachmentPathEmpty");
    case "illegalChar":
      return t("errors.attachmentPathIllegalChar", { char: err.char });
    case "unknownVariable":
      return t("errors.attachmentPathUnknownVariable", { name: err.name });
  }
}
