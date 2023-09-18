import { Notice, Plugin, TAbstractFile, TFile, TFolder } from "obsidian";
import {
  AttachmentManagementPluginSettings,
  AttachmentPathSettings,
  DEFAULT_SETTINGS,
  SETTINGS_TYPES,
  SettingTab,
} from "./settings/settings";
import { debugLog } from "./log";
import { RENAME_EVENT_TYPE_FILE, RENAME_EVENT_TYPE_FOLDER, RenameEventType } from "./lib/constant";
import { OverrideModal } from "./model/override";
import { path } from "./lib/path";
import { getActiveFile } from "./commons";
import { deleteOverrideSetting, getOverrideSetting, getRenameOverrideSetting, updateOverrideSetting } from "./override";
import {
  isAttachment,
  isMarkdownFile,
  isCanvasFile,
  isImage,
  isPastedImage,
  testExcludeExtension,
  attachRenameType,
  ATTACHMENT_RENAME_TYPE,
} from "./utils";
import { ArrangeHandler } from "./arrange";
import { CreateHandler } from "./create";
import { RenameHandler } from "./rename";
import { isExcluded } from "./exclude";

export default class AttachmentManagementPlugin extends Plugin {
  settings: AttachmentManagementPluginSettings;
  originalObsAttachPath: string;

  async onload() {
    await this.loadSettings();

    console.log(`Plugin loading: ${this.manifest.name} v.${this.manifest.version}`);
    // this.backupConfigs();

    this.addCommand({
      id: "attachment-management-rearrange-all-links",
      name: "Rearrange all linked attachments",
      callback: () => {
        new ArrangeHandler(this.settings, this.app).rearrangeAttachment("links");
        new Notice("Arrange completed");
      },
    });

    this.addCommand({
      id: "attachment-management-rearrange-active-links",
      name: "Rearrange linked attachments",
      callback: () => {
        new ArrangeHandler(this.settings, this.app).rearrangeAttachment("active");
        new Notice("Arrange completed");
      },
    });

    this.addCommand({
      id: "override-setting",
      name: "Overriding setting",
      checkCallback: (checking: boolean) => {
        const file = getActiveFile(this.app);

        if (file) {
          if (isAttachment(this.settings, file)) {
            new Notice(`${file.path} is an attachment, skipped`);
            return true;
          }

          if (!checking) {
            if (file.parent && isExcluded(file.parent.path, this.settings)) {
              new Notice(`${file.path} was excluded, skipped`);
              return true;
            }
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
      name: "Reset override setting",
      checkCallback: (checking: boolean) => {
        const file = getActiveFile(this.app);
        if (file) {
          if (isAttachment(this.settings, file)) {
            new Notice(`${file.path} is an attachment, skipped`);
            return true;
          }

          if (!checking) {
            if (file.parent && isExcluded(file.parent.path, this.settings)) {
              new Notice(`${file.path} was excluded, skipped`);
              return true;
            }
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
        if ((file.parent && isExcluded(file.parent.path, this.settings)) || isAttachment(this.settings, file)) {
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
      this.app.vault.on("create", async (file: TAbstractFile) => {
        debugLog("on create event - file:", file.path);
        // only processing create of file, ignore folder creation
        if (!(file instanceof TFile)) {
          return;
        }

        this.app.workspace.onLayoutReady(async () => {
          // if the file is created more than 1 second ago, the event is most likely be fired by copy file to
          // vault folder without using obsidian (e.g. file manager of op system), we should ignore it.
          const timeGapMs = new Date().getTime() - file.stat.mtime;
          if (timeGapMs > 1000) {
            return;
          }
          // ignore markdown and canvas file.
          if (isMarkdownFile(file.extension) || isCanvasFile(file.extension)) {
            return;
          }

          const processor = new CreateHandler(this.app, this.settings);
          if (
            !testExcludeExtension(file.extension, this.settings.excludeExtensionPattern) ||
            isImage(file.extension) ||
            isPastedImage(file)
          ) {
            debugLog("create - image", file);
            await processor.processAttach(file);
          } else {
            debugLog("create - excluded file by extension", file);
            return;
          }
        });
      })
    );

    this.registerEvent(
      // while trigger rename event on rename a folder, for each file/folder in this renamed folder (include itself) will trigger this event
      this.app.vault.on("rename", async (file: TAbstractFile, oldPath: string) => {
        debugLog("on rename event - new path and old path:", file.path, oldPath);

        const { setting } = getRenameOverrideSetting(this.settings, file, oldPath);
        // update the override setting
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
          if (file.parent && isExcluded(file.parent.path, this.settings)) {
            debugLog("rename - exclude path:", file.parent.path);
            new Notice(`${file.path} was excluded, skipped`);
            return;
          }
          // if the renamed file was a attachment, skip
          if (isAttachment(this.settings, file)) {
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

          const processor = new RenameHandler(this.app, this.settings);
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

        if ((file.parent && isExcluded(file.parent.path, this.settings)) || isAttachment(this.settings, file)) {
          debugLog("rename - exclude path or the file is an attachment:", file.path);
          return;
        }

        if (deleteOverrideSetting(this.settings, file)) {
          await this.saveSettings();
          await this.loadSettings();
          new Notice("Removed override setting of " + file.path);
        }
      })
    );

    // This adds a settings tab so the user can configure various aspects of the plugin
    this.addSettingTab(new SettingTab(this.app, this));
  }

  async overrideConfiguration(file: TAbstractFile, setting: AttachmentPathSettings) {
    new OverrideModal(this, file, setting).open();
    await this.loadSettings();
  }

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
