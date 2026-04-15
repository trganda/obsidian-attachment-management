import { App, Plugin, Notice, TFile, TFolder, normalizePath, MarkdownView } from "obsidian";
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

    // Generate the old link before renaming, to find and replace it later
    const oldLink = this.app.fileManager.generateMarkdownLink(attach, source.path);

    // Use vault.rename instead of fileManager.renameFile to avoid automatic link updates
    // that modify the source file on disk and cause the editor to reload (losing cursor/scroll position).
    this.app.vault
      .rename(attach, dst)
      .then(() => {
        new Notice(`Renamed ${name} to ${attachName}.`);

        // Generate the new link after renaming (attach.path is now updated by vault.rename)
        const newLink = this.app.fileManager.generateMarkdownLink(attach, source.path);
        debugLog("renameFile - old link:", oldLink, "new link:", newLink);

        // Manually update the link in the source file
        this.updateLinkInSource(source, oldLink, newLink);
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

  /**
   * Update the old link to new link in the source file.
   * For markdown files with an active editor, use editor.replaceRange to avoid file reload and cursor jump.
   * For other cases (canvas, non-active files), fall back to adapter.process.
   * @param source - the source file containing the link
   * @param oldLink - the old link text to replace
   * @param newLink - the new link text
   */
  private updateLinkInSource(source: TFile, oldLink: string, newLink: string) {
    if (oldLink === newLink) {
      return;
    }

    // For markdown files, try to use the editor API to avoid reload and cursor jump
    const mdView = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (mdView && mdView.file && mdView.file.path === source.path && mdView.editor) {
      const editor = mdView.editor;
      const content = editor.getValue();
      const linkIndex = content.indexOf(oldLink);
      if (linkIndex !== -1) {
        // Calculate line/ch positions for replaceRange
        const before = content.substring(0, linkIndex);
        const lines = before.split("\n");
        const fromLine = lines.length - 1;
        const fromCh = lines[fromLine].length;

        const oldLinkLines = oldLink.split("\n");
        const toLine = fromLine + oldLinkLines.length - 1;
        const toCh =
          oldLinkLines.length > 1 ? oldLinkLines[oldLinkLines.length - 1].length : fromCh + oldLink.length;

        // replaceRange preserves cursor position and does not trigger a file reload
        editor.replaceRange(newLink, { line: fromLine, ch: fromCh }, { line: toLine, ch: toCh });
        debugLog("updateLinkInSource - updated via editor API");
        return;
      }
    }

    // Fallback for canvas or non-active files: update via adapter.process
    debugLog("updateLinkInSource - falling back to adapter.process");
    this.app.vault.adapter.process(source.path, (data) => {
      return data.replace(oldLink, newLink);
    });
  }
}
