import { App, TFile, normalizePath } from "obsidian";
import { getAllLinkMatchesInFile, LinkMatch } from "./linkDetector";
import { debugLog } from "./log";

/**
 * 手动更新MD文件中的链接引用
 * 当Obsidian的fileManager.renameFile无法自动更新链接时使用
 */
export class LinkUpdater {
  private app: App;

  constructor(app: App) {
    this.app = app;
  }

  /**
   * 解码URL编码的路径
   * @param path 可能包含URL编码的路径
   * @returns 解码后的路径
   */
  private decodeUrlPath(path: string): string {
    try {
      return decodeURIComponent(path);
    } catch (error) {
      // 如果解码失败，返回原始路径
      return path;
    }
  }

  /**
   * 更新所有引用了指定文件的MD文件中的链接
   * @param oldPath 旧文件路径
   * @param newPath 新文件路径
   */
  async updateLinksForRenamedFile(oldPath: string, newPath: string): Promise<void> {
    debugLog(`LinkUpdater: Updating links from ${oldPath} to ${newPath}`);
    
    // 获取所有MD文件
    const markdownFiles = this.app.vault.getMarkdownFiles();
    
    for (const mdFile of markdownFiles) {
      try {
        await this.updateLinksInFile(mdFile, oldPath, newPath);
      } catch (error) {
        console.error(`Failed to update links in ${mdFile.path}:`, error);
      }
    }
  }

  /**
   * 更新单个MD文件中的链接
   * @param mdFile MD文件
   * @param oldPath 旧文件路径
   * @param newPath 新文件路径
   */
  private async updateLinksInFile(mdFile: TFile, oldPath: string, newPath: string): Promise<void> {
    const content = await this.app.vault.read(mdFile);
    const linkMatches = await getAllLinkMatchesInFile(mdFile, this.app, content);
    
    // 检查是否有需要更新的链接
    const linksToUpdate = linkMatches.filter(link => {
      const normalizedLinkPath = normalizePath(this.decodeUrlPath(link.linkText));
      const normalizedOldPath = normalizePath(this.decodeUrlPath(oldPath));
      return normalizedLinkPath === normalizedOldPath;
    });
    
    if (linksToUpdate.length === 0) {
      return; // 没有需要更新的链接
    }
    
    debugLog(`LinkUpdater: Found ${linksToUpdate.length} links to update in ${mdFile.path}`);
    
    let updatedContent = content;
    
    // 更新每个匹配的链接
    for (const linkMatch of linksToUpdate) {
      updatedContent = this.updateLinkInContent(updatedContent, linkMatch, newPath);
    }
    
    // 如果内容有变化，保存文件
    if (updatedContent !== content) {
      await this.app.vault.modify(mdFile, updatedContent);
      debugLog(`LinkUpdater: Updated links in ${mdFile.path}`);
    }
  }

  /**
   * 在文件内容中更新特定的链接
   * @param content 文件内容
   * @param linkMatch 要更新的链接匹配
   * @param newPath 新路径
   * @returns 更新后的内容
   */
  private updateLinkInContent(content: string, linkMatch: LinkMatch, newPath: string): string {
    const { match, type } = linkMatch;
    let newMatch: string;
    
    switch (type) {
      case "wiki":
        // [[oldPath]] -> [[newPath]]
        // [[oldPath|alias]] -> [[newPath|alias]]
        if (match.includes("|")) {
          const alias = match.split("|")[1].replace("]]", "");
          newMatch = `[[${newPath}|${alias}]]`;
        } else {
          newMatch = `[[${newPath}]]`;
        }
        break;
        
      case "markdown":
        // [text](oldPath) -> [text](newPath)
        const textPart = match.match(/\[(.*?)\]/)?.[1] || "";
        newMatch = `[${textPart}](${newPath})`;
        break;
        
      case "wikiTransclusion":
        // ![[oldPath]] -> ![[newPath]]
        newMatch = `![[${newPath}]]`;
        break;
        
      case "mdTransclusion":
        // ![text](oldPath) -> ![text](newPath)
        const altText = match.match(/!\[(.*?)\]/)?.[1] || "";
        newMatch = `![${altText}](${newPath})`;
        break;
        
      default:
        return content; // 未知类型，不更新
    }
    
    // 替换原始匹配
    return content.replace(match, newMatch);
  }

  /**
   * 批量更新多个文件的链接引用
   * @param renamedFiles 重命名的文件映射 {oldPath: newPath}
   */
  async updateLinksForMultipleFiles(renamedFiles: Record<string, string>): Promise<void> {
    debugLog(`LinkUpdater: Updating links for ${Object.keys(renamedFiles).length} renamed files`);
    
    const markdownFiles = this.app.vault.getMarkdownFiles();
    
    for (const mdFile of markdownFiles) {
      try {
        await this.updateLinksInFileForMultiple(mdFile, renamedFiles);
      } catch (error) {
        console.error(`Failed to update links in ${mdFile.path}:`, error);
      }
    }
  }

  /**
   * 在单个MD文件中更新多个文件的链接
   * @param mdFile MD文件
   * @param renamedFiles 重命名的文件映射
   */
  private async updateLinksInFileForMultiple(mdFile: TFile, renamedFiles: Record<string, string>): Promise<void> {
    const content = await this.app.vault.read(mdFile);
    const linkMatches = await getAllLinkMatchesInFile(mdFile, this.app, content);
    
    let updatedContent = content;
    let hasChanges = false;
    
    // 检查每个链接是否需要更新
    for (const linkMatch of linkMatches) {
      const normalizedLinkPath = normalizePath(this.decodeUrlPath(linkMatch.linkText));
      
      for (const [oldPath, newPath] of Object.entries(renamedFiles)) {
        const normalizedOldPath = normalizePath(this.decodeUrlPath(oldPath));
        
        if (normalizedLinkPath === normalizedOldPath) {
          updatedContent = this.updateLinkInContent(updatedContent, linkMatch, newPath);
          hasChanges = true;
          break; // 找到匹配后跳出内层循环
        }
      }
    }
    
    // 如果有变化，保存文件
    if (hasChanges) {
      await this.app.vault.modify(mdFile, updatedContent);
      debugLog(`LinkUpdater: Updated multiple links in ${mdFile.path}`);
    }
  }
}