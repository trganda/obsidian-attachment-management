import { App, ListedFiles, TFile, TFolder, normalizePath } from "obsidian";
import { AttachmentManagementPluginSettings, AttachmentPathSettings, DEFAULT_SETTINGS } from "./settings/settings";
import { RenameEventType, RENAME_EVENT_TYPE_FILE, SETTINGS_VARIABLES_NOTENAME } from "./lib/constant";
import { deduplicateNewName } from "./lib/deduplicate";
import { path } from "./lib/path";
import { debugLog } from "./log";
import { ATTACHMENT_RENAME_TYPE, stripPaths, matchExtension, isImage } from "./utils";
import { getMetadata } from "./metadata";
import { getExtensionOverrideSetting } from "./model/extensionOverride";

export class RenameHandler {
    readonly app: App;
    readonly settings: AttachmentManagementPluginSettings;
    readonly overrideSetting: AttachmentPathSettings;

    constructor(app: App, settings?: AttachmentManagementPluginSettings, overrideSetting?: AttachmentPathSettings) {
        this.app = app;
        if (settings === undefined) {
            this.settings = DEFAULT_SETTINGS;
        } else {
            this.settings = settings;
        }
        if (overrideSetting === undefined) {
            this.overrideSetting = DEFAULT_SETTINGS.attachPath;
        } else {
            this.overrideSetting = overrideSetting;
        }
    }

    async onRename(
        file: TFile,
        oldPath: string,
        eventType: RenameEventType,
        attachRenameType: ATTACHMENT_RENAME_TYPE = ATTACHMENT_RENAME_TYPE.NULL,
    ) {
        const rf = file as TFile;

        const oldMetadata = getMetadata(oldPath);
        const newMetadata = getMetadata(file.path);

        debugLog("onRename - old metadata:", oldMetadata);
        debugLog("onRename - new metadata:", newMetadata);

        const oldAttachPath = oldMetadata.getAttachmentPath(this.overrideSetting);
        const newAttachPath = newMetadata.getAttachmentPath(this.overrideSetting);

        debugLog("onRename - old attachment path:", oldAttachPath);
        debugLog("onRename - new attachment path:", newAttachPath);

        // if the old attachment folder does not exist, skip
        // this will happen when we have already rename the attachment file or folder in previous rename event
        if (!(await this.app.vault.adapter.exists(oldAttachPath, true))) {
            debugLog("onRename - attachment path does not exist:", oldAttachPath);
            return;
        }

        // create the new attachment folder
        if (!(await this.app.vault.adapter.exists(newAttachPath, true))) {
            debugLog("onRename - mkdir:", newAttachPath);
            await this.app.vault.adapter.mkdir(newAttachPath);
        }

        let oldName = "";
        let newName = "";
        if (
            eventType === RENAME_EVENT_TYPE_FILE &&
            (attachRenameType === ATTACHMENT_RENAME_TYPE.FILE || attachRenameType === ATTACHMENT_RENAME_TYPE.BOTH)
        ) {
            oldName = oldMetadata.basename;
            newName = rf.basename;
        }

        // rename attachment folder first
        await this.renameFolder(oldAttachPath, newAttachPath, attachRenameType);

        // rename attachment filename as needed
        if (
            eventType === RENAME_EVENT_TYPE_FILE &&
            (attachRenameType === ATTACHMENT_RENAME_TYPE.FILE || attachRenameType === ATTACHMENT_RENAME_TYPE.BOTH)
        ) {
            // suppose the attachment folder already renamed
            await this.renameFiles(oldAttachPath, newAttachPath, false, oldName, newName);
        }
    }

    /**
     * Renames attachment folder in the app's vault, this function only move the attachment files from
     * one place to another, not rename the filename.
     * @param {string} oldAttachPath - the original path of the folder
     * @param {string} newAttachPath - the new path of the folder
     * @param {ATTACHMENT_RENAME_TYPE} attachRenameType - the type of the attachment rename
     */
    async renameFolder(oldAttachPath: string, newAttachPath: string, attachRenameType: ATTACHMENT_RENAME_TYPE) {
        const { stripedSrc, stripedDst } = stripPaths(oldAttachPath, newAttachPath);

        debugLog("renameFolder - striped source:", stripedSrc);
        debugLog("renameFolder - striped destination:", stripedDst);

        if (stripedSrc === stripedDst) {
            debugLog("renameFolder - same striped path");
            return;
        }

        if (attachRenameType === ATTACHMENT_RENAME_TYPE.FOLDER || attachRenameType === ATTACHMENT_RENAME_TYPE.BOTH) {
            const exitsDst = await this.app.vault.adapter.exists(stripedDst, true);
            if (exitsDst) {
                debugLog("renameFolder - target folder exists:", stripedDst);
                // move the files in oldAttachPath to newAttachPath
                await this.renameFiles(oldAttachPath, newAttachPath, true, "", "");
                // rm the old folder if it's empty
                const old = await this.app.vault.adapter.list(oldAttachPath);
                if (old.files.length === 0 && old.folders.length === 0) {
                    await this.app.vault.adapter.rmdir(oldAttachPath, true);
                }
                return;
            } else {
                const src = this.app.vault.getAbstractFileByPath(stripedSrc);
                if (src === null) {
                    debugLog("renameFolder - source file not exists:", stripedSrc);
                    return;
                }
                debugLog("renameFolder - :", src.path, stripedDst);
                await this.app.fileManager.renameFile(src, stripedDst);
            }
        }
    }

    /**
     * Renames (or move) attachment files in the dstPath (or srcPath) directories. If the exists is true, it will
     * move the file from @param srcPath to @param dstPath.
     * @param {string} srcPath - The source directory path.
     * @param {string} dstPath - The destination directory path.
     * @param {boolean} exists - Determines whether to rename (or move) files.
     * @param {string} oldName - The old name of the notes, should be "" if the ${notename} was not used.
     * @param {string} newName - The new name of the notes, should be "" if the ${notename} was not used.
     */
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
            const fileName = path.basename(filePath);
            const fileExtension = path.extname(fileName);

            let baseName = path.basename(fileName, fileExtension);

            const { extSetting } = getExtensionOverrideSetting(fileExtension, this.overrideSetting);
            if (
                matchExtension(fileExtension, this.settings.excludeExtensionPattern) ||
                (extSetting === undefined && !isImage(fileExtension))
            ) {
                debugLog("renameFiles - excluded file by extension:", fileExtension);
                continue;
            }

            // no ${notename} used, continue;
            if (!exists && extSetting !== undefined && !extSetting.attachFormat.includes(SETTINGS_VARIABLES_NOTENAME)) {
                debugLog(`renameFiles - no ${SETTINGS_VARIABLES_NOTENAME} used:`, this.overrideSetting);
                continue;
            } else if (
                !exists &&
                extSetting === undefined &&
                !this.overrideSetting.attachFormat.includes(SETTINGS_VARIABLES_NOTENAME)
            ) {
                debugLog(`renameFiles - no ${SETTINGS_VARIABLES_NOTENAME} used global:`, this.overrideSetting);
                continue;
            }

            debugLog("renameFiles - fileName:", oldName, newName);
            baseName = baseName.replace(oldName, newName) + "." + fileExtension;
            debugLog("renameFiles - fileName:", baseName);

            if (filePath === normalizePath(path.join(dstPath, baseName))) {
                debugLog("renameFiles - same src and dst:", filePath);
                continue;
            }

            const dstFolder = this.app.vault.getAbstractFileByPath(dstPath) as TFolder,
                { name } = await deduplicateNewName(baseName, dstFolder),
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
