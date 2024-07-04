import { Modal, Setting } from "obsidian";

import {
  SETTINGS_ROOT_INFOLDER,
  SETTINGS_ROOT_NEXTTONOTE,
  SETTINGS_ROOT_OBSFOLDER,
  SETTINGS_VARIABLES_DATES,
  SETTINGS_VARIABLES_MD5,
  SETTINGS_VARIABLES_NOTENAME,
  SETTINGS_VARIABLES_NOTEPARENT,
  SETTINGS_VARIABLES_NOTEPATH,
  SETTINGS_VARIABLES_ORIGINALNAME,
} from "../lib/constant";
import AttachmentManagementPlugin from "../main";
import { AttachmentPathSettings, DEFAULT_SETTINGS, ExtensionOverrideSettings } from "../settings/settings";
import { matchExtension } from "src/utils";
import { debugLog } from "src/lib/log";

/**
 * Retrieves the override setting for a specific extension.
 *
 * @param {string} extension - The extension to retrieve the override setting for.
 * @param {AttachmentPathSettings} settings - The attachment path settings object.
 * @return {{ extSetting: ExtensionOverrideSettings | undefined }} - The override setting for the extension.
 */
export function getExtensionOverrideSetting(
  extension: string,
  settings: AttachmentPathSettings
): { extSetting: ExtensionOverrideSettings | undefined } {
  if (settings.extensionOverride === undefined || settings.extensionOverride.length === 0) {
    return { extSetting: undefined };
  }

  for (let i = 0; i < settings.extensionOverride.length; i++) {
    if (matchExtension(extension, settings.extensionOverride[i].extension)) {
      debugLog(
        "getExtensionOverrideSetting - ",
        settings.extensionOverride[i].extension,
        settings.extensionOverride[i]
      );
      return { extSetting: settings.extensionOverride[i] };
    }
  }

  return { extSetting: undefined };
}

export class OverrideExtensionModal extends Modal {
  plugin: AttachmentManagementPlugin;
  settings: ExtensionOverrideSettings;
  onSubmit: (result: ExtensionOverrideSettings) => void;

  constructor(
    plugin: AttachmentManagementPlugin,
    settings: ExtensionOverrideSettings,
    onSubmit: (result: ExtensionOverrideSettings) => void
  ) {
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
      .setName("Root path to save attachment")
      .setDesc("Select root path of attachment")
      .addDropdown((text) =>
        text
          .addOption(`${SETTINGS_ROOT_OBSFOLDER}`, "Copy Obsidian settings")
          .addOption(`${SETTINGS_ROOT_INFOLDER}`, "In the folder specified below")
          .addOption(`${SETTINGS_ROOT_NEXTTONOTE}`, "Next to note in folder specified below")
          .setValue(this.settings.saveAttE)
          .onChange(async (value) => {
            this.settings.saveAttE = value;
            this.displaySw(contentEl);
            this.onOpen();
          })
      );
    if (this.settings.saveAttE !== "obsFolder") {
      new Setting(contentEl)
        .setName("Root folder")
        .setClass("override_root_folder_set")
        .addText((text) =>
          text
            .setPlaceholder(DEFAULT_SETTINGS.attachPath.attachmentRoot)
            .setValue(this.settings.attachmentRoot)
            .onChange(async (value) => {
              this.settings.attachmentRoot = value;
            })
        );
    }
    new Setting(contentEl)
      .setName("Attachment path")
      .setDesc(
        `Path of attachment in root folder, available variables ${SETTINGS_VARIABLES_NOTEPATH}, ${SETTINGS_VARIABLES_NOTENAME} and ${SETTINGS_VARIABLES_NOTEPARENT}`
      )
      .addText((text) =>
        text
          .setPlaceholder(DEFAULT_SETTINGS.attachPath.attachmentPath)
          .setValue(this.settings.attachmentPath)
          .onChange(async (value) => {
            this.settings.attachmentPath = value;
          })
      );

    new Setting(contentEl)
      .setName("Attachment format")
      .setDesc(
        `Define how to name the attachment file, available variables ${SETTINGS_VARIABLES_DATES}, ${SETTINGS_VARIABLES_NOTENAME}, ${SETTINGS_VARIABLES_MD5} and ${SETTINGS_VARIABLES_ORIGINALNAME}.`
      )
      .addText((text) =>
        text
          .setPlaceholder(DEFAULT_SETTINGS.attachPath.attachFormat)
          .setValue(this.settings.attachFormat)
          .onChange(async (value: string) => {
            this.settings.attachFormat = value;
          })
      );

    new Setting(contentEl).addButton((button) =>
      button.setButtonText("Save").onClick(async () => {
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
