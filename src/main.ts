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
import { initI18n, setLanguage, detectLanguage, t, SupportedLanguage } from "./i18n/index";
import { loadAllTranslations } from "./i18n/loader";
import { ConfirmModal } from "./model/confirm";
import { checkEmptyFolder, getActiveFile } from "./commons";
import { deleteOverrideSetting, getOverrideSetting, getRenameOverrideSetting, updateOverrideSetting } from "./override";
import { isAttachment, isMarkdownFile, isCanvasFile, matchExtension, md5sum } from "./utils";
import { ArrangeHandler, RearrangeType } from "./arrange";
import { CreateHandler } from "./create";
import { isExcluded } from "./exclude";
import { getMetadata } from "./settings/metadata";

export default class AttachmentManagementPlugin extends Plugin {
  settings: AttachmentManagementPluginSettings;
  createdQueue: TFile[] = [];
  originalObsAttachPath: string;

  async onload() {
    await this.loadSettings();

    // 初始化国际化系统
    loadAllTranslations();
    const savedLanguage = (this.settings.language as SupportedLanguage) || detectLanguage();
    setLanguage(savedLanguage);
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

          // if the file is modified/create more than 1 second ago, the event is most likely be fired by copy file to
          // vault folder without using obsidian or sync file from remote (e.g. file manager of op system), we should ignore it.
          const curentTime = new Date().getTime();
          const timeGapMs = curentTime - file.stat.mtime;
          const timeGapCs = curentTime - file.stat.ctime;
          // ignore markdown and canvas file.
          if (timeGapMs > 1000 || timeGapCs > 1000 || isMarkdownFile(file.extension) || isCanvasFile(file.extension)) {
            return;
          }

          if (matchExtension(file.extension, this.settings.excludeExtensionPattern)) {
            debugLog("create - excluded file by extension", file);
            return;
          }

          this.createdQueue.push(file);
        })
      );

      this.registerEvent(
        this.app.vault.on("modify", (file: TAbstractFile) => {
          debugLog("on modify event - create queue:", this.createdQueue);
          if (this.createdQueue.length < 1 || !(file instanceof TFile)) {
            return;
          }

          debugLog("on modify event - file:", file.path);
          this.app.vault.adapter.process(file.path, (pdata) => {
            // processing one file at one event loop, other files will be processed in the next event loop
            const f = this.createdQueue.first();
            if (f != undefined) {
              this.app.vault.adapter.exists(f.path, true).then((exist) => {
                if (exist) {
                  const processor = new CreateHandler(this, this.settings);
                  const link = this.app.fileManager.generateMarkdownLink(f, file.path);
                  if (
                    (file.extension == "md" && pdata.indexOf(link) != -1) ||
                    (file.extension == "canvas" && pdata.indexOf(f.path) != -1)
                  ) {
                    this.createdQueue.remove(f);
                    processor.processAttach(f, file);
                  }
                } else {
                  // remove not exists file
                  debugLog("on modify event - file does not exist:", f.path);
                  this.createdQueue.remove(f);
                }
              });
            }
            return pdata;
          });
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

          if (!this.settings.autoRenameAttachment) {
            debugLog("rename - auto rename not enabled:", this.settings.autoRenameAttachment);
            return;
          }

          if (file instanceof TFile) {
            if (file.parent && isExcluded(file.parent.path, this.settings)) {
              debugLog("rename - exclude path:", file.parent.path);
              new Notice(t("notifications.fileExcluded", { path: file.path }));
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
            const oldAttachPath = await oldMetadata.getAttachmentPath(
              setting,
              this.settings.dateFormat,
              this.app.vault.adapter
            );
            this.app.vault.adapter.exists(oldAttachPath, true).then((exists) => {
              if (exists) {
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

          if (deleteOverrideSetting(this.settings, file)) {
            await this.saveSettings();
            new Notice("Removed override setting of " + file.path);
          }

          if (file instanceof TFile) {
            const oldMetadata = getMetadata(file.path);
            const { setting } = getOverrideSetting(this.settings, file);
            const oldAttachPath = await oldMetadata.getAttachmentPath(
              setting,
              this.settings.dateFormat,
              this.app.vault.adapter
            );
            this.app.vault.adapter.exists(oldAttachPath, true).then((exists) => {
              if (exists) {
                checkEmptyFolder(this.app.vault.adapter, oldAttachPath).then((empty) => {
                  if (empty) {
                    this.app.vault.adapter.rmdir(oldAttachPath, true);
                  }
                });
              }
            });
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
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
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
