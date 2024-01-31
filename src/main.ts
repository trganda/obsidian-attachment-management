import { Notice, Plugin, TAbstractFile, TFile, TFolder } from "obsidian";
import {
    AttachmentManagementPluginSettings,
    AttachmentPathSettings,
    DEFAULT_SETTINGS,
    OriginalNameStorage,
    SETTINGS_TYPES,
    SettingTab,
} from "./settings/settings";
import { debugLog } from "./lib/log";
import { OverrideModal } from "./model/override";
import { ConfirmModal } from "./model/confirm";
import { checkEmptyFolder, getActiveFile } from "./commons";
import { deleteOverrideSetting, getOverrideSetting, getRenameOverrideSetting, updateOverrideSetting } from "./override";
import { isAttachment, isMarkdownFile, isCanvasFile, matchExtension, MD5 } from "./utils";
import { ArrangeHandler } from "./arrange";
import { CreateHandler } from "./create";
import { isExcluded } from "./exclude";
import { getMetadata } from "./settings/metadata";
import { path } from "./lib/path";

export default class AttachmentManagementPlugin extends Plugin {
    settings: AttachmentManagementPluginSettings;
    createdQueue: TFile[] = [];
    originalObsAttachPath: string;

    async onload() {
        await this.loadSettings();

        console.log(`Plugin loading: ${this.manifest.name} v.${this.manifest.version}`);

        this.addCommand({
            id: "attachment-management-rearrange-all-links",
            name: "Rearrange all linked attachments",
            callback: async () => {
                new ConfirmModal(this).open();
            },
        });

        this.addCommand({
            id: "attachment-management-rearrange-active-links",
            name: "Rearrange linked attachments",
            callback: async () => {
                new ArrangeHandler(this.settings, this.app, this).rearrangeAttachment("active").finally(() => {
                    new Notice("Arrange completed");
                });
            },
        });

        this.addCommand({
            id: "override-setting",
            name: "Overriding setting",
            checkCallback: (checking: boolean) => {
                const file = getActiveFile(this.app);

                if (file) {
                    if (isAttachment(this.settings, file)) {
                        new Notice(`${file.path} is an attachment, skipped`);
                        return true;
                    }

                    if (!checking) {
                        if (file.parent && isExcluded(file.parent.path, this.settings)) {
                            new Notice(`${file.path} was excluded, skipped`);
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
            id: "reset-override-setting",
            name: "Reset override setting",
            checkCallback: (checking: boolean) => {
                const file = getActiveFile(this.app);
                if (file) {
                    if (isAttachment(this.settings, file)) {
                        new Notice(`${file.path} is an attachment, skipped`);
                        return true;
                    }

                    if (!checking) {
                        if (file.parent && isExcluded(file.parent.path, this.settings)) {
                            new Notice(`${file.path} was excluded, skipped`);
                            return true;
                        }
                        delete this.settings.overridePath[file.path];
                        this.saveSettings();
                        this.loadSettings();
                        new Notice(`Reset attachment setting of ${file.path}`);
                    }
                    return true;
                }
                return false;
            },
        });

        this.addCommand({
            id: "attachment-management-clear-unused-originalname-storage",
            name: "Clear unused original name storage",
            callback: async () => {
                const attachments = await new ArrangeHandler(this.settings, this.app, this).getAttachmentsInVault(
                    this.settings,
                    "links"
                );
                const storages: OriginalNameStorage[] = [];
                for (const attachs of Object.values(attachments)) {
                    for (const attach of attachs) {
                        const link = decodeURI(attach);
                        const linkFile = this.app.vault.getAbstractFileByPath(link);
                        if (linkFile !== null && linkFile instanceof TFile) {
                            const md5 = await MD5(this.app.vault.adapter, linkFile);
                            const ret = this.settings.originalNameStorage.find((data) => data.md5 === md5);
                            if (ret) {
                                storages.filter((n) => n.md5 == md5).forEach((n) => storages.remove(n));
                                storages.push(ret);
                            }
                        }
                    }
                }
                debugLog("clearUnusedOriginalNameStorage - storage:", storages);
                this.settings.originalNameStorage = storages;
                await this.saveSettings();
                this.loadSettings();
            },
        });

        this.registerEvent(
            this.app.workspace.on("file-menu", async (menu, file) => {
                if ((file.parent && isExcluded(file.parent.path, this.settings)) || isAttachment(this.settings, file)) {
                    return;
                }
                menu.addItem((item) => {
                    item.setTitle("Overriding attachment setting")
                        .setIcon("image-plus")
                        .onClick(async () => {
                            const { setting } = getOverrideSetting(this.settings, file);
                            const fileSetting = Object.assign({}, setting);
                            await this.overrideConfiguration(file, fileSetting);
                        });
                });
            })
        );

        this.registerEvent(
            this.app.vault.on("create", async (file: TAbstractFile) => {
                debugLog("on create event - file:", file.path);
                // only processing create of file, ignore folder creation
                if (!(file instanceof TFile)) {
                    return;
                }

                this.app.workspace.onLayoutReady(async () => {
                    // if the file is modified/create more than 1 second ago, the event is most likely be fired by copy file to
                    // vault folder without using obsidian or sync file from remote (e.g. file manager of op system), we should ignore it.
                    const curentTime = new Date().getTime();
                    const timeGapMs = curentTime - file.stat.mtime;
                    const timeGapCs = curentTime - file.stat.ctime;
                    // ignore markdown and canvas file.
                    if (
                        timeGapMs > 1000 ||
                        timeGapCs > 1000 ||
                        isMarkdownFile(file.extension) ||
                        isCanvasFile(file.extension)
                    ) {
                        return;
                    }

                    if (matchExtension(file.extension, this.settings.excludeExtensionPattern)) {
                        debugLog("create - excluded file by extension", file);
                        return;
                    }

                    this.createdQueue.push(file);
                });
            })
        );

        this.registerEvent(
            this.app.vault.on("modify", async (file: TAbstractFile) => {
                debugLog("create queue:", this.createdQueue);
                if (this.createdQueue.length < 1 || !(file instanceof TFile)) {
                    return;
                }

                debugLog("on modify event - file:", file.path);
                this.app.vault.adapter.process(file.path, (data) => {
                    debugLog("on modify event - file content:", data);
                    this.createdQueue.forEach((f) => {
                        this.app.vault.adapter.exists(f.path, true).then((exist) => {
                            if (exist) {
                                debugLog("on modify event - file exist:", f.path);
                                const processor = new CreateHandler(this, this.settings);
                                const link = this.app.fileManager.generateMarkdownLink(f, file.path);
                                if (
                                    (file.extension == "md" && data.indexOf(link) != -1) ||
                                    (file.extension == "canvas" && data.indexOf(f.path) != -1)
                                ) {
                                    this.createdQueue.remove(f);
                                    processor.processAttach(f, file);
                                }
                            } else {
                                // remove not exists file
                                this.createdQueue.remove(f);
                            }
                        });
                    });
                    return data;
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
                    await this.saveSettings();
                    await this.loadSettings();
                }
                debugLog("rename - updated settings:", setting);

                if (!this.settings.autoRenameAttachment) {
                    debugLog("rename - auto rename not enabled:", this.settings.autoRenameAttachment);
                    return;
                }

                if (file instanceof TFile) {
                    if (file.parent && isExcluded(file.parent.path, this.settings)) {
                        debugLog("rename - exclude path:", file.parent.path);
                        new Notice(`${file.path} was excluded, skipped`);
                        return;
                    }

                    // ignore attachment
                    if (isAttachment(this.settings, file)) {
                        debugLog("rename - not processing rename on attachment:", file.path);
                        return;
                    }

                    await new ArrangeHandler(this.settings, this.app, this).rearrangeAttachment("file", file, oldPath);
                    await this.saveSettings();

                    const oldMetadata = getMetadata(oldPath);
                    // if the user have used the ${date} in `Attachment path` this could be not working, since the date will be changed.
                    // fixed by travese from parent folder
                    const oldAttachPath = oldMetadata.getAttachmentPath(setting, this.settings.dateFormat);
                    this.app.vault.adapter.exists(path.dirname(oldAttachPath)).then((exists) => {
                        if (exists) {
                            this.app.vault.adapter.list(path.dirname(oldAttachPath)).then((data) => {
                                data.folders.forEach((folder) => {
                                    checkEmptyFolder(this.app.vault.adapter, folder).then((empty) => {
                                        if (empty) {
                                            this.app.vault.adapter.rmdir(folder, true);
                                        }
                                    });
                                });
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
                    const oldAttachPath = oldMetadata.getAttachmentPath(setting, this.settings.dateFormat);
                    this.app.vault.adapter.exists(path.dirname(oldAttachPath), true).then((exists) => {
                        if (exists) {
                            this.app.vault.adapter.list(path.dirname(oldAttachPath)).then((data) => {
                                data.folders.forEach((folder) => {
                                    checkEmptyFolder(this.app.vault.adapter, folder).then((empty) => {
                                        if (empty) {
                                            this.app.vault.adapter.rmdir(folder, true);
                                        }
                                    });
                                });
                            });
                        }
                    });
                }
            })
        );

        // This adds a settings tab so the user can configure various aspects of the plugin
        this.addSettingTab(new SettingTab(this.app, this));
    }

    async overrideConfiguration(file: TAbstractFile, setting: AttachmentPathSettings) {
        new OverrideModal(this, file, setting).open();
        await this.loadSettings();
    }

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }
}
