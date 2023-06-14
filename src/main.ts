import { Notice, Plugin, TAbstractFile, TFile, TFolder } from "obsidian";
import {
  AttachmentManagementPluginSettings,
  AttachmentPathSettings,
  DEFAULT_SETTINGS,
  SETTINGS_TYPES,
  SettingTab,
} from "./settings/settings";
import {
  ATTACHMENT_RENAME_TYPE,
  attachRenameType,
  getOverrideSetting,
  getParentFolder,
  getRenameOverrideSetting,
  isAttachment,
  isCanvasFile,
  isImage,
  isMarkdownFile,
  isPastedImage,
  stripPaths,
  testExcludeExtension,
  updateOverrideSetting,
} from "./utils";
import { debugLog } from "./log";
import { RENAME_EVENT_TYPE_FILE, RENAME_EVENT_TYPE_FOLDER, RenameEventType } from "./lib/constant";
import { OverrideModal } from "./model/override";
import { path } from "./lib/path";
import CreateProcessor from "./create";
import RenameProcessor from "./rename";
import { getActiveFile } from "./commons";

export default class AttachmentManagementPlugin extends Plugin {
  settings: AttachmentManagementPluginSettings;
  originalObsAttachPath: string;

  async onload() {
    await this.loadSettings();

    console.log(`Plugin loading: ${this.manifest.name} v.${this.manifest.version}`);
    // this.backupConfigs();

    // this.addCommand({
    //   id: "attachment-management-rearrange-links",
    //   name: "Rearrange Linked Attachments",
    //   callback: () => this.rearrangeAttachment("links"),
    // });

    // this.addCommand({
    //   id: "obsidian-attachment-rearrange-all",
    //   name: "Rearrange All Attachments",
    //   callback: () => this.rearrangeAttachment("all"),
    // });

    this.addCommand({
      id: "override-setting",
      name: "Overriding Setting",
      checkCallback: (checking: boolean) => {
        const file = getActiveFile(this.app);
        if (file) {
          if ((isAttachment(this.settings, file))) {
            return true;
          }
          if (!checking) {
            const { setting } = getOverrideSetting(this.settings, file);
            const fileSetting = Object.assign({}, setting);
            this.overrideConfiguration(file, fileSetting);
          }
          return true;
        }
        return false;
      },
    });

    this.addCommand({
      id: "reset-override-setting",
      name: "Reset Override Setting",
      checkCallback: (checking: boolean) => {
        const file = getActiveFile(this.app);
        if (file) {
          if ((isAttachment(this.settings, file))) {
            return true;
          }
          if (!checking) {
            delete this.settings.overridePath[file.path];
            this.saveSettings();
            new Notice(`Reset attachment setting of ${file.path}`);
          }
          return true;
        }
        return false;
      },
    });

    this.registerEvent(
      this.app.workspace.on("file-menu", async (menu, file) => {
        if ((isAttachment(this.settings, file))) {
          return;
        }
        menu.addItem((item) => {
          item
            .setTitle("Overriding attachment setting")
            .setIcon("image-plus")
            .onClick(async () => {
              const { setting } = getOverrideSetting(this.settings, file);
              const fileSetting = Object.assign({}, setting);
              await this.overrideConfiguration(file, fileSetting);
            });
        });
      })
    );

    this.registerEvent(
      // not working while drop file to text view
      this.app.vault.on("create", (file: TAbstractFile) => {
        debugLog("on create event - file:", file.path);
        // only processing create of file, ignore folder creation
        if (!(file instanceof TFile)) {
          return;
        }

        this.app.workspace.onLayoutReady(() => {
          // if the file is created more than 1 second ago, the event is most likely be fired by copy file to
          // vault folder without using obsidian (e.g. file manager of op system), we should ignore it.
          const timeGapMs = new Date().getTime() - file.stat.ctime;
          if (timeGapMs > 1000) {
            return;
          }
          // ignore markdown and canvas file.
          if (isMarkdownFile(file.extension) || isCanvasFile(file.extension)) {
            return;
          }

          const processor = new CreateProcessor(this.app, this.settings);
          if (isImage(file.extension) || isPastedImage(file)) {
            processor.processAttach(file);
          } else {
            if (this.settings.handleAll) {
              debugLog("create - handleAll for file", file);
              if (testExcludeExtension(file.extension, this.settings.excludeExtensionPattern)) {
                debugLog("create - excluded file by extension", file);
                return;
              }
              processor.processAttach(file);
            }
          }
        });
      })
    );

    this.registerEvent(
      // while trigger rename event on rename a folder, for each file/folder in this renamed folder (include itself) will trigger this event
      this.app.vault.on("rename", async (file: TAbstractFile, oldPath: string) => {
        debugLog("on rename event - new path and old path:", file.path, oldPath);

        const { setting } = getRenameOverrideSetting(this.settings, file, oldPath);

        debugLog("rename - using settings:", setting);
        if (setting.type === SETTINGS_TYPES.FOLDER || setting.type === SETTINGS_TYPES.FILE) {
          updateOverrideSetting(this.settings, file, oldPath);
          await this.saveSettings();
          await this.loadSettings();
        }
        debugLog("rename - updated settings:", setting);

        if (!this.settings.autoRenameAttachment) {
          debugLog("rename - auto rename not enabled:", this.settings.autoRenameAttachment);
          return;
        }

        const type = attachRenameType(setting);
        debugLog("rename - attachRenameType:", type);
        if (type === ATTACHMENT_RENAME_TYPE.NULL) {
          debugLog("rename - no variable use, skipped");
          return;
        }

        if (file instanceof TFile) {
          // if the renamed file was a attachment, skip
          const flag = isAttachment(this.settings, file);
          if (flag) {
            debugLog("rename - not processing rename on attachment:", file.path);
            return;
          }

          let eventType: RenameEventType;
          if (path.basename(oldPath, path.extname(oldPath)) === path.basename(file.path, path.extname(file.path))) {
            // rename event of folder
            eventType = RENAME_EVENT_TYPE_FOLDER;
            debugLog("rename - RENAME_EVENT_TYPE:", RENAME_EVENT_TYPE_FOLDER);
          } else {
            // rename event of file
            eventType = RENAME_EVENT_TYPE_FILE;
            debugLog("rename - RENAME_EVENT_TYPE:", RENAME_EVENT_TYPE_FILE);
          }

          const processor = new RenameProcessor(this.app, this.settings);
          await processor.onRename(file, oldPath, eventType, type, setting);
        } else if (file instanceof TFolder) {
          // ignore rename event of folder
          // debugLog("rename - ignore rename folder event:", file.name, oldPath);
          return;
        }
      })
    );

    this.registerEvent(
      this.app.vault.on("delete", async (file: TAbstractFile) => {
        debugLog("on delete event - file path:", file.path);
      })
    )

    // This adds a settings tab so the user can configure various aspects of the plugin
    this.addSettingTab(new SettingTab(this.app, this));
  }

  async overrideConfiguration(file: TAbstractFile, setting: AttachmentPathSettings) {
    new OverrideModal(this, file, setting).open();
    await this.loadSettings();
  }

  // async rearrangeAttachment(type: "all" | "links") {
  //   debugLog("On Rearrange Command");

  //   if (!this.settings.autoRenameAttachment) {
  //     debugLog("No Variable Use, Skip");
  //     return;
  //   }

  //   // only rearrange attachment that linked by markdown or canvas
  //   const attachments = await getAttachmentsInVault(this.settings, this.app, type);
  //   debugLog("Attachments:", Object.keys(attachments).length, Object.entries(attachments));
  //   for (const obsFile of Object.keys(attachments)) {
  //     const innerFile = this.app.vault.getAbstractFileByPath(obsFile);
  //     if (innerFile === null) {
  //       debugLog(`${obsFile} not exists, skipped`);
  //       continue;
  //     }
  //     const { setting } = getOverrideSetting(this.settings, innerFile);

  //     const type = attachRenameType(setting);
  //     if (type === ATTACHMENT_RENAME_TYPE.ATTACHMENT_RENAME_TYPE_NULL) {
  //       debugLog("No variable use, skipped");
  //       return;
  //     }

  //     for (let link of attachments[obsFile]) {
  //       try {
  //         link = decodeURI(link);
  //       } catch (err) {
  //         // new Notice(`Invalid link: ${link}, err: ${err}`);
  //         console.log(`Invalid link: ${link}, err: ${err}`);
  //         continue;
  //       }
  //       debugLog(`Article: ${obsFile} Links: ${link}`);
  //       const noteExt = path.posix.extname(obsFile);
  //       const noteName = path.posix.basename(obsFile, noteExt);
  //       const notePath = path.posix.dirname(obsFile);

  //       const attachPath = this.getAttachmentPath(noteName, notePath, setting);
  //       const attachName = this.getPastedImageFileName(noteName, setting);
  //       const dest = path.posix.join(attachPath, attachName + path.posix.extname(link));

  //       // check if the link was already satisfy the attachment name config
  //       if (!needToRename(setting, attachPath, attachName, noteName, link)) {
  //         debugLog("No need to rename:", link);
  //         continue;
  //       }
  //       const linkFile = this.app.vault.getAbstractFileByPath(link);
  //       if (linkFile === null) {
  //         debugLog(`${link} not exists, skipped`);
  //         continue;
  //       }

  //       if (!(await this.app.vault.adapter.exists(attachPath))) {
  //         this.app.vault.adapter.mkdir(attachPath);
  //       }

  //       // TODO: check if the file already exists
  //       if (await this.app.vault.adapter.exists(dest)) {
  //         new Notice(`${dest} already exists, skipped`);
  //         console.log(`${dest} already exists, skipped`);
  //         continue;
  //       }

  //       await this.app.fileManager.renameFile(linkFile, dest);
  //     }
  //   }
  // }

  backupConfigs() {
    //@ts-ignore
    this.originalObsAttachPath = this.app.vault.getConfig("attachmentFolderPath");
  }

  restoreConfigs() {
    //@ts-ignore
    this.app.vault.setConfig("attachmentFolderPath", this.originalObsAttachPath);
  }
  updateAttachmentFolderConfig(path: string) {
    //@ts-ignore
    this.app.vault.setConfig("attachmentFolderPath", path);
  }

  onunload() {
    // this.restoreConfigs();
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }
}
