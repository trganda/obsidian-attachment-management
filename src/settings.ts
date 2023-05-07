import { App, PluginSettingTab, Setting } from "obsidian";
import AttachmentManagementPlugin from "./main";


export interface AttachmentManagementPluginSettings {
  attachmentRoot: string;
  saveAttE: string;
  attachmentPath: string;
  imageFormat: string;
  dateFormat: string;
  autoRenameFolder: boolean;
  autoRenameFiles: boolean;
}

export const DEFAULT_SETTINGS: AttachmentManagementPluginSettings = {
  attachmentRoot: "",
  saveAttE: "obsFolder",
  attachmentPath: '${path}/${notename}',
  imageFormat: 'IMG-${date}',
  dateFormat: 'YYYYMMDDHHmmssSSS',
  autoRenameFolder: true,
  autoRenameFiles: false,
}

export class SettingTab extends PluginSettingTab {
  plugin: AttachmentManagementPlugin;

  constructor(app: App, plugin: AttachmentManagementPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  displSw(cont: any): void {
    cont.findAll(".setting-item").forEach((el: any) => {
      if (el.getAttr("class").includes("root_folder_set")) {
        if (this.plugin.settings.saveAttE === "obsFolder") {
          el.hide();
        }
        else {
          el.show();
        }
      }
    });
  }

  display(): void {
    const { containerEl } = this;

    containerEl.empty();

    containerEl.createEl('h2', { text: 'Settings for Attachment Management.' });

    new Setting(containerEl)
      .setName("Root path to save new attachements")
      .setDesc("Select root path for all new attachements")
      .addDropdown((text) =>
        text
          .addOption("obsFolder", "Copy Obsidian settings")
          .addOption("inFolderBelow", "In the folder specified below")
          .addOption("nextToNote", "Next to note in folder specified below")
          .setValue(this.plugin.settings.saveAttE)
          .onChange(async (value) => {
            this.plugin.settings.saveAttE = value;
            this.displSw(containerEl);
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName('Root path')
      .setDesc('Path of new attachment: ${path} and ${notename}, where ${path} is the relative path of current `md/cavans` file to this vault, and ${notename} is the filename (without extension) of current `md/cavans`.')
      .setClass("root_folder_set")
      .addText(text => text
        .setPlaceholder(DEFAULT_SETTINGS.attachmentRoot)
        .setValue(this.plugin.settings.attachmentRoot)
        .onChange(async (value) => {
          console.log('Attachment root: ' + value);
          this.plugin.settings.attachmentPath = value;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName('Attachment path')
      .setDesc('Path of new attachment: ${path} and ${notename}, where ${path} is the relative path of current `md/cavans` file to this vault, and ${notename} is the filename (without extension) of current `md/cavans`.')
      .addText(text => text
        .setPlaceholder(DEFAULT_SETTINGS.attachmentPath)
        .setValue(this.plugin.settings.attachmentPath)
        .onChange(async (value) => {
          console.log('Attachment path: ' + value);
          this.plugin.settings.attachmentPath = value;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName('Image format')
      .setDesc('Define how to name the image file')
      .addText(text => text
        .setPlaceholder(DEFAULT_SETTINGS.imageFormat)
        .setValue(this.plugin.settings.imageFormat)
        .onChange(async (value) => {
          console.log('Pasted image format: ' + value);
          this.plugin.settings.imageFormat = value;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName('Date format')
      .setDesc(
        createFragment((frag) => {
          frag.appendText('Moment date format to use ');
          frag.createEl('a', {
            href: 'https://momentjscom.readthedocs.io/en/latest/moment/04-displaying/01-format/"',
            text: 'Moment format options',
          });
        }),
      )
      .addText(text => text
        .setPlaceholder(DEFAULT_SETTINGS.dateFormat)
        .setValue(this.plugin.settings.dateFormat)
        .onChange(async (value) => {
          console.log('Date format: ' + value);
          this.plugin.settings.dateFormat = value;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName('Automatically rename attachment folder')
      .setDesc('Automatically rename attachment folder while rename corresponding `md/cavans` file')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.autoRenameFolder)
        .onChange(async (value) => {
          console.log('Automatically rename attachment folder: ' + value);
          this.plugin.settings.autoRenameFolder = value;
          await this.plugin.saveSettings();
        }));


    new Setting(containerEl)
      .setName('Automatically rename attachment files')
      .setDesc('When renaming md files, automatically rename attachment files if file name contains "${notename}".')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.autoRenameFiles)
        .onChange(async (value: boolean) => {
          this.plugin.settings.autoRenameFiles = value;
          await this.plugin.saveSettings();
        }));


    this.displSw(containerEl);
  }
}
