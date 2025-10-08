import { App, Notice, TFile, TFolder, Plugin } from "obsidian";
import { path } from "./lib/path";
import { debugLog } from "./lib/log";
import { getOverrideSetting } from "./override";
import { md5sum, isAttachment, isCanvasFile, isMarkdownFile } from "./utils";
import { LinkMatch, getAllLinkMatchesInFile } from "./lib/linkDetector";
import { AttachmentManagementPluginSettings, AttachmentPathSettings } from "./settings/settings";
import { SETTINGS_VARIABLES_DATES, SETTINGS_VARIABLES_NOTENAME } from "./lib/constant";
import { deduplicateNewName } from "./lib/deduplicate";
import { getMetadata } from "./settings/metadata";
import { getActiveFile } from "./commons";
import { isExcluded } from "./exclude";
import { containOriginalNameVariable, loadOriginalName } from "./lib/originalStorage";

const bannerRegex = /!\[\[(.*?)\]\]/i;

export enum RearrangeType {
  ACTIVE,
  LINKS,
  FILE,
}

export class ArrangeHandler {
  settings: AttachmentManagementPluginSettings;
  app: App;
  plugin: Plugin;

  constructor(settings: AttachmentManagementPluginSettings, app: App, plugin: Plugin) {
    this.settings = settings;
    this.app = app;
    this.plugin = plugin;
  }

  /**
   * Rearranges attachments that are linked by markdown or canvas.
   * Only rearranges attachments if autoRenameAttachment is enabled in settings.
   *
   * @param {RearrangeType} type - The type of attachments to rearrange.
   * @param {TFile} file - The file to which the attachments are linked (optional), if the type was "file", thi should be provided.
   * @param {string} oldPath - The old path of the file (optional), used for rename event.
   */
  async rearrangeAttachment(type: RearrangeType, file?: TFile, oldPath?: string) {
    if (!this.settings.autoRenameAttachment) {
      debugLog("rearrangeAttachment - autoRenameAttachment not enable");
      return;
    }

    // only rearrange attachment that linked by markdown or canvas
    const attachments = await this.getAttachmentsInVault(this.settings, type, file, oldPath);
    debugLog("rearrangeAttachment - attachments:", Object.keys(attachments).length, Object.entries(attachments));
    for (const obNote of Object.keys(attachments)) {
      const innerFile = this.app.vault.getAbstractFileByPath(obNote);
      if (!(innerFile instanceof TFile) || isAttachment(this.settings, innerFile)) {
        debugLog(`rearrangeAttachment - ${obNote} not exists or is attachment, skipped`);
        continue;
      }
      const { setting } = getOverrideSetting(this.settings, innerFile);

      if (attachments[obNote].size == 0) {
        continue;
      }

      // create attachment path if it's not exists
      const md = getMetadata(obNote);
      const attachPath = md.getAttachmentPath(setting, this.settings.dateFormat);
      if (!(await this.app.vault.adapter.exists(attachPath, true))) {
        // process the case where rename the filename to uppercase or lowercase
        if (oldPath != undefined && (await this.app.vault.adapter.exists(attachPath, false))) {
          const mdOld = getMetadata(oldPath);
          const attachPathOld = mdOld.getAttachmentPath(setting, this.settings.dateFormat);
          // this will trigger the rename event and cause the path of attachment change
          this.app.vault.adapter.rename(attachPathOld, attachPath);
        } else {
          await this.app.vault.adapter.mkdir(attachPath);
        }
      }

      for (let link of attachments[obNote]) {
        try {
          link = decodeURI(link);
        } catch (err) {
          console.log(`Invalid link: ${link}, err: ${err}`);
          continue;
        }
        debugLog(`rearrangeAttachment - article: ${obNote} links: ${link}`);
        const linkFile = this.app.vault.getAbstractFileByPath(link);
        if (linkFile === null || !(linkFile instanceof TFile)) {
          debugLog(`${link} not exists, skipped`);
          continue;
        }

        const metadata = getMetadata(obNote, linkFile);
        const md5 = await md5sum(this.app.vault.adapter, linkFile);
        const originalName = loadOriginalName(this.settings, setting, linkFile.extension, md5);
        debugLog("rearrangeAttachment - original name:", originalName);

        let attachName = "";
        if (containOriginalNameVariable(setting, linkFile.extension)) {
          attachName = await metadata.getAttachFileName(
            setting,
            this.settings.dateFormat,
            originalName?.n ?? "",
            this.app.vault.adapter,
            path.basename(link, path.extname(link))
          );
        } else {
          attachName = await metadata.getAttachFileName(
            setting,
            this.settings.dateFormat,
            path.basename(link, path.extname(link)),
            this.app.vault.adapter
          );
        }

        // ignore if the path was equal to the link
        if (attachPath == path.dirname(link) && attachName === path.basename(link, path.extname(link))) {
          continue;
        }

        const attachPathFile = this.app.vault.getAbstractFileByPath(attachPath);
        if (attachPathFile === null || !(attachPathFile instanceof TFolder)) {
          debugLog(`${attachPath} not exists, skipped`);
          continue;
        }
        const { name } = await deduplicateNewName(attachName + "." + path.extname(link), attachPathFile);
        debugLog("rearrangeAttachment - deduplicated name:", name);

        await this.app.fileManager.renameFile(linkFile, path.join(attachPath, name));
      }
    }
  }

  /**
   * Retrieves the attachments in the vault based on the specified settings and type.
   * If a file is provided, only attachments related to that file will be returned.
   *
   * @param {AttachmentManagementPluginSettings} settings - The settings for the attachment management plugin.
   * @param {RearrangeType} type - The type of attachments to retrieve.
   * @param {TFile} [file] - The file to filter attachments by. Optional.
   * @return {Promise<Record<string, Set<string>>>} - A promise that resolves to a record of attachments, where each key is a file name and each value is a set of associated attachment names.
   */
  async getAttachmentsInVault(
    settings: AttachmentManagementPluginSettings,
    type: RearrangeType,
    file?: TFile,
    oldPath?: string
  ): Promise<Record<string, Set<string>>> {
    let attachmentsRecord: Record<string, Set<string>> = {};

    attachmentsRecord = await this.getAttachmentsInVaultByLinks(settings, type, file, oldPath);

    return attachmentsRecord;
  }

  /**
   * Modified from https://github.com/ozntel/oz-clear-unused-images-obsidian/blob/master/src/util.ts#LL48C21-L48C21
   * Retrieves a record of attachments in the vault based on the given settings and type.
   *
   * @param {AttachmentManagementPluginSettings} settings - The settings for the attachment management plugin.
   * @param {RearrangeType} type - The type of attachments to retrieve.
   * @param {TFile} file - The file to retrieve attachments for (optional).
   * @return {Promise<Record<string, Set<string>>>} - A promise that resolves to a record of attachments.
   */
  async getAttachmentsInVaultByLinks(
    settings: AttachmentManagementPluginSettings,
    type: RearrangeType,
    file?: TFile,
    oldPath?: string
  ): Promise<Record<string, Set<string>>> {
    const attachmentsRecord: Record<string, Set<string>> = {};
    let resolvedLinks: Record<string, Record<string, number>> = {};
    let allFiles: TFile[] = [];
    if (type == RearrangeType.LINKS) {
      // resolvedLinks was not working for canvas file
      resolvedLinks = this.app.metadataCache.resolvedLinks;
      allFiles = this.app.vault.getFiles();
    } else if (type == RearrangeType.ACTIVE) {
      const file = getActiveFile(this.app);
      if (file) {
        if ((file.parent && isExcluded(file.parent.path, this.settings)) || isAttachment(this.settings, file)) {
          allFiles = [];
          new Notice(`${file.path} was excluded, skipped`);
        } else {
          debugLog("getAttachmentsInVaultByLinks - active:", file.path);
          allFiles = [file];
          if (this.app.metadataCache.resolvedLinks[file.path]) {
            resolvedLinks[file.path] = this.app.metadataCache.resolvedLinks[file.path];
          }
          debugLog("getAttachmentsInVaultByLinks - resolvedLinks:", resolvedLinks);
        }
      }
    } else if (type == RearrangeType.FILE && file != undefined) {
      if ((file.parent && isExcluded(file.parent.path, this.settings)) || isAttachment(this.settings, file)) {
        allFiles = [];
        new Notice(`${file.path} was excluded, skipped`);
      } else {
        debugLog("getAttachmentsInVaultByLinks - file:", file.path);
        allFiles = [file];
        const rlinks = this.app.metadataCache.resolvedLinks[file.path];
        if (rlinks) {
          debugLog("getAttachmentsInVaultByLinks - rlinks:", rlinks);
          resolvedLinks[file.path] = rlinks;
        } else if (oldPath) {
          debugLog("getAttachmentsInVaultByLinks - oldPath:", oldPath);
          // in some cases, this.app.metadataCache.resolvedLinks[file.path] will be empty since the cache is not updated
          resolvedLinks[file.path] = this.app.metadataCache.resolvedLinks[oldPath];
        }
        debugLog("getAttachmentsInVaultByLinks - resolvedLinks:", resolvedLinks);
      }
    }

    debugLog("getAttachmentsInVaultByLinks - allFiles:", allFiles.length, allFiles);

    if (resolvedLinks) {
      for (const [mdFile, links] of Object.entries(resolvedLinks)) {
        const attachmentsSet: Set<string> = new Set();
        if (links) {
          for (const [filePath] of Object.entries(links)) {
            if (isAttachment(settings, filePath)) {
              this.addToSet(attachmentsSet, filePath);
            }
          }
          this.addToRecord(attachmentsRecord, mdFile, attachmentsSet);
        }
      }
    }
    // Loop Files and Check Frontmatter/Canvas
    for (let i = 0; i < allFiles.length; i++) {
      const obsFile = allFiles[i];
      const attachmentsSet: Set<string> = new Set();

      if (obsFile.parent && isExcluded(obsFile.parent.path, this.settings)) {
        continue;
      }

      // Check Frontmatter for md files and additional links that might be missed in resolved links
      if (isMarkdownFile(obsFile.extension)) {
        // Frontmatter
        const fileCache = this.app.metadataCache.getFileCache(obsFile);
        if (fileCache === null) {
          continue;
        }
        if (fileCache.frontmatter) {
          const frontmatter = fileCache.frontmatter;
          for (const k of Object.keys(frontmatter)) {
            if (typeof frontmatter[k] === "string") {
              const formatMatch = frontmatter[k].match(bannerRegex);
              if (formatMatch && formatMatch[1]) {
                const fileName = formatMatch[1];
                const file = this.app.metadataCache.getFirstLinkpathDest(fileName, obsFile.path);
                if (file && isAttachment(settings, file.path)) {
                  this.addToSet(attachmentsSet, file.path);
                }
              }
            }
          }
        }
        // Any Additional Link
        const linkMatches: LinkMatch[] = await getAllLinkMatchesInFile(obsFile, this.app);
        for (const linkMatch of linkMatches) {
          if (isAttachment(settings, linkMatch.linkText)) {
            this.addToSet(attachmentsSet, linkMatch.linkText);
          }
        }
      } else if (isCanvasFile(obsFile.extension)) {
        // check canvas for links
        const fileRead = await this.app.vault.cachedRead(obsFile);
        if (!fileRead || fileRead.length === 0) {
          continue;
        }
        let canvasData;
        try {
          canvasData = JSON.parse(fileRead);
        } catch (e) {
          debugLog("getAttachmentsInVaultByLinks - parse canvas data error", e);
          continue;
        }
        // debugLog("canvasData", canvasData);
        if (canvasData.nodes && canvasData.nodes.length > 0) {
          for (const node of canvasData.nodes) {
            // node.type: 'text' | 'file'
            if (node.type === "file") {
              if (isAttachment(settings, node.file)) {
                this.addToSet(attachmentsSet, node.file);
              }
            } else if (node.type == "text") {
              const linkMatches: LinkMatch[] = await getAllLinkMatchesInFile(obsFile, this.app, node.text);
              for (const linkMatch of linkMatches) {
                if (isAttachment(settings, linkMatch.linkText)) {
                  this.addToSet(attachmentsSet, linkMatch.linkText);
                }
              }
            }
          }
        }
      }
      this.addToRecord(attachmentsRecord, obsFile.path, attachmentsSet);
    }
    return attachmentsRecord;
  }

  addToRecord(record: Record<string, Set<string>>, key: string, value: Set<string>) {
    if (record[key] === undefined) {
      record[key] = value;
      return;
    }
    const valueSet = record[key];

    for (const val of value) {
      this.addToSet(valueSet, val);
    }

    record[key] = valueSet;
  }

  addToSet(setObj: Set<string>, value: string) {
    if (!setObj.has(value)) {
      setObj.add(value);
    }
  }

  needToRename(
    settings: AttachmentPathSettings,
    attachPath: string,
    attachName: string,
    noteName: string,
    link: string
  ): boolean {
    const linkPath = path.dirname(link);
    const linkName = path.basename(link, path.extname(link));

    if (linkName.length !== attachName.length) {
      return true;
    }

    if (attachPath !== linkPath) {
      return true;
    } else {
      if (settings.attachFormat.includes(SETTINGS_VARIABLES_NOTENAME) && !linkName.includes(noteName)) {
        return true;
      }
      // suppose the ${notename} was in format
      const noNoteNameAttachFormat = settings.attachFormat.split(SETTINGS_VARIABLES_NOTENAME);
      if (settings.attachFormat.includes(SETTINGS_VARIABLES_DATES)) {
        for (const formatPart in noNoteNameAttachFormat) {
          // suppose the ${date} was in format, split each part and search in linkName
          const splited = formatPart.split(SETTINGS_VARIABLES_DATES);
          for (const part in splited) {
            if (!linkName.includes(part)) {
              return true;
            }
          }
        }
      }
    }

    return false;
  }
}
