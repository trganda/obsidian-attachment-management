import { App, PluginSettingTab, Setting } from "obsidian";
import AttachmentManagementPlugin from "../main";
import {
  SETTINGS_ROOT_OBSFOLDER,
  SETTINGS_VARIABLES_NOTEPATH,
  SETTINGS_VARIABLES_NOTENAME,
  SETTINGS_VARIABLES_NOTEPARENT,
  SETTINGS_VARIABLES_DATES,
  SETTINGS_ROOT_INFOLDER,
  SETTINGS_ROOT_NEXTTONOTE, SETTINGS_VARIABLES_ORIGINALNAME
} from "../lib/constant";
import { debugLog } from "src/log";

export enum SETTINGS_TYPES {
  GLOBAL = "GLOBAL",
  FOLDER = "FOLDER",
  FILE = "FILE",
}

export interface AttachmentPathSettings {
  // Attachment root path
  attachmentRoot: string;
  // How to save attachment, in fixed folder, current folder or subfolder in current folder
  saveAttE: string;
  // Attachment path
  attachmentPath: string;
  // How to renamed the image file
  attachFormat: string;
  // Override type
  type: SETTINGS_TYPES;
}

export interface AttachmentManagementPluginSettings {
  // Path
  attachPath: AttachmentPathSettings;
  // Date format
  dateFormat: string;
  // Handle all file
  handleAll: boolean;
  // Exclude extension not to rename (work if enabled handleAll)
  excludeExtensionPattern: string;
  // Auto-rename attachment folder or filename and update the link
  autoRenameAttachment: boolean;
  // Auto-rename duplicate file
  autoDuplicate: boolean;
  // Path of notes that override global configuration
  overridePath: Record<string, AttachmentPathSettings>;
}

export const DEFAULT_SETTINGS: AttachmentManagementPluginSettings = {
  attachPath: {
    attachmentRoot: "",
    saveAttE: `${SETTINGS_ROOT_OBSFOLDER}`,
    attachmentPath: `${SETTINGS_VARIABLES_NOTEPATH}/${SETTINGS_VARIABLES_NOTENAME}`,
    attachFormat: `IMG-${SETTINGS_VARIABLES_DATES}`,
    type: SETTINGS_TYPES.GLOBAL,
  },
  dateFormat: "YYYYMMDDHHmmssSSS",
  handleAll: false,
  excludeExtensionPattern: "",
  autoRenameAttachment: true,
  autoDuplicate: false,
  overridePath: {},
};

export class SettingTab extends PluginSettingTab {
  plugin: AttachmentManagementPlugin;

  constructor(app: App, plugin: AttachmentManagementPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  displaySw(cont: HTMLElement): void {
    cont.findAll(".setting-item").forEach((el: HTMLElement) => {
      if (el.getAttr("class")?.includes("root_folder_set")) {
        if (this.plugin.settings.attachPath.saveAttE === "obsFolder") {
          el.hide();
        } else {
          el.show();
        }
      }
      if (el.getAttr("class")?.includes("exclude_extension_pattern")) {
        if (!this.plugin.settings.handleAll) {
          el.hide();
        } else {
          el.show();
        }
      }
    });
  }

  display(): void {
    const { containerEl } = this;

    containerEl.empty();

    containerEl.createEl("h2", {
      text: "Settings for Attachment Management.",
    });

    new Setting(containerEl)
      .setName("Root path to save new attachments")
      .setDesc("Select root path for all new attachments")
      .addDropdown((text) =>
        text
          .addOption(`${SETTINGS_ROOT_OBSFOLDER}`, "Copy Obsidian settings")
          .addOption(`${SETTINGS_ROOT_INFOLDER}`, "In the folder specified below")
          .addOption(`${SETTINGS_ROOT_NEXTTONOTE}`, "Next to note in folder specified below")
          .setValue(this.plugin.settings.attachPath.saveAttE)
          .onChange(async (value) => {
            this.plugin.settings.attachPath.saveAttE = value;
            this.displaySw(containerEl);
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Root folder")
      .setDesc("Root folder of new attachment")
      .setClass("root_folder_set")
      .addText((text) =>
        text
          .setPlaceholder(DEFAULT_SETTINGS.attachPath.attachmentRoot)
          .setValue(this.plugin.settings.attachPath.attachmentRoot)
          .onChange(async (value) => {
            debugLog("setting - attachment root:" + value);
            this.plugin.settings.attachPath.attachmentRoot = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Attachment path")
      .setDesc(
        `Path of new attachment in root folder, available variables ${SETTINGS_VARIABLES_NOTEPATH}, ${SETTINGS_VARIABLES_NOTENAME}, ${SETTINGS_VARIABLES_NOTEPARENT}`
      )
      .addText((text) =>
        text
          .setPlaceholder(DEFAULT_SETTINGS.attachPath.attachmentPath)
          .setValue(this.plugin.settings.attachPath.attachmentPath)
          .onChange(async (value) => {
            debugLog("setting - attachment path:" + value);
            this.plugin.settings.attachPath.attachmentPath = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Attachment format")
      .setDesc(
        `Define how to name the attachment file, available variables ${SETTINGS_VARIABLES_DATES}, ${SETTINGS_VARIABLES_NOTENAME} and ${SETTINGS_VARIABLES_ORIGINALNAME}.`
      )
      .addText((text) =>
        text
          .setPlaceholder(DEFAULT_SETTINGS.attachPath.attachFormat)
          .setValue(this.plugin.settings.attachPath.attachFormat)
          .onChange(async (value: string) => {
            debugLog("setting - attachment format:" + value);
            this.plugin.settings.attachPath.attachFormat = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Date format")
      .setDesc(
        createFragment((frag) => {
          frag.appendText("Moment date format to use ");
          frag.createEl("a", {
            href: "https://momentjscom.readthedocs.io/en/latest/moment/04-displaying/01-format",
            text: "Moment format options",
          });
        })
      )
      .addText((text) =>
        text
          .setPlaceholder(DEFAULT_SETTINGS.dateFormat)
          .setValue(this.plugin.settings.dateFormat)
          .onChange(async (value) => {
            debugLog("setting - date format:" + value);
            this.plugin.settings.dateFormat = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Handle all attachments")
      .setDesc(
        "By default, only auto-rename the image file, if enable this option, all created file (except `md` or `canvas`) will be renamed automatically"
      )
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.handleAll).onChange(async (value) => {
          debugLog("setting - handle all attachment:" + value);
          this.plugin.settings.handleAll = value;
          this.displaySw(containerEl);
          await this.plugin.saveSettings();
        })
      );

    new Setting(containerEl)
      .setName("Exclude extension pattern")
      .setDesc(
        `This option is only useful when "Handle all attachments" is enabled.	Write a Regex pattern to exclude certain extensions from being handled.`
      )
      .setClass("exclude_extension_pattern")
      .addText((text) =>
        text
          .setPlaceholder("pdf|docx?|xlsx?|pptx?|zip|rar")
          .setValue(this.plugin.settings.excludeExtensionPattern)
          .onChange(async (value) => {
            this.plugin.settings.excludeExtensionPattern = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Automatically rename attachment")
      .setDesc(
        "Automatically rename the attachment folder/filename when you rename the folder/filename where the corresponding md/canvas file be placed."
      )
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.autoRenameAttachment).onChange(async (value) => {
          debugLog("setting - automatically rename attachment folder:" + value);
          this.plugin.settings.autoRenameAttachment = value;
          await this.plugin.saveSettings();
        })
      );

    // new Setting(containerEl)
    // 	.setName("Automatically add duplicate number for same name folder or file")
    // 	.setDesc(
    // 		`When automatically rename was enabled, add duplicate number for same name folder or file.`
    // 	)
    // 	.addToggle((toggle) =>
    // 		toggle
    // 			.setValue(this.plugin.settings.autoDuplicate)
    // 			.onChange(async (value: boolean) => {
    // 				this.plugin.settings.autoDuplicate = value;
    // 				await this.plugin.saveSettings();
    // 			})
    // 	);

    this.displaySw(containerEl);
  }
}
