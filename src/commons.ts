import { App, TFile, TextFileView, normalizePath } from "obsidian";
import {
  SETTINGS_VARIABLES_NOTEPATH,
  SETTINGS_VARIABLES_NOTENAME,
  SETTINGS_VARIABLES_NOTEPARENT,
  SETTINGS_ROOT_INFOLDER,
  SETTINGS_ROOT_NEXTTONOTE,
  SETTINGS_VARIABLES_DATES,
  SETTINGS_VARIABLES_ORIGINALNAME,
} from "./lib/constant";
import { path } from "./lib/path";
import { AttachmentPathSettings } from "./settings/settings";

/**
 * Return the active text file, `md` or `canvas`
 * @returns - the active file or undefined if no active file
 */
export function getActiveFile(app: App): TFile | undefined {
  const view = getActiveView(app);
  return view?.file;
}

/**
 * Return the active view of text file
 * @returns - the active view of text file
 */
export function getActiveView(app: App): TextFileView | null {
  return app.workspace.getActiveViewOfType(TextFileView);
}

/**
 * Generate the attachment path with specified variables
 * @param noteName - basename (without extension) of note
 * @param notePath - path of note
 * @param setting
 * @param parentFolderBasename
 * @returns attachment path
 */
export function getAttachmentPath(
  noteName: string,
  notePath: string,
  parentFolderBasename: string,
  setting: AttachmentPathSettings
): string {
  const root = getRootPath(notePath, setting);

  const attachPath = path.join(
    root,
    setting.attachmentPath
      .replace(`${SETTINGS_VARIABLES_NOTEPATH}`, notePath)
      .replace(`${SETTINGS_VARIABLES_NOTENAME}`, noteName)
      .replace(`${SETTINGS_VARIABLES_NOTEPARENT}`, parentFolderBasename)
  );
  return normalizePath(attachPath);
}

/**
 * Get root path to save attachment file
 * @param notePath - path of note
 * @param setting
 * @returns root path to save attachment file
 */
export function getRootPath(notePath: string, setting: AttachmentPathSettings): string {
  let root: string;

  //@ts-ignore
  const obsmediadir = app.vault.getConfig("attachmentFolderPath");
  // debugLog("obsmediadir", obsmediadir);
  switch (setting.saveAttE) {
    case `${SETTINGS_ROOT_INFOLDER}`:
      root = path.join(setting.attachmentRoot);
      break;
    case `${SETTINGS_ROOT_NEXTTONOTE}`:
      root = path.join(notePath, setting.attachmentRoot.replace("./", ""));
      break;
    default:
      if (obsmediadir === "/") {
        // in vault root folder case
        root = obsmediadir;
      } else if (obsmediadir === "./") {
        // in current folder case
        root = path.join(notePath);
      } else if (obsmediadir.match(/\.\/.+/g) !== null) {
        // in subfolder case
        root = path.join(notePath, obsmediadir.replace("./", ""));
      } else {
        // in specified folder case
        root = obsmediadir;
      }
  }

  return root === "/" ? root : normalizePath(root);
}

/**
 * Generate the image file name with specified variable
 * @param noteName - basename (without extension) of note
 * @param originalName - original name of attachment file
 * @param setting
 * @returns image file name
 */
export function getPastedImageFileName(noteName: string, originalName: string, setting: AttachmentPathSettings, dateFormat: string): string {
  const dateTime = window.moment().format(dateFormat);
  return setting.attachFormat
    .replace(`${SETTINGS_VARIABLES_DATES}`, dateTime)
    .replace(`${SETTINGS_VARIABLES_NOTENAME}`, noteName)
    .replace(`${SETTINGS_VARIABLES_ORIGINALNAME}`, originalName);
}
