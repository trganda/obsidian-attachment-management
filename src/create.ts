import { App, Plugin, Notice, TFile, TFolder, normalizePath } from "obsidian";
import { deduplicateNewName } from "./lib/deduplicate";
import { path } from "./lib/path";
import { debugLog } from "./lib/log";
import { AttachmentManagementPluginSettings } from "./settings/settings";
import { getOverrideSetting } from "./override";
import { getMetadata } from "./settings/metadata";
import { isExcluded } from "./exclude";
import { getExtensionOverrideSetting } from "./model/extensionOverride";
import { MD5, isImage, isPastedImage } from "./utils";
import { saveOrigianlName } from "./lib/originalStorage";
import { getActiveFile } from "./commons";

export class CreateHandler {
    readonly plugin: Plugin;
    readonly app: App;
    readonly settings: AttachmentManagementPluginSettings;

    constructor(plugin: Plugin, settings: AttachmentManagementPluginSettings) {
        this.plugin = plugin;
        this.app = this.plugin.app;
        this.settings = settings;
    }

    /**
     * Post-processing of created attachment file (for paste and drop event).
     * @param attach - the attachment file to process
     * @returns - none
     */
    processAttach(attach: TFile, source: TFile) {
        const activeFile = getActiveFile(this.app);
        if (activeFile == undefined || activeFile != source) {
            debugLog("Error: no active file found.");
            return;
        }
        
        debugLog("processAttach - parent:", source.parent?.path);
        if (source.parent && isExcluded(source.parent.path, this.settings)) {
            debugLog("processAttach - not a file or exclude path:", source.path);
            new Notice(`${source.path} was excluded, skipped`);
            return;
        }

        const { setting } = getOverrideSetting(this.settings, source);
        const { extSetting } = getExtensionOverrideSetting(attach.extension, setting);

        debugLog("processAttach - file.extension:", attach.extension);
        if (extSetting === undefined && !isImage(attach.extension) && !isPastedImage(attach)) {
            debugLog("renameFiles - no handle extension:", attach.extension);
            return;
        }

        const metadata = getMetadata(source.path, attach);
        debugLog("processAttach - metadata:", metadata);

        const attachPath = metadata.getAttachmentPath(setting, this.settings.dateFormat);
        metadata
            .getAttachFileName(setting, this.settings.dateFormat, attach.basename, this.app.vault.adapter)
            .then((attachName) => {
                attachName = attachName + "." + attach.extension;
                // make sure the attachment path was created
                this.app.vault.adapter.mkdir(attachPath).finally(() => {
                    debugLog("processAttach - create path:", attachPath);
                    const attachPathFolder = this.app.vault.getAbstractFileByPath(attachPath) as TFolder;
                    deduplicateNewName(attachName, attachPathFolder).then(({ name }) => {
                        debugLog("processAttach - new path of file:", path.join(attachPath, name));
                        this.renameCreateFile(attach, attachPath, name, source);
                    });
                });
            });
    }

    /**
     * Rename the file specified by `@param file`, and update the link of the file if specified updateLink
     * @param attach - file to rename
     * @param attachPath - where to the renamed file will be move to
     * @param attachName - name of the renamed file
     * @param source - associated active file
     * @returns - none
     */
    renameCreateFile(attach: TFile, attachPath: string, attachName: string, source: TFile) {
        const dst = normalizePath(path.join(attachPath, attachName));
        debugLog("renameFile - ", attach.path, " to ", dst);

        const original = attach.basename;
        const name = attach.name;

        // this api will not update the link in markdonw file automatically on `create` event
        // forgive using to rename, refer: https://github.com/trganda/obsidian-attachment-management/issues/46
        this.app.fileManager
            .renameFile(attach, dst)
            .then(() => {
                new Notice(`Renamed ${name} to ${attachName}.`);
            })
            .finally(() => {
                // save origianl name in setting
                const { setting } = getOverrideSetting(this.settings, source);
                MD5(this.app.vault.adapter, attach).then((md5) => {
                    saveOrigianlName(this.settings, setting, attach.extension, {
                        n: original,
                        md5: md5,
                    });
                    this.plugin.saveData(this.settings);
                });
            });
    }
}
