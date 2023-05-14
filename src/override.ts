import { Modal, TFile, App, TAbstractFile, Setting, TFolder, Notice } from "obsidian";
import { debugLog } from "./utils";
import { AttachmentPathSettings, DEFAULT_SETTINGS, SETTINGS_TYPE_FILE, SETTINGS_TYPE_FOLDER } from "./settings";
import {
  SETTINGS_ROOT_OBSFOLDER,
  SETTINGS_ROOT_INFOLDER,
  SETTINGS_ROOT_NEXTTONOTE,
  SETTINGS_VARIABLES_NOTEPATH,
  SETTINGS_VARIABLES_NOTENAME,
  SETTINGS_VARIABLES_DATES,
} from "./constant";
import AttachmentManagementPlugin from "./main";

export class OverrideModal extends Modal {
  plugin: AttachmentManagementPlugin;
  file: TAbstractFile;
  setting: AttachmentPathSettings;

  constructor(plugin: AttachmentManagementPlugin, file: TAbstractFile, setting: AttachmentPathSettings) {
    super(plugin.app);
    this.plugin = plugin;
    this.file = file;
    debugLog(setting);
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
    let { contentEl } = this;
    contentEl.empty();

    contentEl.createEl("h3", {
      text: "Override Settings",
    });

    const rootSetting = new Setting(contentEl)
      .setName("Root path to save new attachments")
      .setDesc("Select root path for all new attachments")
      .addDropdown((text) =>
        text
          .addOption(`${SETTINGS_ROOT_OBSFOLDER}`, "Copy Obsidian settings")
          .addOption(`${SETTINGS_ROOT_INFOLDER}`, "In the folder specified below")
          .addOption(`${SETTINGS_ROOT_NEXTTONOTE}`, "Next to note in folder specified below")
          .setValue(this.setting.saveAttE)
          .onChange(async (value) => {
            this.setting.saveAttE = value;
            this.displaySw(contentEl);
          })
      );

    new Setting(contentEl)
      .setName("Root folder")
      .setClass("override_root_folder_set")
      .addText((text) =>
        text
          .setPlaceholder(DEFAULT_SETTINGS.attachPath.attachmentRoot)
          .setValue(this.setting.attachmentRoot)
          .onChange(async (value) => {
            console.log("Attachment root: " + value);
            this.setting.attachmentRoot = value;
          })
      );

    new Setting(contentEl)
      .setName("Attachment path")
      .setDesc(`Path of new attachment in root folder, available variables ${SETTINGS_VARIABLES_NOTEPATH} and ${SETTINGS_VARIABLES_NOTENAME}`)
      .addText((text) =>
        text
          .setPlaceholder(DEFAULT_SETTINGS.attachPath.attachmentPath)
          .setValue(this.setting.attachmentPath)
          .onChange(async (value) => {
            console.log("Attachment path: " + value);
            this.setting.attachmentPath = value;
          })
      );

    new Setting(contentEl)
      .setName("Attachment format")
      .setDesc(`Define how to name the attachment file, available variables ${SETTINGS_VARIABLES_DATES} and ${SETTINGS_VARIABLES_NOTENAME}`)
      .addText((text) =>
        text
          .setPlaceholder(DEFAULT_SETTINGS.attachPath.attachFormat)
          .setValue(this.setting.attachFormat)
          .onChange(async (value: string) => {
            console.log("Attachment format: " + value);
            this.setting.attachFormat = value;
          })
      );

    new Setting(contentEl)
      .addButton((btn) => {
        btn.setButtonText("Reset").onClick(() => {
          this.setting = this.plugin.settings.attachPath;
          delete this.plugin.settings.overridePath[this.file.path]
          this.plugin.saveSettings();
          this.plugin.loadSettings();
          new Notice("Reset attachment path setting");
          this.close();
        });
      })
      .addButton((btn) =>
        btn
          .setButtonText("Submit")
          .setCta()
          .onClick(() => {
            if (this.file instanceof TFile) {
              this.setting.type = SETTINGS_TYPE_FILE;
            } else if (this.file instanceof TFolder) {
              this.setting.type = SETTINGS_TYPE_FOLDER;
            }
            this.plugin.settings.overridePath[this.file.path] = this.setting;
            this.plugin.saveSettings();
            debugLog(`Override Settings, ${this.file.path}: ${this.setting}`);
            this.close();
          })
      );

    this.displaySw(contentEl);
  }

  onClose() {
    let { contentEl } = this;
    contentEl.empty();
  }
}