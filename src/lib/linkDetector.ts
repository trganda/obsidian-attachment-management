// copy from https://github.com/ozntel/oz-clear-unused-images-obsidian/blob/master/src/linkDetector.ts
import { App,TFile } from "obsidian";

/* -------------------- LINK DETECTOR -------------------- */

type LinkType = "markdown" | "wiki" | "wikiTransclusion" | "mdTransclusion";

export interface LinkMatch {
    type: LinkType;
    match: string;
    linkText: string;
    sourceFilePath: string;
}

/**
 *
 * @param mdFile : File, of which the text content is scanned
 * @param app : Obsidian App
 * @param fileText : Optional, If file is not Md format, provide fileText to scan
 * @returns Promise<LinkMatch[]>
 */
export const getAllLinkMatchesInFile = async (mdFile: TFile, app: App, fileText?: string): Promise<LinkMatch[]> => {
	const linkMatches: LinkMatch[] = [];
	if (fileText === undefined) {
		fileText = await app.vault.read(mdFile);
	}

	// --> Get All WikiLinks
	const wikiRegex = /\[\[.*?\]\]/g;
	const wikiMatches = fileText.match(wikiRegex);
	if (wikiMatches) {
		const fileRegex = /(?<=\[\[).*?(?=(\]|\|))/;

		for (const wikiMatch of wikiMatches) {
			// --> Check if it is Transclusion
			if (matchIsWikiTransclusion(wikiMatch)) {
				const fileName = getTransclusionFileName(wikiMatch);
				const file = app.metadataCache.getFirstLinkpathDest(fileName, mdFile.path);
				if (fileName !== "") {
					const linkMatch: LinkMatch = {
						type: "wikiTransclusion",
						match: wikiMatch,
						linkText: file ? file.path : fileName,
						sourceFilePath: mdFile.path,
					};
					linkMatches.push(linkMatch);
					continue;
				}
			}
			// --> Normal Internal Link
			const fileMatch = wikiMatch.match(fileRegex);
			if (fileMatch) {
				// Web links are to be skipped
				if (fileMatch[0].startsWith("http")) continue;
				const file = app.metadataCache.getFirstLinkpathDest(fileMatch[0], mdFile.path);
				const linkMatch: LinkMatch = {
					type: "wiki",
					match: wikiMatch,
					linkText: file ? file.path : fileMatch[0],
					sourceFilePath: mdFile.path,
				};
				linkMatches.push(linkMatch);
			}
		}
	}

	// --> Get All Markdown Links
	const markdownRegex = /\[(^$|.*?)\]\((.*?)\)/g;
	const markdownMatches = fileText.match(markdownRegex);
	if (markdownMatches) {
		const fileRegex = /(?<=\().*(?=\))/;
		for (const markdownMatch of markdownMatches) {
			// --> Check if it is Transclusion
			if (matchIsMdTransclusion(markdownMatch)) {
				const fileName = getTransclusionFileName(markdownMatch);
				const file = app.metadataCache.getFirstLinkpathDest(fileName, mdFile.path);
				if (fileName !== "") {
					const linkMatch: LinkMatch = {
						type: "mdTransclusion",
						match: markdownMatch,
						linkText: file ? file.path : fileName,
						sourceFilePath: mdFile.path,
					};
					linkMatches.push(linkMatch);
					continue;
				}
			}
			// --> Normal Internal Link
			const fileMatch = markdownMatch.match(fileRegex);
			if (fileMatch) {
				// Web links are to be skipped
				if (fileMatch[0].startsWith("http")) continue;
				const file = app.metadataCache.getFirstLinkpathDest(fileMatch[0], mdFile.path);
				const linkMatch: LinkMatch = {
					type: "markdown",
					match: markdownMatch,
					linkText: file ? file.path : fileMatch[0],
					sourceFilePath: mdFile.path,
				};
				linkMatches.push(linkMatch);
			}
		}
	}
	return linkMatches;
};

/* ---------- HELPERS ---------- */

const wikiTransclusionRegex = /\[\[(.*?)#.*?\]\]/;
const wikiTransclusionFileNameRegex = /(?<=\[\[)(.*)(?=#)/;

const mdTransclusionRegex = /\[.*?]\((.*?)#.*?\)/;
const mdTransclusionFileNameRegex = /(?<=\]\()(.*)(?=#)/;

const matchIsWikiTransclusion = (match: string): boolean => {
	return wikiTransclusionRegex.test(match);
};

const matchIsMdTransclusion = (match: string): boolean => {
	return mdTransclusionRegex.test(match);
};

/**
 * @param match
 * @returns file name if there is a match or empty string if no match
 */
const getTransclusionFileName = (match: string): string => {
	const isWiki = wikiTransclusionRegex.test(match);
	const isMd = mdTransclusionRegex.test(match);
	if (isWiki || isMd) {
		const fileNameMatch = match.match(isWiki ? wikiTransclusionFileNameRegex : mdTransclusionFileNameRegex);
		if (fileNameMatch) return fileNameMatch[0];
	}
	return "";
};
