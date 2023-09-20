import { App, Notice, TFile, TFolder, normalizePath } from "obsidian";
import { deduplicateNewName } from "./lib/deduplicate";
import { path } from "./lib/path";
import { debugLog } from "./log";
import { AttachmentManagementPluginSettings, DEFAULT_SETTINGS } from "./settings/settings";
import { getActiveFile, getActiveView } from "./commons";
import { getOverrideSetting } from "./override";
import { getMetadata } from "./metadata";
import { isExcluded } from "./exclude";
import { getExtensionOverrideSetting } from "./model/extensionOverride";
import { isImage, isPastedImage } from "./utils";

export class CreateHandler {
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

    /**
     * Post-processing of created attachment file (for paste and drop event).
     * @param file - the file to process
     * @returns - none
     */
    async processAttach(file: TFile) {
        const activeFile = getActiveFile(this.app);
        if (activeFile === undefined) {
            new Notice("Error: no active file found.");
            return;
        }

        debugLog("processAttach - parent:", activeFile.parent?.path);
        if (activeFile.parent && isExcluded(activeFile.parent.path, this.settings)) {
            debugLog("processAttach - not a file or exclude path:", activeFile.path);
            new Notice(`${activeFile.path} was excluded, skipped`);
            return;
        }

        const { setting } = getOverrideSetting(this.settings, activeFile);
        const { extSetting } = getExtensionOverrideSetting(file.extension, setting);

        if (extSetting === undefined && (!isImage(file.extension) || !isPastedImage(file))) {
            debugLog("renameFiles - no handle extension:", file.extension);
            return;
        }

        debugLog("processAttach - active file path", activeFile.path);

        const metadata = getMetadata(activeFile.path, file);
        debugLog("processAttach - metadata:", metadata);

        // const attachName =
        //   getAttachFileName(activeFile.basename, file.basename, setting, this.settings.dateFormat) +
        //   "." +
        //   file.extension;
        // const attachPath = getAttachmentPath(activeFile.basename, parentPath, parentName, setting);
        const attachPath = metadata.getAttachmentPath(setting);
        const attachName =
            (await metadata.getAttachFileName(
                setting,
                this.settings.dateFormat,
                file.basename,
                this.app.vault.adapter,
            )) +
            "." +
            file.extension;

        // make sure the path was created
        if (!(await this.app.vault.adapter.exists(attachPath, true))) {
            await this.app.vault.adapter.mkdir(attachPath);
            debugLog("processAttach - create path:", attachPath);
        }

        const attachPathFile = this.app.vault.getAbstractFileByPath(attachPath) as TFolder;
        const { name } = await deduplicateNewName(attachName, attachPathFile);

        debugLog("processAttach - new path of file:", path.join(attachPath, name));

        await this.renameCreateFile(file, attachPath, name, activeFile, true);
    }

    /**
     * Rename the file specified by `@param file`, and update the link of the file if specified updateLink
     * @param file - file to rename
     * @param attachPath - where to the renamed file will be move to
     * @param attachName - name of the renamed file
     * @param activeFile - associated active file
     * @param updateLink - whether to replace the link of renamed file
     * @returns - none
     */
    async renameCreateFile(
        file: TFile,
        attachPath: string,
        attachName: string,
        activeFile: TFile,
        updateLink?: boolean,
    ) {
        const dst = normalizePath(path.join(attachPath, attachName));
        debugLog("renameFile - ", file.path, " to ", dst);

        const oldLinkText = this.app.fileManager.generateMarkdownLink(file, activeFile.path);
        const oldPath = file.path;
        const oldName = file.name;

        // this api will not update the link automatically on `create` event
        // forgive using to rename, refer: https://github.com/trganda/obsidian-attachment-management/issues/46
        //   await this.app.fileManager.renameFile(file, dst);
        await this.app.vault.adapter.rename(file.path, dst);
        new Notice(`Renamed ${oldName} to ${attachName}.`);

        if (!updateLink) {
            return;
        }

        // in case fileManager.renameFile may not update the internal link in the active file,
        // we manually replace the current line by manipulating the editor
        const newLinkText = this.app.fileManager.generateMarkdownLink(file, activeFile.path);
        debugLog("renameFile - replace text:", oldLinkText, newLinkText);

        const view = getActiveView(this.app);
        if (view === null) {
            new Notice(`Failed to update link in ${activeFile.path}: no active view`);
            return;
        }
        const content = view.getViewData();
        let val = "";
        switch (activeFile.extension) {
            case "md":
                val = content.replace(oldLinkText, newLinkText);
                break;
            case "canvas":
                val = content.replace(`/(file\s*\:\s*\")${oldPath}(\")/g`, `$1${dst}$2`);
                break;
        }

        view.setViewData(val, false);
        new Notice(`Updated 1 link in ${activeFile.path}`);
    }
}
