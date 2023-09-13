import { App, normalizePath,TextFileView, TFile } from "obsidian";

import { SETTINGS_ROOT_INFOLDER, SETTINGS_ROOT_NEXTTONOTE } from "./lib/constant";
import { path } from "./lib/path";
import { AttachmentPathSettings } from "./settings/settings";

/**
 * Return the active text file, `md` or `canvas`
 * @returns - the active file or undefined if no active file
 */
export function getActiveFile(app: App): TFile | undefined {
	const view = getActiveView(app);
	return view?.file ?? undefined;
}

/**
 * Return the active view of text file
 * @returns - the active view of text file
 */
export function getActiveView(app: App): TextFileView | null {
	return app.workspace.getActiveViewOfType(TextFileView);
}

/**
 * Get root path to save attachment file
 * @param notePath - path of note
 * @param setting
 * @returns root path to save attachment file
 */
export function getRootPath(notePath: string, setting: AttachmentPathSettings): string {
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
