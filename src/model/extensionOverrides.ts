import { Modal, Setting } from "obsidian";
import { debugLog } from "src/log";
import {DEFAULT_SETTINGS, ExtensionOverrideSettings } from "../settings/settings";
import {
  SETTINGS_ROOT_OBSFOLDER,
  SETTINGS_ROOT_INFOLDER,
  SETTINGS_ROOT_NEXTTONOTE,
  SETTINGS_VARIABLES_NOTEPATH,
  SETTINGS_VARIABLES_NOTENAME,
  SETTINGS_VARIABLES_NOTEPARENT,
  SETTINGS_VARIABLES_DATES,
} from "../lib/constant";
import AttachmentManagementPlugin from "../main";


export class OverrideExtensionModal extends Modal {
    plugin: AttachmentManagementPlugin;
    settings: ExtensionOverrideSettings;
    onSubmit: (result: ExtensionOverrideSettings) => void;

    constructor(plugin: AttachmentManagementPlugin, settings: ExtensionOverrideSettings, onSubmit: (result: ExtensionOverrideSettings) => void) {
        super(plugin.app);
        this.plugin = plugin;
        this.settings = settings;
        this.onSubmit = onSubmit;
    }

    displaySw(cont: HTMLElement): void {
      cont.findAll(".setting-item").forEach((el: HTMLElement) => {
        if (el.getAttr("class")?.includes("override_root_folder_set")) {
          if (this.settings.saveAttE === "obsFolder") {
            el.hide();
          } else {
            el.show();
          }
        }
      });
    }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();

    contentEl.createEl("h3", {
    text: `Extension settings for ${this.settings.extension}`,
    });
  
    new Setting(contentEl)
      .setName("Root path to save new attachments")
      .setDesc("Select root path for all new attachments")
      .addDropdown((text) =>
          text
          .addOption(`${SETTINGS_ROOT_OBSFOLDER}`, "Copy Obsidian settings")
          .addOption(`${SETTINGS_ROOT_INFOLDER}`, "In the folder specified below")
          .addOption(`${SETTINGS_ROOT_NEXTTONOTE}`, "Next to note in folder specified below")
          .setValue(this.settings.saveAttE)
          .onChange(async (value) => {
              this.settings.saveAttE = value;
              this.displaySw(contentEl);
          })
      );

    new Setting(contentEl)
      .setName("Root folder")
      .setClass("override_root_folder_set")
      .addText((text) =>
          text
          .setPlaceholder(DEFAULT_SETTINGS.attachPath.attachmentRoot)
          .setValue(this.settings.attachmentRoot)
          .onChange(async (value) => {
              debugLog("override - attachment root:" + value);
              this.settings.attachmentRoot = value;
          })
      );

    new Setting(contentEl)
      .setName("Attachment path")
      .setDesc(
        `Path of new attachment in root folder, available variables ${SETTINGS_VARIABLES_NOTEPATH}, ${SETTINGS_VARIABLES_NOTENAME} and ${SETTINGS_VARIABLES_NOTEPARENT}`
      )
      .addText((text) =>
        text
          .setPlaceholder(DEFAULT_SETTINGS.attachPath.attachmentPath)
          .setValue(this.settings.attachmentPath)
          .onChange(async (value) => {
            debugLog("override - attachment path:" + value);
            this.settings.attachmentPath = value;
          })
      );

    new Setting(contentEl)
      .setName("Attachment format")
      .setDesc(
        `Define how to name the attachment file, available variables ${SETTINGS_VARIABLES_DATES} and ${SETTINGS_VARIABLES_NOTENAME}`
      )
      .addText((text) =>
        text
          .setPlaceholder(DEFAULT_SETTINGS.attachPath.attachFormat)
          .setValue(this.settings.attachFormat)
          .onChange(async (value: string) => {
              debugLog("override - attachment format:" + value);
              this.settings.attachFormat = value;
        })
      );

    new Setting(contentEl)
      .addButton((button) =>
        button
          .setButtonText("Save")
          .onClick(async () => {
              this.onSubmit(this.settings);
              this.close();
          })
      );
  }

  onClose(): void {
    const { contentEl } = this;
    contentEl.empty();
  }

}
