import { ListedFiles, normalizePath, Notice, Plugin, TAbstractFile, TextFileView, TFile, TFolder } from "obsidian";
import {
  AttachmentManagementPluginSettings,
  AttachmentPathSettings,
  DEFAULT_SETTINGS,
  SETTINGS_TYPES,
  SettingTab,
} from "./settings/settings";
import {
  ATTACHMENT_RENAME_TYPE,
  attachRenameType,
  getOverrideSetting,
  getParentFolder,
  getRenameOverrideSetting,
  isAttachment,
  isCanvasFile,
  isImage,
  isMarkdownFile,
  isPastedImage,
  stripPaths,
  testExcludeExtension,
  updateOverrideSetting,
} from "./utils";
import { debugLog } from "./log";
import {
  RENAME_EVENT_TYPE_FILE,
  RENAME_EVENT_TYPE_FOLDER,
  RenameEventType,
  SETTINGS_ROOT_INFOLDER,
  SETTINGS_ROOT_NEXTTONOTE,
  SETTINGS_VARIABLES_DATES,
  SETTINGS_VARIABLES_NOTENAME,
  SETTINGS_VARIABLES_NOTEPATH,
  SETTINGS_VARIABLES_NOTEPARENT, SETTINGS_VARIABLES_ORIGINALNAME, KEY_ORIGINAL_NAME_RENAMING
} from "./lib/constant";
import { OverrideModal } from "./model/override";
import { path } from "./lib/path";
import { deduplicateNewName } from "./deduplicate";

export default class AttachmentManagementPlugin extends Plugin {
  settings: AttachmentManagementPluginSettings;
  originalObsAttachPath: string;

  async onload() {
    await this.loadSettings();

    console.log(`Plugin loading: ${this.manifest.name} v.${this.manifest.version}`);
    // this.backupConfigs();

    // this.addCommand({
    //   id: "attachment-management-rearrange-links",
    //   name: "Rearrange Linked Attachments",
    //   callback: () => this.rearrangeAttachment("links"),
    // });

    // this.addCommand({
    //   id: "obsidian-attachment-rearrange-all",
    //   name: "Rearrange All Attachments",
    //   callback: () => this.rearrangeAttachment("all"),
    // });

    this.addCommand({
      id: "override-setting",
      name: "Override Setting",
      checkCallback: (checking: boolean) => {
        const file = this.getActiveFile();
        if (file) {
          if (!checking) {
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
      name: "Reset Override Setting",
      checkCallback: (checking: boolean) => {
        const file = this.getActiveFile();
        if (file) {
          if (!checking) {
            delete this.settings.overridePath[file.path];
            this.saveSettings();
            new Notice(`Reset attachment setting of ${file.path}`);
          }
          return true;
        }
        return false;
      },
    });

    this.registerEvent(
      this.app.workspace.on("file-menu", (menu, file) => {
        menu.addItem((item) => {
          item
            .setTitle("Override attachment setting")
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
      // not working while drop file to text view
      this.app.vault.on("create", (file: TAbstractFile) => {
        debugLog("on create event - file:", file.path);
        // only processing create of file, ignore folder creation
        if (!(file instanceof TFile)) {
          return;
        }

        this.app.workspace.onLayoutReady(() => {
          // if the file is created more than 1 second ago, the event is most likely be fired by copy file to
          // vault folder without using obsidian (e.g. file manager of op system), we should ignore it.
          const timeGapMs = new Date().getTime() - file.stat.ctime;
          if (timeGapMs > 1000) {
            return;
          }
          // ignore markdown and canvas file.
          if (isMarkdownFile(file.extension) || isCanvasFile(file.extension)) {
            return;
          }
          if (isImage(file.extension) || isPastedImage(file)) {
            this.processAttach(file);
          } else {
            if (this.settings.handleAll) {
              debugLog("create - handleAll for file", file);
              if (testExcludeExtension(file.extension, this.settings.excludeExtensionPattern)) {
                debugLog("create - excluded file by extension", file);
                return;
              }
              this.processAttach(file);
            }
          }
        });
      })
    );

    this.registerEvent(
      // while trigger rename event on rename a folder, for each file/folder in this renamed folder (include itself) will trigger this event
      this.app.vault.on("rename", async (file: TAbstractFile, oldPath: string) => {
        debugLog("on rename event - new path and old path:", file.path, oldPath);

        const { setting } = getRenameOverrideSetting(this.settings, file, oldPath);

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

        const type = attachRenameType(setting);
        if (type === ATTACHMENT_RENAME_TYPE.NULL) {
          debugLog("rename - no variable use, skipped");
          return;
        }

        if (file instanceof TFile) {
          // if the renamed file was a attachment, skip
          const flag = await isAttachment(this.settings, oldPath);
          if (flag) {
            debugLog("rename - not processing rename on attachment:", file.path);
            return;
          }

          let eventType: RenameEventType;
          if (path.basename(oldPath, path.extname(oldPath)) === path.basename(file.path, path.extname(file.path))) {
            // rename event of folder
            eventType = RENAME_EVENT_TYPE_FOLDER;
            debugLog("rename - RENAME_EVENT_TYPE:", RENAME_EVENT_TYPE_FOLDER);
          } else {
            // rename event of file
            eventType = RENAME_EVENT_TYPE_FILE;
            debugLog("rename - RENAME_EVENT_TYPE:", RENAME_EVENT_TYPE_FILE);
          }

          await this.onRename(file, oldPath, eventType, type, setting);
        } else if (file instanceof TFolder) {
          // ignore rename event of folder
          // debugLog("rename - ignore rename folder event:", file.name, oldPath);
          return;
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

  // async rearrangeAttachment(type: "all" | "links") {
  //   debugLog("On Rearrange Command");

  //   if (!this.settings.autoRenameAttachment) {
  //     debugLog("No Variable Use, Skip");
  //     return;
  //   }

  //   // only rearrange attachment that linked by markdown or canvas
  //   const attachments = await getAttachmentsInVault(this.settings, this.app, type);
  //   debugLog("Attachments:", Object.keys(attachments).length, Object.entries(attachments));
  //   for (const obsFile of Object.keys(attachments)) {
  //     const innerFile = this.app.vault.getAbstractFileByPath(obsFile);
  //     if (innerFile === null) {
  //       debugLog(`${obsFile} not exists, skipped`);
  //       continue;
  //     }
  //     const { setting } = getOverrideSetting(this.settings, innerFile);

  //     const type = attachRenameType(setting);
  //     if (type === ATTACHMENT_RENAME_TYPE.ATTACHMENT_RENAME_TYPE_NULL) {
  //       debugLog("No variable use, skipped");
  //       return;
  //     }

  //     for (let link of attachments[obsFile]) {
  //       try {
  //         link = decodeURI(link);
  //       } catch (err) {
  //         // new Notice(`Invalid link: ${link}, err: ${err}`);
  //         console.log(`Invalid link: ${link}, err: ${err}`);
  //         continue;
  //       }
  //       debugLog(`Article: ${obsFile} Links: ${link}`);
  //       const noteExt = path.posix.extname(obsFile);
  //       const noteName = path.posix.basename(obsFile, noteExt);
  //       const notePath = path.posix.dirname(obsFile);

  //       const attachPath = this.getAttachmentPath(noteName, notePath, setting);
  //       const attachName = this.getPastedImageFileName(noteName, setting);
  //       const dest = path.posix.join(attachPath, attachName + path.posix.extname(link));

  //       // check if the link was already satisfy the attachment name config
  //       if (!needToRename(setting, attachPath, attachName, noteName, link)) {
  //         debugLog("No need to rename:", link);
  //         continue;
  //       }
  //       const linkFile = this.app.vault.getAbstractFileByPath(link);
  //       if (linkFile === null) {
  //         debugLog(`${link} not exists, skipped`);
  //         continue;
  //       }

  //       if (!(await this.app.vault.adapter.exists(attachPath))) {
  //         this.app.vault.adapter.mkdir(attachPath);
  //       }

  //       // TODO: check if the file already exists
  //       if (await this.app.vault.adapter.exists(dest)) {
  //         new Notice(`${dest} already exists, skipped`);
  //         console.log(`${dest} already exists, skipped`);
  //         continue;
  //       }

  //       await this.app.fileManager.renameFile(linkFile, dest);
  //     }
  //   }
  // }

  async onRename(
    file: TAbstractFile,
    oldPath: string,
    eventType: RenameEventType,
    attachRenameType: ATTACHMENT_RENAME_TYPE = ATTACHMENT_RENAME_TYPE.NULL,
    setting: AttachmentPathSettings
  ) {
    const rf = file as TFile;

    // old note path and name
    const oldNotePath = path.dirname(oldPath);
    const oldNoteName = path.basename(oldPath, path.extname(oldPath));
    // parent of oldNotePath
    const oldNoteParent = path.basename(path.dirname(oldPath));

    debugLog("onRename - old note path:", oldNotePath);
    debugLog("onRename - old note name:", oldNoteName);

    const { parentPath, parentName } = getParentFolder(rf);
    // old attachment path
    const oldAttachPath = this.getAttachmentPath(oldNoteName, oldNotePath, oldNoteParent, oldNoteName, setting);
    const newAttachPath = this.getAttachmentPath(rf.basename, parentPath, parentName, oldNoteName, setting);

    debugLog("onRename - old attachment path:", oldAttachPath);
    debugLog("onRename - new attachment path:", newAttachPath);

    // if the old attachment folder does not exist, skip
    // this will happen when we have already rename the attachment file or folder in previous rename event
    if (!(await this.app.vault.adapter.exists(oldAttachPath))) {
      debugLog("onRename - attachment path does not exist:", oldAttachPath);
      return;
    }

    if (!(await this.app.vault.adapter.exists(newAttachPath))) {
      await this.app.vault.adapter.mkdir(newAttachPath);
    }

    let oldName = "";
    let newName = "";
    if (
      eventType === RENAME_EVENT_TYPE_FILE &&
      (attachRenameType === ATTACHMENT_RENAME_TYPE.FILE || attachRenameType === ATTACHMENT_RENAME_TYPE.BOTH)
    ) {
      oldName = oldNoteName;
      newName = rf.basename;
    }

    // rename attachment folder first
    await this.renameFolder(oldAttachPath, newAttachPath, oldName, newName, attachRenameType);

    // rename attachment filename as needed
    if (
      eventType === RENAME_EVENT_TYPE_FILE &&
      (attachRenameType === ATTACHMENT_RENAME_TYPE.FILE || attachRenameType === ATTACHMENT_RENAME_TYPE.BOTH)
    ) {
      // suppose the attachment folder already renamed
      await this.renameFiles(oldAttachPath, newAttachPath, false, oldName, newName);
    }
  }

  async renameFolder(
    oldAttachPath: string,
    newAttachPath: string,
    oldName: string,
    newName: string,
    attachRenameType: ATTACHMENT_RENAME_TYPE
  ) {
    const { stripedSrc, stripedDst } = stripPaths(oldAttachPath, newAttachPath);

    debugLog("onRename - striped source:", stripedSrc);
    debugLog("onRename - striped destination:", stripedDst);

    if (stripedSrc === stripedDst) {
      debugLog("onRename - same striped path");
    }

    if (
      stripedSrc !== stripedDst &&
      (attachRenameType === ATTACHMENT_RENAME_TYPE.FOLDER || attachRenameType === ATTACHMENT_RENAME_TYPE.BOTH)
    ) {
      const exitsDst = await this.app.vault.adapter.exists(stripedDst);
      if (exitsDst) {
        debugLog("renameFolder - target folder exists:", stripedDst);
        // move the files in oldAttachPath to newAttachPath
        await this.renameFiles(oldAttachPath, newAttachPath, true, oldName, newName);
        // rm the old folder if it's empty
        const old = await this.app.vault.adapter.list(oldAttachPath);
        if (old.files.length === 0 && old.folders.length === 0) {
          await this.app.vault.adapter.rmdir(oldAttachPath, false);
        }
        return;
      } else {
        const src = this.app.vault.getAbstractFileByPath(oldAttachPath);
        if (src === null) {
          debugLog("renameFolder - source file not exists:", oldAttachPath);
          return;
        }
        await this.app.fileManager.renameFile(src, newAttachPath);
      }
    }
  }

  async renameFiles(srcPath: string, dstPath: string, exists: boolean, oldName: string, newName: string) {
    let attachmentFiles: ListedFiles;
    if (exists) {
      attachmentFiles = await this.app.vault.adapter.list(srcPath);
    } else {
      attachmentFiles = await this.app.vault.adapter.list(dstPath);
    }

    debugLog("renameFiles - attachmentFiles:", attachmentFiles);

    // rename all attachment files that the filename content the ${notename} in attachment path
    for (const filePath of attachmentFiles.files) {
      let fileName = path.basename(filePath);
      const fileExtension = path.extname(fileName);
      if (
        (this.settings.handleAll && testExcludeExtension(fileExtension, this.settings.excludeExtensionPattern)) ||
        !isImage(fileExtension)
      ) {
        debugLog("renameFiles - no handle extension:", fileExtension);
        continue;
      }

      fileName = fileName.replace(oldName, newName);

      const dstFolder = this.app.vault.getAbstractFileByPath(dstPath) as TFolder,
        { name } = await deduplicateNewName(fileName, dstFolder),
        newFilePath = normalizePath(path.join(dstPath, name)),
        src = this.app.vault.getAbstractFileByPath(filePath);

      debugLog("renameFiles - new file path:", newFilePath);
      if (src === null) {
        continue;
      }
      await this.app.fileManager.renameFile(src, newFilePath);
    }
  }

  /**
   * Post-processing of created attachment file (for paste and drop event).
   * @param file - the file to process
   * @returns - none
   */
  async processAttach(file: TFile) {
    const activeFile = this.getActiveFile();
    if (activeFile === undefined) {
      new Notice("Error: no active file found.");
      return;
    }
    const { setting } = getOverrideSetting(this.settings, activeFile);

    debugLog("processAttach - active file path", activeFile.path);

    const { parentPath, parentName } = getParentFolder(activeFile);

    debugLog("processAttach - parent path:", parentPath);
    
    const attachName = this.getPastedImageFileName(activeFile.basename, file.basename, setting) + "." + file.extension;
    const attachPath = this.getAttachmentPath(activeFile.basename, parentPath, parentName, attachName, setting);
    
    // make sure the path was created
    if (!(await this.app.vault.adapter.exists(attachPath))) {
      await this.app.vault.adapter.mkdir(attachPath);
    }

    const attachPathFile = this.app.vault.getAbstractFileByPath(attachPath) as TFolder;
    const { name } = await deduplicateNewName(attachName, attachPathFile);

    debugLog("processAttach - new path of file:", path.join(attachPath, name));

    await this.renameCreateFile(file, attachPath, name, activeFile, true);
  }

  /**
   * Rename the file specified by `@param file`, and update the link of the file if specified updateLink
   * @param file - file to rename
   * @param attachPath - where to the renamed file will be move to
   * @param attachName - name of the renamed file
   * @param activeFile - associated active file
   * @param updateLink - whether to replace the link of renamed file
   * @returns - none
   */
  async renameCreateFile(
    file: TFile,
    attachPath: string,
    attachName: string,
    activeFile: TFile,
    updateLink?: boolean
  ) {
    debugLog("renameFile - src of rename:", file.path);
    const dst = normalizePath(path.join(attachPath, attachName.replace(KEY_ORIGINAL_NAME_RENAMING, "")));
    debugLog("renameFile - dst of rename:", dst);

    const oldLinkText = this.app.fileManager.generateMarkdownLink(file, activeFile.path);
    const oldPath = file.path;
    const oldName = file.name;

    try {
      // this api will not update the link automatically on `create` event
      await this.app.fileManager.renameFile(file, dst);
      new Notice(`Renamed ${oldName} to ${attachName.replace(KEY_ORIGINAL_NAME_RENAMING, "")}.`);
    } catch (err) {
      new Notice(`Failed to rename ${file.path} to ${dst.replace(KEY_ORIGINAL_NAME_RENAMING, "")}`);
      throw err;
    }

    if (!updateLink) {
      return;
    }

    // in case fileManager.renameFile may not update the internal link in the active file,
    // we manually replace the current line by manipulating the editor
    const newLinkText = this.app.fileManager.generateMarkdownLink(file, activeFile.path);
    debugLog("renameFile - replace text:", oldLinkText, newLinkText);

    const view = this.getActiveView();
    if (view === null) {
      new Notice(`Failed to update link in ${activeFile.path}: no active view`);
      return;
    }
    const content = view.getViewData();
    let val = "";
    switch (activeFile.extension) {
      case "md":
        val = content.replace(oldLinkText, newLinkText);
        break;
      case "canvas":
        val = content.replace(`/(file\s*\:\s*\")${oldPath}(\")/g`, `$1${dst}$2`);
        break;
    }

    view.setViewData(val, false);
    new Notice(`Updated 1 link in ${activeFile.path}`);
  }

  /**
   * Return the active text file, `md` or `canvas`
   * @returns - the active file or undefined if no active file
   */
  getActiveFile(): TFile | undefined {
    const view = this.getActiveView();
    return view?.file;
  }

  /**
   * Return the active view of text file
   * @returns - the active view of text file
   */
  getActiveView(): TextFileView | null {
    return this.app.workspace.getActiveViewOfType(TextFileView);
  }

  /**
   * Generate the attachment path with specified variables
   * @param noteName - basename (without extension) of note
   * @param notePath - path of note
   * @param setting
   * @param parentFolderBasename
   * @param oldName - original name of attachment file
   * @returns attachment path
   */
  getAttachmentPath(
    noteName: string,
    notePath: string,
    parentFolderBasename: string,
    oldName: string,
    setting: AttachmentPathSettings = this.settings.attachPath
  ): string {
    const root = this.getRootPath(notePath, setting);
    

    const attachPath = path.join(
      root,
      setting.attachmentPath
        .replace(`${SETTINGS_VARIABLES_NOTEPATH}`, notePath)
        .replace(`${SETTINGS_VARIABLES_NOTENAME}`, noteName)
        .replace(`${SETTINGS_VARIABLES_NOTEPARENT}`, parentFolderBasename)
    );
    return normalizePath(attachPath);
  }

  /**
   * Get root path to save attachment file
   * @param notePath - path of note
   * @param setting
   * @returns root path to save attachment file
   */
  getRootPath(notePath: string, setting: AttachmentPathSettings = this.settings.attachPath): string {
    let root: string;

    //@ts-ignore
    const obsmediadir = app.vault.getConfig("attachmentFolderPath");
    // debugLog("obsmediadir", obsmediadir);
    switch (setting.saveAttE) {
      case `${SETTINGS_ROOT_INFOLDER}`:
        root = path.join(setting.attachmentRoot);
        break;
      case `${SETTINGS_ROOT_NEXTTONOTE}`:
        root = path.join(notePath, setting.attachmentRoot.replace("./", ""));
        break;
      default:
        if (obsmediadir === "/") {
          // in vault root folder case
          root = obsmediadir;
        } else if (obsmediadir === "./") {
          // in current folder case
          root = path.join(notePath);
        } else if (obsmediadir.match(/\.\/.+/g) !== null) {
          // in subfolder case
          root = path.join(notePath, obsmediadir.replace("./", ""));
        } else {
          // in specified folder case
          root = obsmediadir;
        }
    }

    return root === "/" ? root : normalizePath(root);
  }

  /**
   * Generate the image file name with specified variable
   * @param noteName - basename (without extension) of note
   * @param originalName - original name of attachment file
   * @param setting
   * @returns image file name
   */
  getPastedImageFileName(noteName: string, originalName:string, setting: AttachmentPathSettings = this.settings.attachPath): string {
    const dateTime = window.moment().format(this.settings.dateFormat);
    return setting.attachFormat
      .replace(`${SETTINGS_VARIABLES_DATES}`, dateTime)
      .replace(`${SETTINGS_VARIABLES_NOTENAME}`, noteName)
      .replace(`${SETTINGS_VARIABLES_ORIGINALNAME}`, originalName + KEY_ORIGINAL_NAME_RENAMING);
  }

  backupConfigs() {
    //@ts-ignore
    this.originalObsAttachPath = this.app.vault.getConfig("attachmentFolderPath");
  }

  restoreConfigs() {
    //@ts-ignore
    this.app.vault.setConfig("attachmentFolderPath", this.originalObsAttachPath);
  }
  updateAttachmentFolderConfig(path: string) {
    //@ts-ignore
    this.app.vault.setConfig("attachmentFolderPath", path);
  }

  onunload() {
    // this.restoreConfigs();
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }
}
