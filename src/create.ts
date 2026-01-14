import { App, Plugin, Notice, TFile, TFolder, normalizePath } from "obsidian";
import { deduplicateNewName } from "./lib/deduplicate";
import { path } from "./lib/path";
import { debugLog } from "./lib/log";
import { AttachmentManagementPluginSettings } from "./settings/settings";
import { getOverrideSetting } from "./override";
import { getMetadata } from "./settings/metadata";
import { isExcluded } from "./exclude";
import { getExtensionOverrideSetting } from "./model/extensionOverride";
import { md5sum, isImage, isPastedImage } from "./utils";
import { saveOriginalName } from "./lib/originalStorage";
import { LinkUpdater } from "./lib/linkUpdater";

export class CreateHandler {
  readonly plugin: Plugin;
  readonly app: App;
  readonly settings: AttachmentManagementPluginSettings;
  readonly linkUpdater: LinkUpdater;

  constructor(plugin: Plugin, settings: AttachmentManagementPluginSettings) {
    this.plugin = plugin;
    this.app = plugin.app;
    this.settings = settings;
    this.linkUpdater = new LinkUpdater(plugin.app);
  }

  /**
   * Post-processing of created attachment file (for paste and drop event).
   * @param attach - the attachment file to process
   * @param source - the notes file that linked to attach
   * @returns - none
   */
  processAttach(attach: TFile, source: TFile) {
    // ignore if the path of notes file has been excluded.
    if (source.parent && isExcluded(source.parent.path, this.settings)) {
      debugLog("processAttach - not a file or exclude path:", source.path);
      new Notice(`${source.path} was excluded from attachment management.`);
      return;
    }

    // get override setting for the notes file or extension
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
        this.app.vault.adapter
          .exists(attachPath, true)
          .then(async (exists) => {
            if (!exists) {
              await this.app.vault.adapter.mkdir(attachPath);
              debugLog("processAttach - create path:", attachPath);
            }
          })
          .finally(() => {
            const attachPathFolder = this.app.vault.getAbstractFileByPath(attachPath) as TFolder;
            // deduplicate the new name if needed
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
    const oldPath = attach.path;

    // this api will not update the link in markdown file automatically on `create` event
    // forgive using to rename, refer: https://github.com/trganda/obsidian-attachment-management/issues/46
    this.app.fileManager
      .renameFile(attach, dst)
      .then(async () => {
        new Notice(`Renamed ${name} to ${attachName}.`);
        
        // 手动更新链接引用，因为fileManager.renameFile在create事件中不会自动更新链接
        try {
          await this.linkUpdater.updateLinksForRenamedFile(oldPath, dst);
          debugLog(`Successfully updated links for created file: ${oldPath} -> ${dst}`);
        } catch (error) {
          console.error(`Failed to update links for created file: ${oldPath} -> ${dst}`, error);
        }
      })
      .finally(() => {
        // save origianl name in setting
        const { setting } = getOverrideSetting(this.settings, source);
        md5sum(this.app.vault.adapter, attach).then((md5) => {
          saveOriginalName(this.settings, setting, attach.extension, {
            n: original,
            md5: md5,
          });
          this.plugin.saveData(this.settings);
        });
      });
  }
}
