import { App, Notice, TFile, TFolder } from "obsidian";
import { path } from "./lib/path";
import { debugLog } from "./log";
import { getOverrideSetting } from "./override";
import {
  attachRenameType,
  ATTACHMENT_RENAME_TYPE,
  isAttachment,
  isCanvasFile,
  isMarkdownFile,
  pathIsAnImage,
} from "./utils";
import { LinkMatch, getAllLinkMatchesInFile } from "./lib/linkDetector";
import { AttachmentManagementPluginSettings, AttachmentPathSettings } from "./settings/settings";
import { SETTINGS_VARIABLES_DATES, SETTINGS_VARIABLES_NOTENAME, SETTINGS_VARIABLES_ORIGINALNAME } from "./lib/constant";
import { deduplicateNewName } from "./lib/deduplicate";
import { getMetadata } from "./metadata";
import { getActiveFile } from "./commons";
import { isExcluded } from "./exclude";

const bannerRegex = /!\[\[(.*?)\]\]/i;

export class ArrangeHandler {
  settings: AttachmentManagementPluginSettings;
  app: App;

  constructor(settings: AttachmentManagementPluginSettings, app: App) {
    this.settings = settings;
    this.app = app;
  }

  /**
   * Rearranges attachments that are linked by markdown or canvas.
   * Only rearranges attachments if autoRenameAttachment is enabled in settings.
   *
   * @param {"active" | "links"} type - specifies whether to rearrange the active file attachments or
   * only those that are linked by markdown or canvas.
   * @return {void} nothing is returned
   */
  async rearrangeAttachment(type: "active" | "links") {
    if (!this.settings.autoRenameAttachment) {
      debugLog("rearrangeAttachment - autoRenameAttachment not enable");
      return;
    }

    // only rearrange attachment that linked by markdown or canvas
    const attachments = await this.getAttachmentsInVault(this.settings, type);
    debugLog("rearrangeAttachment - attachments:", Object.keys(attachments).length, Object.entries(attachments));
    for (const obNote of Object.keys(attachments)) {
      const innerFile = this.app.vault.getAbstractFileByPath(obNote);
      if (!(innerFile instanceof TFile) || isAttachment(this.settings, innerFile)) {
        debugLog(`rearrangeAttachment - ${obNote} not exists or is attachment, skipped`);
        continue;
      }
      const { setting } = getOverrideSetting(this.settings, innerFile);

      const type = attachRenameType(setting);
      if (type === ATTACHMENT_RENAME_TYPE.NULL) {
        debugLog("rearrangeAttachment - no variable use, skipped");
        return;
      }

      const metadata = getMetadata(obNote);
      const attachPath = metadata.getAttachmentPath(setting);

      for (let link of attachments[obNote]) {
        try {
          link = decodeURI(link);
        } catch (err) {
          console.log(`Invalid link: ${link}, err: ${err}`);
          continue;
        }
        debugLog(`rearrangeAttachment - article: ${obNote} links: ${link}`);
        const linkFile = this.app.vault.getAbstractFileByPath(link);
        if (linkFile === null) {
          debugLog(`${link} not exists, skipped`);
          continue;
        }

        const attachName = metadata.getAttachFileName(
          setting,
          this.settings.dateFormat,
          "",
          path.basename(link, path.extname(link))
        );
        // debugLog(`rearrangeAttachment - ${attachPath}, ${attachName}`);
        // check if the link was already satisfy the attachment name config
        if (!this.needToRename(setting, attachPath, attachName, metadata.basename, link)) {
          debugLog("rearrangeAttachment - no need to rename:", link);
          continue;
        }

        if (!(await this.app.vault.adapter.exists(attachPath))) {
          await this.app.vault.adapter.mkdir(attachPath);
        }

        const attachPathFile = this.app.vault.getAbstractFileByPath(attachPath) as TFolder;
        const { name } = await deduplicateNewName(attachName + "." + path.extname(link), attachPathFile);
        debugLog("rearrangeAttachment - deduplicated name:", name);
        const dest = path.join(attachPath, name);

        await this.app.fileManager.renameFile(linkFile, dest);
      }
    }
  }

  /**
   * Retrieves the attachments in the specified vault of the given type.
   *
   * @param {AttachmentManagementPluginSettings} settings - the settings for the attachment management plugin
   * @param {"active" | "links"} type - the type of attachments to retrieve, either "active" or "links"
   * @return {Promise<Record<string, Set<string>>>} Returns a promise that resolves to a record containing sets of attachment names for each item ID in the specified vault.
   */
  async getAttachmentsInVault(
    settings: AttachmentManagementPluginSettings,
    type: "active" | "links"
  ): Promise<Record<string, Set<string>>> {
    let attachmentsRecord: Record<string, Set<string>> = {};

    attachmentsRecord = await this.getAttachmentsInVaultByLinks(settings, type);

    return attachmentsRecord;
  }

  /**
   * Modified from https://github.com/ozntel/oz-clear-unused-images-obsidian/blob/master/src/util.ts#LL48C21-L48C21
   * Retrieves a record of attachments in the vault based on the given settings and type.
   *
   * @param {AttachmentManagementPluginSettings} settings - The settings object used to filter attachments.
   * @param {"active" | "links"} type - The type of attachments to retrieve. Can be "active" or "links".
   * @return {Promise<Record<string, Set<string>>>} A record of attachments where the keys are the file paths and the values are sets of attachment paths.
   */
  async getAttachmentsInVaultByLinks(
    settings: AttachmentManagementPluginSettings,
    type: "active" | "links"
  ): Promise<Record<string, Set<string>>> {
    const attachmentsRecord: Record<string, Set<string>> = {};
    let resolvedLinks: Record<string, Record<string, number>> = {};
    let allFiles: TFile[] = [];
    if (type === "links") {
      // resolvedLinks was not working for canvas file
      resolvedLinks = this.app.metadataCache.resolvedLinks;
      allFiles = this.app.vault.getFiles();
    } else if (type === "active") {
      const file = getActiveFile(this.app);
      if (file) {
        if ((file.parent && isExcluded(file.parent.path, this.settings)) || isAttachment(this.settings, file)) {
          allFiles = [];
          new Notice(`${file.path} was excluded, skipped`);
        } else {
          debugLog("getAttachmentsInVaultByLinks - active file:", file.path);
          allFiles = [file];
          if (this.app.metadataCache.resolvedLinks[file.path]) {
            resolvedLinks[file.path] = this.app.metadataCache.resolvedLinks[file.path];
          }
          debugLog("getAttachmentsInVaultByLinks - resolvedLinks:", resolvedLinks);
        }
      }
    }

    if (resolvedLinks) {
      for (const [mdFile, links] of Object.entries(resolvedLinks)) {
        const attachmentsSet: Set<string> = new Set();
        for (const [filePath, nr] of Object.entries(links)) {
          if (isAttachment(settings, filePath)) {
            this.addToSet(attachmentsSet, filePath);
          }
        }
        this.addToRecord(attachmentsRecord, mdFile, attachmentsSet);
      }
    }
    // Loop Files and Check Frontmatter/Canvas
    for (let i = 0; i < allFiles.length; i++) {
      const obsFile = allFiles[i];
      const attachmentsSet: Set<string> = new Set();

      if ((obsFile.parent && isExcluded(obsFile.parent.path, this.settings))) {
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
              if (frontmatter[k].match(bannerRegex) || pathIsAnImage(frontmatter[k])) {
                const fileName = frontmatter[k].match(bannerRegex)[1];
                const file = this.app.metadataCache.getFirstLinkpathDest(fileName, obsFile.path);
                if (file && isAttachment(settings, file.path)) {
                  this.addToSet(attachmentsSet, file.path);
                }
              }
            }
          }
        }
        // Any Additional Link
        const linkMatches: LinkMatch[] = await getAllLinkMatchesInFile(obsFile, app);
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
              const linkMatches: LinkMatch[] = await getAllLinkMatchesInFile(obsFile, app, node.text);
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
