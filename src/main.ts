import { Notice, Plugin, TAbstractFile, TFile, TFolder } from "obsidian";
import {
  AttachmentManagementPluginSettings,
  AttachmentPathSettings,
  DEFAULT_SETTINGS,
  OriginalNameStorage,
  SETTINGS_TYPES,
  AttachmentManagementSettingTab,
} from "./settings/settings";
import { debugLog } from "./lib/log";
import { OverrideModal } from "./model/override";
import { initI18n, t } from "./i18n/index";
import { ConfirmModal } from "./model/confirm";
import { checkEmptyFolder, getActiveFile } from "./commons";
import { deleteOverrideSetting, getOverrideSetting, getRenameOverrideSetting, updateOverrideSetting } from "./override";
import { isAttachment, isMarkdownFile, isCanvasFile, matchExtension, md5sum } from "./utils";
import { ArrangeHandler, RearrangeType } from "./arrange";
import { CreateHandler } from "./create";
import { isExcluded } from "./exclude";
import { getMetadata } from "./settings/metadata";
import { DEFAULT_AI_RENAME_SETTINGS } from "./lib/ai";
import { migrateAiNamePath } from "./lib/aiStorage";

export default class AttachmentManagementPlugin extends Plugin {
  settings: AttachmentManagementPluginSettings;
  createdQueue: TFile[] = [];
  originalObsAttachPath: string;
  // Reason: Serializes attachment processing to prevent race conditions
  // during rapid consecutive pastes. Each processAttach completes before the next starts.
  private processPromise: Promise<void> = Promise.resolve();

  async onload() {
    await this.loadSettings();

    // Initilize i18n
    initI18n();

    console.log(`Plugin loading: ${this.manifest.name} v.${this.manifest.version}`);

    this.app.workspace.onLayoutReady(() => {
      this.initCommands();

      this.registerEvent(
        this.app.workspace.on("file-menu", async (menu, file) => {
          if ((file.parent && isExcluded(file.parent.path, this.settings)) || isAttachment(this.settings, file)) {
            return;
          }
          menu.addItem((item) => {
            item
              .setTitle(t("override.menuTitle"))
              .setIcon("image-plus")
              .onClick(async () => {
                const { setting } = getOverrideSetting(this.settings, file);
                // Deep copy
                const fileSetting = Object.assign({}, setting);
                this.overrideConfiguration(file, fileSetting);
              });
          });
        })
      );

      this.registerEvent(
        this.app.vault.on("create", async (file: TAbstractFile) => {
          debugLog("on create event - file:", file.path);
          // only processing creatation of file, ignore folder creation
          if (!(file instanceof TFile)) {
            return;
          }

          // if the file was modified/create more than 1 second ago, the event is most likely be fired by copy file to
          // vault folder without using obsidian or sync file from remote (e.g. file manager of os), we should ignore it.
          const curentTime = new Date().getTime();
          const timeGapMs = curentTime - file.stat.mtime;
          const timeGapCs = curentTime - file.stat.ctime;
          // ignore markdown and canvas file.
          if (timeGapMs > 1000 || timeGapCs > 1000 || isMarkdownFile(file.extension) || isCanvasFile(file.extension)) {
            return;
          }

          // ignore excluded extension
          if (matchExtension(file.extension, this.settings.excludeExtensionPattern)) {
            debugLog("create - excluded file by extension", file);
            return;
          }

          // add the created file to queue for processing in modify event (obsidian will add link to the file that will trigger modify event)
          this.createdQueue.push(file);
        })
      );

      this.registerEvent(
        this.app.vault.on("modify", async (file: TAbstractFile) => {
          debugLog("on modify event - create queue:", this.createdQueue);
          // Ignore if no file in the created queue
          if (this.createdQueue.length < 1 || !(file instanceof TFile)) {
            return;
          }

          debugLog("on modify event - file:", file.path);

          // Reason: Eagerly dequeue SYNCHRONOUSLY before any await, so that
          // overlapping modify events cannot both grab the same queue head.
          const f = this.createdQueue.first();
          if (f == undefined) {
            return;
          }
          this.createdQueue.remove(f);

          const exist = await this.app.vault.adapter.exists(f.path, true);
          if (!exist) {
            debugLog("on modify event - file does not exist:", f.path);
            return;
          }

          // Reason: Only md/canvas files contain attachment links.
          // Skip other file types to avoid unnecessary I/O on binary files.
          if (file.extension !== "md" && file.extension !== "canvas") {
            return;
          }

          // Reason: adapter.process() provides atomic read semantics, ensuring
          // we see the just-written content that triggered this modify event.
          const data = await this.app.vault.adapter.process(file.path, (d) => d);
          const link = this.app.fileManager.generateMarkdownLink(f, file.path);

          debugLog("on modify event - link generated:", link);
          debugLog("on modify event - file.extension:", file.extension);
          debugLog("on modify event - data contains link:", data.indexOf(link) != -1);
          debugLog("on modify event - data contains f.path:", data.indexOf(f.path) != -1);

          const isLinked =
            (file.extension == "md" && data.indexOf(link) != -1) ||
            (file.extension == "canvas" && data.indexOf(f.path) != -1);

          debugLog("on modify event - isLinked:", isLinked);

          if (!isLinked) {
            return;
          }

          // Serialize actual file processing to prevent concurrent renames
          const processor = new CreateHandler(this, this.settings);
          this.processPromise = this.processPromise.then(
            () => processor.processAttach(f, file, data, link),
            // Reason: Catch errors from previous promise to prevent chain breakage
            () => processor.processAttach(f, file, data, link)
          );
        })
      );

      this.registerEvent(
        // when trigger a rename event on folder, for each file/folder in this renamed folder (include itself) will trigger this event
        this.app.vault.on("rename", async (file: TAbstractFile, oldPath: string) => {
          debugLog("on rename event - new path and old path:", file.path, oldPath);

          const { setting } = getRenameOverrideSetting(this.settings, file, oldPath);
          // update the override setting
          debugLog("rename - using settings:", setting);
          if (setting.type === SETTINGS_TYPES.FOLDER || setting.type === SETTINGS_TYPES.FILE) {
            updateOverrideSetting(this.settings, file, oldPath);
            this.saveSettings();
          }
          debugLog("rename - updated settings:", setting);

          // Reason: AI name migration is internal metadata maintenance — it must
          // run regardless of autoRenameAttachment, otherwise renaming a note while
          // the toggle is off would orphan aiNameStorage records.
          if (file instanceof TFile && this.settings.aiNameStorage?.length > 0) {
            migrateAiNamePath(this.settings.aiNameStorage, oldPath, file.path);
            await this.saveSettings();
          }

          if (!this.settings.autoRenameAttachment) {
            debugLog("rename - auto rename not enabled:", this.settings.autoRenameAttachment);
            return;
          }

          if (file instanceof TFile) {
            if (file.parent && isExcluded(file.parent.path, this.settings)) {
              debugLog("rename - exclude path:", file.parent.path);
              new Notice(t("notices.fileExcluded", { path: file.path }));
              return;
            }

            // ignore attachment
            if (isAttachment(this.settings, file)) {
              debugLog("rename - not processing rename on attachment:", file.path);
              return;
            }

            await new ArrangeHandler(this.settings, this.app, this).rearrangeAttachment(
              RearrangeType.FILE,
              file,
              oldPath
            );

            const oldMetadata = getMetadata(oldPath);
            // if the user have used the ${date} in `Attachment path` this could be not working, since the date will be change.
            const oldAttachPath = oldMetadata.getAttachmentPath(setting, this.settings.dateFormat);
            this.app.vault.adapter.exists(oldAttachPath, true).then((exists) => {
              if (exists) {
                // check and remove the old attachment folder if it is empty
                checkEmptyFolder(this.app.vault.adapter, oldAttachPath).then((empty) => {
                  if (empty) {
                    this.app.vault.adapter.rmdir(oldAttachPath, true);
                  }
                });
              }
            });
          } else if (file instanceof TFolder) {
            // ignore rename event of folder
            return;
          }
        })
      );

      this.registerEvent(
        this.app.vault.on("delete", async (file: TAbstractFile) => {
          debugLog("on delete event - file path:", file.path);

          if ((file.parent && isExcluded(file.parent.path, this.settings)) || isAttachment(this.settings, file)) {
            debugLog("delete - exclude path or the file is an attachment:", file.path);
            return;
          }

          if (file instanceof TFile) {
            const oldMetadata = getMetadata(file.path);
            const { setting } = getOverrideSetting(this.settings, file);
            const oldAttachPath = oldMetadata.getAttachmentPath(setting, this.settings.dateFormat);
            this.app.vault.adapter.exists(oldAttachPath, true).then((exists) => {
              if (exists) {
                // check and remove the old attachment folder if it is empty
                checkEmptyFolder(this.app.vault.adapter, oldAttachPath).then((empty) => {
                  if (empty) {
                    this.app.vault.adapter.rmdir(oldAttachPath, true);
                  }
                });
              }
            });
          }

          // Clean up AI name records for deleted notes
          let needsSave = false;
          if (file instanceof TFile && this.settings.aiNameStorage?.length > 0) {
            const before = this.settings.aiNameStorage.length;
            this.settings.aiNameStorage = this.settings.aiNameStorage.filter(
              (r) => r.sourcePath !== file.path
            );
            if (this.settings.aiNameStorage.length < before) {
              debugLog("delete - cleaned", before - this.settings.aiNameStorage.length, "AI name records for", file.path);
              needsSave = true;
            }
          }

          if (deleteOverrideSetting(this.settings, file)) {
            needsSave = true;
            new Notice("Removed override setting of " + file.path);
          }

          if (needsSave) {
            await this.saveSettings();
          }
        })
      );

      // This adds a settings tab so the user can configure various aspects of the plugin
      this.addSettingTab(new AttachmentManagementSettingTab(this.app, this));
    });
  }

  async overrideConfiguration(file: TAbstractFile, setting: AttachmentPathSettings) {
    new OverrideModal(this, file, setting).open();
  }

  /**
   * Initializes and registers the plugin's commands
   * This method is responsible for setting up the user interface by adding various commands.
   * These commands include settings overrides, resetting settings, clearing unused original name storage,
   * and rearranging attachments.
   *
   * Note: The actual implementation of each command is not included in this method and needs to be
   * defined separately asynchronously.
   *
   * Warning: Make sure you have checked for errors while implementing the functionality of each command.
   */
  initCommands() {
    this.addCommand({
      id: "attachment-management-rearrange-all-links",
      name: t("commands.rearrangeAllLinks"),
      callback: async () => {
        new ConfirmModal(this).open();
      },
    });

    this.addCommand({
      id: "attachment-management-rearrange-active-links",
      name: t("commands.rearrangeActiveLinks"),
      callback: async () => {
        new ArrangeHandler(this.settings, this.app, this).rearrangeAttachment(RearrangeType.ACTIVE).finally(() => {
          new Notice(t("notifications.arrangeCompleted"));
        });
      },
    });

    this.addCommand({
      id: "attachment-management-override-setting",
      name: "Overriding setting",
      checkCallback: (checking: boolean) => {
        const file = getActiveFile(this.app);

        if (file) {
          if (isAttachment(this.settings, file)) {
            return true;
          }

          if (!checking) {
            if (file.parent && isExcluded(file.parent.path, this.settings)) {
              new Notice(`${file.path} was excluded`);
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
      id: "attachment-management-reset-override-setting",
      name: t("commands.resetOverrideSetting"),
      checkCallback: (checking: boolean) => {
        const file = getActiveFile(this.app);
        if (file) {
          if (isAttachment(this.settings, file)) {
            return true;
          }

          if (!checking) {
            if (file.parent && isExcluded(file.parent.path, this.settings)) {
              new Notice(`${file.path} was excluded`);
              return true;
            }
            delete this.settings.overridePath[file.path];
            this.saveSettings().finally(() => {
              new Notice(t("notifications.resetAttachmentSetting", { path: file.path }));
            });
          }
          return true;
        }
        return false;
      },
    });

    this.addCommand({
      id: "attachment-management-clear-unused-originalname-storage",
      name: t("commands.clearUnusedStorage"),
      callback: async () => {
        const attachments = await new ArrangeHandler(this.settings, this.app, this).getAttachmentsInVault(
          this.settings,
          RearrangeType.LINKS
        );
        const storages: OriginalNameStorage[] = [];
        for (const attachs of Object.values(attachments)) {
          for (const attach of attachs) {
            const link = decodeURI(attach);
            const linkFile = this.app.vault.getAbstractFileByPath(link);
            if (linkFile !== null && linkFile instanceof TFile) {
              md5sum(this.app.vault.adapter, linkFile).then((md5) => {
                const ret = this.settings.originalNameStorage.find((data) => data.md5 === md5);
                if (ret) {
                  storages.filter((n) => n.md5 == md5).forEach((n) => storages.remove(n));
                  storages.push(ret);
                }
              });
            }
          }
        }
        debugLog("clearUnusedOriginalNameStorage - storage:", storages);
        this.settings.originalNameStorage = storages;
        this.saveSettings();
      },
    });
  }

  async loadSettings() {
    const savedData = await this.loadData();
    this.settings = Object.assign({}, DEFAULT_SETTINGS, savedData);
    // Reason: Object.assign does shallow merge, so nested objects like aiRename
    // would lose default values for newly added fields. Deep merge them explicitly.
    if (savedData?.aiRename) {
      this.settings.aiRename = Object.assign(
        {},
        DEFAULT_AI_RENAME_SETTINGS,
        savedData.aiRename
      );
    }
    if (!this.settings.aiNameStorage) {
      this.settings.aiNameStorage = [];
    }
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }

  async onunload() {
    console.log("unloading attachment management.");
    // Clear the queue of created file.
    this.createdQueue = [];
  }
}
