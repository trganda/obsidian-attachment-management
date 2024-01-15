import { Modal, TFile, TAbstractFile, Setting, TFolder, Notice } from "obsidian";
import { AttachmentPathSettings, DEFAULT_SETTINGS, SETTINGS_TYPES } from "../settings/settings";
import {
    SETTINGS_ROOT_OBSFOLDER,
    SETTINGS_ROOT_INFOLDER,
    SETTINGS_ROOT_NEXTTONOTE,
    SETTINGS_VARIABLES_NOTEPATH,
    SETTINGS_VARIABLES_NOTENAME,
    SETTINGS_VARIABLES_DATES,
    SETTINGS_VARIABLES_NOTEPARENT,
    SETTINGS_VARIABLES_ORIGINALNAME,
    SETTINGS_VARIABLES_MD5,
} from "../lib/constant";
import AttachmentManagementPlugin from "../main";
import { OverrideExtensionModal } from "./extensionOverride";
import { debugLog } from "src/lib/log";

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
            text: "Overriding Settings",
        });

        new Setting(contentEl)
            .setName("Root path to save attachment")
            .setDesc("Select root path of attachment")
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
                        debugLog("override - attachment root:" + value);
                        this.setting.attachmentRoot = value;
                    })
            );

        new Setting(contentEl)
            .setName("Attachment path")
            .setDesc(
                `Path of attachment in root folder, available variables ${SETTINGS_VARIABLES_NOTEPATH}, ${SETTINGS_VARIABLES_NOTENAME} and ${SETTINGS_VARIABLES_NOTEPARENT}`
            )
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
            .setName("Attachment format")
            .setDesc(
                `Define how to name the attachment file, available variables ${SETTINGS_VARIABLES_DATES}, ${SETTINGS_VARIABLES_NOTENAME}, ${SETTINGS_VARIABLES_MD5} and ${SETTINGS_VARIABLES_ORIGINALNAME}.`
            )
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
            btn.setButtonText("Add extension overrides").onClick(async () => {
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
                console.log(this.setting.extensionOverride);
                this.onOpen();
            });
        });

        if (this.setting.extensionOverride !== undefined) {
            this.setting.extensionOverride.forEach((ext) => {
                new Setting(contentEl)
                    .setName("Extension")
                    .setDesc("Extension to override")
                    .setClass("override_extension_set")
                    .addText((text) =>
                        text
                            .setPlaceholder("pdf")
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
                btn.setButtonText("Reset").onClick(async () => {
                    this.setting = this.plugin.settings.attachPath;
                    delete this.plugin.settings.overridePath[this.file.path];
                    await this.plugin.saveSettings();
                    await this.plugin.loadSettings();
                    new Notice(`Reset attachment setting of ${this.file.path}`);
                    this.close();
                });
            })
            .addButton((btn) =>
                btn
                    .setButtonText("Submit")
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
                        new Notice(`Overridden attachment setting of ${this.file.path}`);
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
