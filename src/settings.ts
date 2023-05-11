import { App, PluginSettingTab, Setting } from "obsidian";
import AttachmentManagementPlugin from "./main";
import {
  SETTINGS_ROOT_OBSFOLDER,
  SETTINGS_VARIABLES_NOTEPATH,
  SETTINGS_VARIABLES_NOTENAME,
  SETTINGS_VARIABLES_DATES,
  SETTINGS_ROOT_INFOLDER,
  SETTINGS_ROOT_NEXTTONOTE,
} from "./constant";

export interface AttachmentManagementPluginSettings {
  // Attachment root path
  attachmentRoot: string;
  // How to save attachment, in fixd folder, current folder or subfolder in current folder
  saveAttE: string;
  // Attachment path
  attachmentPath: string;
  // How to renamed the image file
  attachFormat: string;
  // Date format
  dateFormat: string;
  // Handle all file
  handleAll: boolean;
  // Exclude extension not to rename (work if enabled handleAll)
  excludeExtensionPattern: string;
  // Auto-rename attachment folder or filename and update the link
  autoRenameAttachment: boolean;
  // Auto-rename droped file
  autoDuplicate: boolean;
}

export const DEFAULT_SETTINGS: AttachmentManagementPluginSettings = {
  attachmentRoot: "",
  saveAttE: `${SETTINGS_ROOT_OBSFOLDER}`,
  attachmentPath: `${SETTINGS_VARIABLES_NOTEPATH}/${SETTINGS_VARIABLES_NOTENAME}`,
  attachFormat: `IMG-${SETTINGS_VARIABLES_DATES}`,
  dateFormat: "YYYYMMDDHHmmssSSS",
  handleAll: false,
  excludeExtensionPattern: "",
  autoRenameAttachment: true,
  autoDuplicate: false,
};

export class SettingTab extends PluginSettingTab {
  plugin: AttachmentManagementPlugin;

  constructor(app: App, plugin: AttachmentManagementPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  displSw(cont: HTMLElement): void {
    cont.findAll(".setting-item").forEach((el: HTMLElement) => {
      if (el.getAttr("class")?.includes("root_folder_set")) {
        if (this.plugin.settings.saveAttE === "obsFolder") {
          el.hide();
        } else {
          el.show();
        }
      }
      if (el.getAttr("class")?.includes("exclude_extension_pattern")) {
        if (this.plugin.settings.handleAll === false) {
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
      .setName("Root path to save new attachements")
      .setDesc("Select root path for all new attachements")
      .addDropdown((text) =>
        text
          .addOption(`${SETTINGS_ROOT_OBSFOLDER}`, "Copy Obsidian settings")
          .addOption(`${SETTINGS_ROOT_INFOLDER}`, "In the folder specified below")
          .addOption(`${SETTINGS_ROOT_NEXTTONOTE}`, "Next to note in folder specified below")
          .setValue(this.plugin.settings.saveAttE)
          .onChange(async (value) => {
            this.plugin.settings.saveAttE = value;
            this.displSw(containerEl);
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Root folder")
      .setDesc("Root folder of new attachment")
      .setClass("root_folder_set")
      .addText((text) =>
        text
          .setPlaceholder(DEFAULT_SETTINGS.attachmentRoot)
          .setValue(this.plugin.settings.attachmentRoot)
          .onChange(async (value) => {
            console.log("Attachment root: " + value);
            this.plugin.settings.attachmentRoot = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Attachment path")
      .setDesc(`Path of new attachment in root folder, aviliable variables ${SETTINGS_VARIABLES_NOTEPATH} and ${SETTINGS_VARIABLES_NOTENAME}`)
      .addText((text) =>
        text
          .setPlaceholder(DEFAULT_SETTINGS.attachmentPath)
          .setValue(this.plugin.settings.attachmentPath)
          .onChange(async (value) => {
            console.log("Attachment path: " + value);
            this.plugin.settings.attachmentPath = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Attachment format")
      .setDesc(`Define how to name the attachment file, aviliable variables ${SETTINGS_VARIABLES_DATES} and ${SETTINGS_VARIABLES_NOTENAME}`)
      .addText((text) =>
        text
          .setPlaceholder(DEFAULT_SETTINGS.attachFormat)
          .setValue(this.plugin.settings.attachFormat)
          .onChange(async (value) => {
            console.log("Attachment format: " + value);
            this.plugin.settings.attachFormat = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Date format")
      .setDesc(
        createFragment((frag) => {
          frag.appendText("Moment date format to use ");
          frag.createEl("a", {
            href: 'https://momentjscom.readthedocs.io/en/latest/moment/04-displaying/01-format/"',
            text: "Moment format options",
          });
        })
      )
      .addText((text) =>
        text
          .setPlaceholder(DEFAULT_SETTINGS.dateFormat)
          .setValue(this.plugin.settings.dateFormat)
          .onChange(async (value) => {
            console.log("Date format: " + value);
            this.plugin.settings.dateFormat = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Handle all attachments")
      .setDesc("By default, only auto-rename the image file, if enable this option, all created file (except `md` or `canvas`) will be renamed automatically")
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.handleAll).onChange(async (value) => {
          console.log("Handle All Create Attachment: " + value);
          this.plugin.settings.handleAll = value;
          this.displSw(containerEl);
          await this.plugin.saveSettings();
        })
      );

    new Setting(containerEl)
      .setName("Exclude extension pattern")
      .setDesc(
        `This option is only useful when "Handle all attachments" is enabled.
			Write a Regex pattern to exclude certain extensions from being handled. Only the first line will be used.`
      )
      .setClass("exclude_extension_pattern")
      .addText((text) =>
        text
          .setPlaceholder("pdf|docx?|xlsx?|pptx?|zip|rar")
          .setValue("")
          .onChange(async (value) => {
            this.plugin.settings.excludeExtensionPattern = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Automatically rename attachment")
      .setDesc("Automatically rename attachment folder/filename while rename the folder/filename of corresponding md/cavans file")
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.autoRenameAttachment).onChange(async (value) => {
          console.log("Automatically rename attachment folder: " + value);
          this.plugin.settings.autoRenameAttachment = value;
          await this.plugin.saveSettings();
        })
      );

    // new Setting(containerEl)
    // 	.setName("Automatically add duplicate number for same name folder or file")
    // 	.setDesc(
    // 		`When automatical rename was enabled, add duplicate number for same name folder or file.`
    // 	)
    // 	.addToggle((toggle) =>
    // 		toggle
    // 			.setValue(this.plugin.settings.autoDuplicate)
    // 			.onChange(async (value: boolean) => {
    // 				this.plugin.settings.autoDuplicate = value;
    // 				await this.plugin.saveSettings();
    // 			})
    // 	);

    this.displSw(containerEl);
  }
}
