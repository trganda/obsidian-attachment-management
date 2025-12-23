import { App, MomentFormatComponent, Notice, PluginSettingTab, Setting, TextAreaComponent } from "obsidian";
import AttachmentManagementPlugin from "../main";
import {
  SETTINGS_ROOT_OBSFOLDER,
  SETTINGS_VARIABLES_NOTEPATH,
  SETTINGS_VARIABLES_NOTENAME,
  SETTINGS_VARIABLES_DATES,
  SETTINGS_ROOT_INFOLDER,
  SETTINGS_ROOT_NEXTTONOTE,
} from "../lib/constant";
import { OverrideExtensionModal } from "../model/extensionOverride";
import { validateExtensionEntry, generateErrorExtensionMessage } from "../utils";
import { debugLog } from "../lib/log";
import { t } from "../i18n/index";

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
  // How to renamed the attachment file
  attachFormat: string;
  // Override type
  type: SETTINGS_TYPES;
  // Extension override
  extensionOverride?: ExtensionOverrideSettings[];
}

export interface OriginalNameStorage {
  // Original name
  n: string;
  // Current name
  md5: string;
}

export interface ExtensionOverrideSettings {
  // Extension
  extension: string;
  // Attachment root path
  attachmentRoot: string;
  // How to save attachment, in fixed folder, current folder or subfolder in current folder
  saveAttE: string;
  // Attachment path
  attachmentPath: string;
  // How to renamed the attachment file
  attachFormat: string;
}

export interface AttachmentManagementPluginSettings {
  // Disable notification
  disableNotification: boolean;
  // Path
  attachPath: AttachmentPathSettings;
  // Date format
  dateFormat: string;
  // Exclude extension not to rename
  excludeExtensionPattern: string;
  // Auto-rename attachment folder or filename and update the link
  autoRenameAttachment: boolean;
  // Exclude path not to rename
  excludedPaths: string;
  // Exclude path array
  excludePathsArray: string[];
  // Exclude subpath also
  excludeSubpaths: boolean;
  // Presistence storage of original name
  originalNameStorage: OriginalNameStorage[];
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
  excludeExtensionPattern: "",
  autoRenameAttachment: true,
  excludedPaths: "",
  excludePathsArray: [],
  excludeSubpaths: false,
  originalNameStorage: [],
  overridePath: {},
  disableNotification: false,
};

export class AttachmentManagementSettingTab extends PluginSettingTab {
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
    });
  }

  splitPath(path: string): { splittedPaths: string[] } {
    const splitted = path.split(";");
    const rets = [];
    for (const s of splitted) {
      rets.push(s.trim());
    }
    return { splittedPaths: rets };
  }

  display(): void {
    const { containerEl } = this;

    containerEl.empty();

    containerEl.createEl("h2", { text: t("settings.title") });

    // new Setting(containerEl).setName("Disable notification").addToggle((toggle) => {
    //     toggle.setValue(this.plugin.settings.disableNotification).onChange(async (value) => {
    //         this.plugin.settings.disableNotification = value;
    //         await this.plugin.saveSettings();
    //     });
    // });

    new Setting(containerEl)
      .setName(t("settings.rootPath.name"))
      .setDesc(t("settings.rootPath.desc"))
      .addDropdown((text) =>
        text
          .addOption(`${SETTINGS_ROOT_OBSFOLDER}`, t("settings.rootPath.options.obsidian"))
          .addOption(`${SETTINGS_ROOT_INFOLDER}`, t("settings.rootPath.options.inFolder"))
          .addOption(`${SETTINGS_ROOT_NEXTTONOTE}`, t("settings.rootPath.options.nextToNote"))
          .setValue(this.plugin.settings.attachPath.saveAttE)
          .onChange(async (value) => {
            this.plugin.settings.attachPath.saveAttE = value;
            this.displaySw(containerEl);
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName(t("settings.rootFolder.name"))
      .setDesc(t("settings.rootFolder.desc"))
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
      .setName(t("settings.attachmentPath.name"))
      .setDesc(t("settings.attachmentPath.desc"))
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
      .setName(t("settings.attachmentFormat.name"))
      .setDesc(t("settings.attachmentFormat.desc"))
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
      .setName(t("settings.dateFormat.name"))
      .setDesc(
        createFragment((frag) => {
          frag.appendText(t("settings.dateFormat.desc") + " ");
          frag.createEl("a", {
            href: "https://momentjscom.readthedocs.io/en/latest/moment/04-displaying/01-format",
            text: t("settings.dateFormat.linkText"),
          });
        })
      )
      .addMomentFormat((component: MomentFormatComponent) => {
        component
          .setPlaceholder(DEFAULT_SETTINGS.dateFormat)
          .setValue(this.plugin.settings.dateFormat)
          .onChange(async (value) => {
            debugLog("setting - date format:" + value);
            this.plugin.settings.dateFormat = value;
            await this.plugin.saveSettings();
          });
      });

    new Setting(containerEl)
      .setName(t("settings.autoRename.name"))
      .setDesc(t("settings.autoRename.desc"))
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.autoRenameAttachment).onChange(async (value) => {
          debugLog("setting - automatically rename attachment folder:" + value);
          this.plugin.settings.autoRenameAttachment = value;
          await this.plugin.saveSettings();
        })
      );

    new Setting(containerEl)
      .setName(t("settings.extensionOverride.name"))
      .setDesc(t("settings.extensionOverride.desc"))
      .addButton((btn) => {
      btn.setButtonText(t("settings.extensionOverride.addButton")).onClick(async () => {
        if (this.plugin.settings.attachPath.extensionOverride === undefined) {
          this.plugin.settings.attachPath.extensionOverride = [];
        }
        this.plugin.settings.attachPath.extensionOverride.push({
          extension: "",
          attachmentRoot: this.plugin.settings.attachPath.attachmentRoot,
          saveAttE: this.plugin.settings.attachPath.saveAttE,
          attachmentPath: this.plugin.settings.attachPath.attachmentPath,
          attachFormat: this.plugin.settings.attachPath.attachFormat,
        });
        await this.plugin.saveSettings();
        this.display();
      });
    });

    if (this.plugin.settings.attachPath.extensionOverride !== undefined) {
      this.plugin.settings.attachPath.extensionOverride.forEach((ext) => {
        new Setting(containerEl)
          .setName(t("settings.extensionOverride.extension.name"))
          .setDesc(t("settings.extensionOverride.extension.desc"))
          .setClass("override_extension_set")
          .addText((text) =>
            text
              .setPlaceholder(t("settings.extensionOverride.extension.placeholder"))
              .setValue(ext.extension)
              .onChange(async (value) => {
                ext.extension = value;
              })
          )
          .addButton((btn) => {
            btn
              .setIcon("trash")
              .setTooltip(t("settings.extensionOverride.tooltips.remove"))
              .onClick(async () => {
                //get index of extension
                const index = this.plugin.settings.attachPath.extensionOverride?.indexOf(ext) ?? -1;
                //remove extension from array
                this.plugin.settings.attachPath.extensionOverride?.splice(index, 1);
                await this.plugin.saveSettings();
                this.display();
              });
          })
          .addButton((btn) => {
            btn
              .setIcon("pencil")
              .setTooltip(t("settings.extensionOverride.tooltips.edit"))
              .onClick(async () => {
                new OverrideExtensionModal(this.plugin, ext, (result) => {
                  ext = result;
                }).open();
              });
          })
          .addButton((btn) => {
            btn
              .setIcon("check")
              .setTooltip(t("settings.extensionOverride.tooltips.save"))
              .onClick(async () => {
                const wrongIndex = validateExtensionEntry(this.plugin.settings.attachPath, this.plugin.settings);
                if (wrongIndex.length > 0) {
                  for (const i of wrongIndex) {
                    const resIndex = i.index < 0 ? 0 : i.index;
                    const wrongSetting = containerEl.getElementsByClassName("override_extension_set")[resIndex];
                    wrongSetting.getElementsByTagName("input")[0].style.border = "1px solid var(--color-red)";
                    generateErrorExtensionMessage(i.type);
                  }
                  return;
                }
                await this.plugin.saveSettings();
                this.display();
                new Notice(t("settings.extensionOverride.saveNotice"));
              });
          });
      });
    }

    new Setting(containerEl)
      .setName(t("settings.excludeExtension.name"))
      .setDesc(t("settings.excludeExtension.desc"))
      .addText((text) =>
        text
          .setPlaceholder(t("settings.excludeExtension.placeholder"))
          .setValue(this.plugin.settings.excludeExtensionPattern)
          .onChange(async (value) => {
            this.plugin.settings.excludeExtensionPattern = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName(t("settings.excludedPaths.name"))
      .setDesc(t("settings.excludedPaths.desc"))
      .addTextArea((component: TextAreaComponent) => {
        component.setValue(this.plugin.settings.excludedPaths).onChange(async (value) => {
          this.plugin.settings.excludedPaths = value;
          const { splittedPaths } = this.splitPath(value);
          this.plugin.settings.excludePathsArray = splittedPaths;
          debugLog("setting - excluded paths:" + value, splittedPaths);
          await this.plugin.saveSettings();
        });
      });

    new Setting(containerEl)
      .setName(t("settings.excludeSubpaths.name"))
      .setDesc(t("settings.excludeSubpaths.desc"))
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.excludeSubpaths).onChange(async (value) => {
          debugLog("setting - excluded subpaths:" + value);
          this.plugin.settings.excludeSubpaths = value;
          await this.plugin.saveSettings();
        })
      );

    this.displaySw(containerEl);
  }
}
