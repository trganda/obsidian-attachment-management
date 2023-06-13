import { App, ListedFiles, TAbstractFile, TFile, TFolder, normalizePath } from "obsidian";
import { AttachmentManagementPluginSettings, AttachmentPathSettings, DEFAULT_SETTINGS } from "./settings/settings";
import { RenameEventType, RENAME_EVENT_TYPE_FILE } from "./lib/constant";
import { deduplicateNewName } from "./lib/deduplicate";
import { path } from "./lib/path";
import { debugLog } from "./log";
import { ATTACHMENT_RENAME_TYPE, getParentFolder, stripPaths, testExcludeExtension, isImage } from "./utils";
import { getAttachmentPath } from "./commons";

export default class RenameProcessor {
  readonly app: App;
  readonly settings: AttachmentManagementPluginSettings;

  constructor(app: App, settings?: AttachmentManagementPluginSettings) {
    this.app = app;
    if (settings === undefined) {
      this.settings = DEFAULT_SETTINGS;
    } else {
      this.settings = settings;
    }
  }

  async onRename(
    file: TAbstractFile,
    oldPath: string,
    eventType: RenameEventType,
    attachRenameType: ATTACHMENT_RENAME_TYPE = ATTACHMENT_RENAME_TYPE.NULL,
    setting: AttachmentPathSettings
  ) {
    const rf = file as TFile;

    // old note path and name
    const oldNotePath = path.dirname(oldPath);
    const oldNoteName = path.basename(oldPath, path.extname(oldPath));
    // parent of oldNotePath
    const oldNoteParent = path.basename(path.dirname(oldPath));

    debugLog("onRename - old note path:", oldNotePath, ", name:", oldNoteName);

    const { parentPath, parentName } = getParentFolder(rf);
    // old attachment path
    const oldAttachPath = getAttachmentPath(oldNoteName, oldNotePath, oldNoteParent, setting);
    const newAttachPath = getAttachmentPath(rf.basename, parentPath, parentName, setting);

    debugLog("onRename - old attachment path:", oldAttachPath);
    debugLog("onRename - new attachment path:", newAttachPath);

    // if the old attachment folder does not exist, skip
    // this will happen when we have already rename the attachment file or folder in previous rename event
    if (!(await this.app.vault.adapter.exists(oldAttachPath))) {
      debugLog("onRename - attachment path does not exist:", oldAttachPath);
      return;
    }

    if (!(await this.app.vault.adapter.exists(newAttachPath))) {
      await this.app.vault.adapter.mkdir(newAttachPath);
    }

    let oldName = "";
    let newName = "";
    if (
      eventType === RENAME_EVENT_TYPE_FILE &&
      (attachRenameType === ATTACHMENT_RENAME_TYPE.FILE || attachRenameType === ATTACHMENT_RENAME_TYPE.BOTH)
    ) {
      oldName = oldNoteName;
      newName = rf.basename;
    }

    // rename attachment folder first
    await this.renameFolder(oldAttachPath, newAttachPath, oldName, newName, attachRenameType);

    // rename attachment filename as needed
    if (
      eventType === RENAME_EVENT_TYPE_FILE &&
      (attachRenameType === ATTACHMENT_RENAME_TYPE.FILE || attachRenameType === ATTACHMENT_RENAME_TYPE.BOTH)
    ) {
      // suppose the attachment folder already renamed
      await this.renameFiles(oldAttachPath, newAttachPath, false, oldName, newName);
    }
  }

  async renameFolder(
    oldAttachPath: string,
    newAttachPath: string,
    oldName: string,
    newName: string,
    attachRenameType: ATTACHMENT_RENAME_TYPE
  ) {
    const { stripedSrc, stripedDst } = stripPaths(oldAttachPath, newAttachPath);

    debugLog("onRename - striped source:", stripedSrc);
    debugLog("onRename - striped destination:", stripedDst);

    if (stripedSrc === stripedDst) {
      debugLog("onRename - same striped path");
    }

    if (
      stripedSrc !== stripedDst &&
      (attachRenameType === ATTACHMENT_RENAME_TYPE.FOLDER || attachRenameType === ATTACHMENT_RENAME_TYPE.BOTH)
    ) {
      const exitsDst = await this.app.vault.adapter.exists(stripedDst);
      if (exitsDst) {
        debugLog("renameFolder - target folder exists:", stripedDst);
        // move the files in oldAttachPath to newAttachPath
        await this.renameFiles(oldAttachPath, newAttachPath, true, oldName, newName);
        // rm the old folder if it's empty
        const old = await this.app.vault.adapter.list(oldAttachPath);
        if (old.files.length === 0 && old.folders.length === 0) {
          await this.app.vault.adapter.rmdir(oldAttachPath, true);
        }
        return;
      } else {
        const src = this.app.vault.getAbstractFileByPath(oldAttachPath);
        if (src === null) {
          debugLog("renameFolder - source file not exists:", oldAttachPath);
          return;
        }
        await this.app.fileManager.renameFile(src, newAttachPath);
      }
    }
  }

  async renameFiles(srcPath: string, dstPath: string, exists: boolean, oldName: string, newName: string) {
    let attachmentFiles: ListedFiles;
    if (exists) {
      attachmentFiles = await this.app.vault.adapter.list(srcPath);
    } else {
      attachmentFiles = await this.app.vault.adapter.list(dstPath);
    }

    debugLog("renameFiles - attachmentFiles:", attachmentFiles);

    // rename all attachment files that the filename content the ${notename} in attachment path
    for (const filePath of attachmentFiles.files) {
      let fileName = path.basename(filePath);
      const fileExtension = path.extname(fileName);
      if (
        (this.settings.handleAll && testExcludeExtension(fileExtension, this.settings.excludeExtensionPattern)) ||
        !isImage(fileExtension)
      ) {
        debugLog("renameFiles - no handle extension:", fileExtension);
        continue;
      }

      fileName = fileName.replace(oldName, newName);

      const dstFolder = this.app.vault.getAbstractFileByPath(dstPath) as TFolder,
        { name } = await deduplicateNewName(fileName, dstFolder),
        newFilePath = normalizePath(path.join(dstPath, name)),
        src = this.app.vault.getAbstractFileByPath(filePath);

      debugLog("renameFiles - new file path:", newFilePath);
      if (src === null) {
        continue;
      }
      await this.app.fileManager.renameFile(src, newFilePath);
    }
  }
}
