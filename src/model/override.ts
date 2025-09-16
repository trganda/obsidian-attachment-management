import { Modal, TFile, TAbstractFile, Setting, TFolder, Notice } from "obsidian";
import { AttachmentPathSettings, DEFAULT_SETTINGS, SETTINGS_TYPES } from "../settings/settings";
import {
  SETTINGS_ROOT_OBSFOLDER,
  SETTINGS_ROOT_INFOLDER,
  SETTINGS_ROOT_NEXTTONOTE,
} from "../lib/constant";
import AttachmentManagementPlugin from "../main";
import { OverrideExtensionModal } from "./extensionOverride";
import { debugLog } from "src/lib/log";
import { t } from "../i18n/index";

export class OverrideModal extends Modal {
  plugin: AttachmentManagementPlugin;
  file: TAbstractFile;
  setting: AttachmentPathSettings;

  constructor(plugin: AttachmentManagementPlugin, file: TAbstractFile, setting: AttachmentPathSettings) {
    super(plugin.app);
    this.plugin = plugin;
    this.file = file;
    this.setting = setting;
  }

  displaySw(cont: HTMLElement): void {
    cont.findAll(".setting-item").forEach((el: HTMLElement) => {
      if (el.getAttr("class")?.includes("override_root_folder_set")) {
        if (this.setting.saveAttE === "obsFolder") {
          el.hide();
        } else {
          el.show();
        }
      }
    });
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();

    contentEl.createEl("h3", {
      text: t('override.title'),
    });

    new Setting(contentEl)
      .setName(t('settings.rootPath.name'))
      .setDesc(t('settings.rootPath.desc'))
      .addDropdown((text) =>
        text
          .addOption(`${SETTINGS_ROOT_OBSFOLDER}`, t('settings.rootPath.options.obsidian'))
          .addOption(`${SETTINGS_ROOT_INFOLDER}`, t('settings.rootPath.options.inFolder'))
          .addOption(`${SETTINGS_ROOT_NEXTTONOTE}`, t('settings.rootPath.options.nextToNote'))
          .setValue(this.setting.saveAttE)
          .onChange(async (value) => {
            this.setting.saveAttE = value;
            this.displaySw(contentEl);
          })
      );

    new Setting(contentEl)
      .setName(t('settings.rootFolder.name'))
      .setClass("override_root_folder_set")
      .addText((text) =>
        text
          .setPlaceholder(DEFAULT_SETTINGS.attachPath.attachmentRoot)
          .setValue(this.setting.attachmentRoot)
          .onChange(async (value) => {
            debugLog("override - attachment root:" + value);
            this.setting.attachmentRoot = value;
          })
      );

    new Setting(contentEl)
      .setName(t('settings.attachmentPath.name'))
      .setDesc(t('settings.attachmentPath.desc'))
      .addText((text) =>
        text
          .setPlaceholder(DEFAULT_SETTINGS.attachPath.attachmentPath)
          .setValue(this.setting.attachmentPath)
          .onChange(async (value) => {
            debugLog("override - attachment path:" + value);
            this.setting.attachmentPath = value;
          })
      );

    new Setting(contentEl)
      .setName(t('settings.attachmentFormat.name'))
      .setDesc(t('settings.attachmentFormat.desc'))
      .addText((text) =>
        text
          .setPlaceholder(DEFAULT_SETTINGS.attachPath.attachFormat)
          .setValue(this.setting.attachFormat)
          .onChange(async (value: string) => {
            debugLog("override - attachment format:" + value);
            this.setting.attachFormat = value;
          })
      );

    new Setting(contentEl).addButton((btn) => {
      btn.setButtonText(t('override.addExtensionOverrides')).onClick(async () => {
        if (this.setting.extensionOverride === undefined) {
          this.setting.extensionOverride = [];
        }
        this.setting.extensionOverride.push({
          extension: "",
          saveAttE: this.setting.saveAttE,
          attachmentRoot: this.setting.attachmentRoot,
          attachmentPath: this.setting.attachmentPath,
          attachFormat: this.setting.attachFormat,
        });
        this.onOpen();
      });
    });

    if (this.setting.extensionOverride !== undefined) {
      this.setting.extensionOverride.forEach((ext) => {
        new Setting(contentEl)
          .setName(t('override.extension.name'))
          .setDesc(t('override.extension.desc'))
          .setClass("override_extension_set")
          .addText((text) =>
            text
              .setPlaceholder(t('override.extension.placeholder'))
              .setValue(ext.extension)
              .onChange(async (value) => {
                ext.extension = value;
              })
          )
          .addButton((btn) => {
            btn.setIcon("trash").onClick(async () => {
              //get index of extension
              const index = this.setting.extensionOverride?.indexOf(ext) ?? -1;
              //remove extension from array
              this.setting.extensionOverride?.splice(index, 1);
              this.onOpen();
            });
          })
          .addButton((btn) => {
            btn.setIcon("pencil").onClick(async () => {
              new OverrideExtensionModal(this.plugin, ext, (result) => {
                ext = result;
              }).open();
            });
          });
      });
    }

    new Setting(contentEl)
      .addButton((btn) => {
        btn.setButtonText(t('override.buttons.reset')).onClick(async () => {
          this.setting = this.plugin.settings.attachPath;
          delete this.plugin.settings.overridePath[this.file.path];
          await this.plugin.saveSettings();
          await this.plugin.loadSettings();
          new Notice(t('override.notifications.reset', { path: this.file.path }));
          this.close();
        });
      })
      .addButton((btn) =>
        btn
          .setButtonText(t('override.buttons.submit'))
          .setCta()
          .onClick(async () => {
            if (this.file instanceof TFile) {
              this.setting.type = SETTINGS_TYPES.FILE;
            } else if (this.file instanceof TFolder) {
              this.setting.type = SETTINGS_TYPES.FOLDER;
            }
            this.plugin.settings.overridePath[this.file.path] = this.setting;
            await this.plugin.saveSettings();
            debugLog("override - overriding settings:", this.file.path, this.setting);
            new Notice(t('override.notifications.overridden', { path: this.file.path }));
            this.close();
          })
      );

    this.displaySw(contentEl);
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
}
