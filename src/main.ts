import {
	App,
	Editor,
	FileSystemAdapter,
	MarkdownView,
	Notice,
	Plugin,
	normalizePath,
	TextFileView,
	TFile,
	TAbstractFile,
	TFolder,
	Vault,
	WorkspaceWindow,
	ListedFiles,
} from "obsidian";
import {
	AttachmentManagementPluginSettings,
	DEFAULT_SETTINGS,
	SettingTab,
} from "./settings";
import * as path from "path";
import {
	debugLog,
	isCanvasFile,
	isImage,
	isMarkdownFile,
	isPastedImage,
	stripPaths,
	testExcludeExtension,
} from "./utils";
import {
	SETTINGS_VARIABLES_NOTEPATH,
	SETTINGS_VARIABLES_NOTENAME,
	SETTINGS_ROOT_INFOLDER,
	SETTINGS_ROOT_NEXTTONOTE,
	SETTINGS_VARIABLES_DATES,
	RENAME_EVENT_TYPE_FOLDER,
	RENAME_EVENT_TYPE_FILE,
} from "./constant";

export default class AttachmentManagementPlugin extends Plugin {
	settings: AttachmentManagementPluginSettings;
	adapter: FileSystemAdapter;
	originalObsAttachPath: string;

	async onload() {
		await this.loadSettings();

		const pkg = require("../package.json");
		console.log(
			`Plugin loading: ${pkg.name} ${pkg.version} BUILD_ENV=${process.env.BUILD_ENV}`
		);
		this.adapter = this.app.vault.adapter as FileSystemAdapter;
		// this.backupConfigs();

		this.registerEvent(
			// not working while drop file to text view
			this.app.vault.on("create", (file: TAbstractFile) => {
				debugLog("On Create Event - File:", file.path);
				// only processing create of file, ignore folder creation
				if (!(file instanceof TFile)) {
					return;
				}
				// https://github.com/reorx/obsidian-paste-image-rename/blob/master/src/main.ts#LL81C23-L81C23
				// if the file is created more than 1 second ago, the event is most likely be fired on vault initialization when starting Obsidian app, ignore it
				const timeGapMs = new Date().getTime() - file.stat.ctime;
				if (timeGapMs > 1000) {
					return;
				}
				// ignore markdown and canvas file.
				if (isMarkdownFile(file) || isCanvasFile(file)) {
					return;
				}
				if (isImage(file) || isPastedImage(file)) {
					this.processPastedImg(file);
				} else {
					if (this.settings.handleAll) {
						debugLog("handleAll for file", file);
						if (
							testExcludeExtension(
								file.extension,
								this.settings.excludeExtensionPattern
							)
						) {
							debugLog("Excluded File by Extension", file);
							return;
						}
						this.processPastedImg(file);
					}
				}
			})
		);

		this.registerEvent(
			// while trigger rename event on rename a folder, for each file/folder in this renamed folder (include itself) will trigger this event
			this.app.vault.on(
				"rename",
				async (file: TAbstractFile, oldPath: string) => {
					debugLog(
						"On Rename Event - New Path and Old Path:",
						file.path,
						oldPath
					);

					if (
						!this.settings.autoRenameAttachment ||
						!this.settings.attachmentPath.includes(
							SETTINGS_VARIABLES_NOTENAME
						) ||
						!this.settings.attachmentPath.includes(
							SETTINGS_VARIABLES_NOTEPATH
						) ||
						!this.settings.attachFormat.includes(
							SETTINGS_VARIABLES_NOTENAME
						)
					) {
						debugLog("No Variable Use, Skip");
						return;
					}

					if (file instanceof TFile) {
						// if the renamed file was a attachment, skip
						const flag = await this.isAttachment(file, oldPath);
						if (flag) {
							debugLog(
								"Not Rename on An Attachment, Skipped:",
								file.path
							);
							return;
						}

						let renameType = "";
						if (
							path.posix.basename(
								oldPath,
								path.posix.extname(oldPath)
							) ===
							path.posix.basename(
								file.path,
								path.posix.extname(file.path)
							)
						) {
							// rename event of folder
							renameType = RENAME_EVENT_TYPE_FOLDER;
							debugLog("RenameType:", RENAME_EVENT_TYPE_FOLDER);
						} else {
							// rename event of file
							renameType = RENAME_EVENT_TYPE_FILE;
							debugLog("RenameType:", RENAME_EVENT_TYPE_FILE);
						}

						let renameForamt = false;
						if (
							this.settings.attachFormat.includes(
								SETTINGS_VARIABLES_NOTENAME
							)
						) {
							// need to rename the attachment file name
							renameForamt = true;
						}

						// if (renameForamt && renameType !== RENAME_EVENT_TYPE_FILE) {
						// 	new Notice("Looks like you are renaming a folder");
						// 	return;
						// }

						await this.onRename(
							file,
							oldPath,
							renameType,
							renameForamt
						);
					} else if (file instanceof TFolder) {
						// ignore folder
						debugLog("Ignore Rename Folder:", file.name);
						return;
					}
				}
			)
		);

		// if (this.settings.autoRenameDrop) {
		// 	this.registerEvent(
		// 		// trigger before this.registerDomEvent(w, "drop", ...)
		// 		this.app.workspace.on(
		// 			"editor-drop",
		// 			(evt: DragEvent, editor: Editor, info: MarkdownView) => {
		// 				debugLog("Editor-Drop Event");
		// 				if (evt === undefined) {
		// 					return;
		// 				}
		// 				// only processing markdown file
		// 				const activeFile = this.getActiveFile();
		// 				if (
		// 					activeFile === undefined ||
		// 					!isMarkdownFile(activeFile)
		// 				) {
		// 					return;
		// 				}

		// 				this.onDrop(evt, activeFile, editor, info);
		// 			}
		// 		)
		// 	);
		// }

		// TODO: support canvas drop rename
		// register drop event on Dom element of root split (for editor normaly) for support no markdown files (like canvas)
		// const w = this.app.workspace.rootSplit.win;
		// this.registerDomEvent(w, "drop", (evt: DragEvent) => {
		// 	debugLog("Drop Event");
		// 	if (evt === undefined) {
		// 		return;
		// 	}

		// 	// ignore markdown files in this event listener
		// 	const activeFile = this.getActiveFile();
		// 	if (activeFile === undefined || activeFile.extension == "md") {
		// 		return;
		// 	}

		// 	this.onDrop(evt, activeFile);
		// });

		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new SettingTab(this.app, this));
	}

	// async onDrop(
	// 	evt: DragEvent,
	// 	activeFile: TFile,
	// 	editor?: Editor,
	// 	info?: MarkdownView
	// ) {
	// 	const df = evt.dataTransfer;
	// 	if (df === null) {
	// 		debugLog("Null dataTransfer");
	// 		return;
	// 	}
	// 	evt.preventDefault();

	// 	const fItems = df.files;
	// 	// list all drop files
	// 	for (let key = 0; key < fItems.length; key++) {
	// 		let dropFile = fItems.item(key);
	// 		if (dropFile === null) {
	// 			debugLog("continue");
	// 			continue;
	// 		}
	// 		if (dropFile.name !== "") {
	// 			debugLog("Drop File Name:", dropFile.name);
	// 			const attachPath = this.getAttachmentPath(
	// 				activeFile.basename,
	// 				activeFile.parent?.path as string
	// 			);
	// 			const name = this.getPastedImageFileName(activeFile.basename);
	// 			const extension = dropFile.name.substring(
	// 				dropFile.name.lastIndexOf(".")
	// 			);

	// 			if (isCanvasFile(activeFile)) {
	// 				// TODO: fix canvas drop
	// 				let root = "";
	// 				const notePath = activeFile.parent?.path as string;
	// 				//@ts-ignore
	// 				const obsmediadir = app.vault.getConfig(
	// 					"attachmentFolderPath"
	// 				);
	// 				if (obsmediadir === "/") {
	// 					// in vault root folder case
	// 					root = "/";
	// 				} else if (obsmediadir === "./") {
	// 					// in current folder case
	// 					root = path.posix.join(notePath);
	// 				} else if (obsmediadir.match(/\.\/.+/g) !== null) {
	// 					// in subfolder case
	// 					root = path.posix.join(
	// 						notePath,
	// 						obsmediadir.replace("./", "")
	// 					);
	// 				} else {
	// 					// in specified folder case
	// 					root = obsmediadir;
	// 				}
	// 				debugLog("Root:", root);
	// 				const oldAttachPath = normalizePath(
	// 					path.posix.join(root, dropFile.name)
	// 				);
	// 				debugLog("oldAttachPath:", oldAttachPath);
	// 				const oldAttach =
	// 					this.app.vault.getAbstractFileByPath(oldAttachPath);
	// 				if (!(await this.adapter.exists(oldAttachPath))) {
	// 					debugLog(`${oldAttachPath} not Exists`);
	// 				}
	// 				if (oldAttach === null) {
	// 					return;
	// 				}
	// 				const namePath = normalizePath(
	// 					path.posix.join(attachPath, name + extension)
	// 				);
	// 				debugLog("namePath:", namePath);
	// 				if (!(await this.adapter.exists(attachPath))) {
	// 					await this.adapter.mkdir(attachPath);
	// 				}
	// 				await this.app.fileManager.renameFile(oldAttach, namePath);
	// 				df.clearData();
	// 			} else if (isMarkdownFile(activeFile)) {
	// 				this.updateAttachmentFolderConfig(attachPath);
	// 				const buf = await dropFile.arrayBuffer();
	// 				if (!(await this.adapter.exists(attachPath))) {
	// 					await this.adapter.mkdir(attachPath);
	// 				}

	// 				// @ts-ignore
	// 				const attachFile = await this.app.saveAttachment(
	// 					name,
	// 					extension,
	// 					buf
	// 				);

	// 				debugLog("Save attachment to:", attachFile.path);
	// 				this.restoreConfigs();
	// 				const mdLink =
	// 					await this.app.fileManager.generateMarkdownLink(
	// 						attachFile,
	// 						activeFile.path
	// 					);
	// 				debugLog("Markdown link:", mdLink);
	// 				if (editor === undefined) {
	// 					new Notice(
	// 						"No active editor, add drop file link to file failed"
	// 					);
	// 					return;
	// 				}
	// 				const curPos = editor.getCursor("from");
	// 				debugLog("curPos Line:", curPos.line);
	// 				editor.replaceSelection(mdLink);
	// 			}
	// 		}
	// 	}
	// }

	async onRename(
		file: TAbstractFile,
		oldPath: string,
		renameType: string,
		renameForamt: boolean
	) {
		const rf = file as TFile;
		// generate old note path and name
		const oldNotePath = path.posix.dirname(oldPath);
		const oldNoteExtension = path.posix.extname(oldPath);
		const oldNoteName = path.posix.basename(oldPath, oldNoteExtension);

		debugLog("Old Note Path:", oldNotePath);
		debugLog("Old Note Name:", oldNoteName);

		// generate old attachment path
		let oldAttachPath = this.getAttachmentPath(oldNoteName, oldNotePath);
		let newAttachPath = this.getAttachmentPath(
			rf.basename,
			rf.parent?.path as string
		);

		debugLog("Old Attachment Path:", oldAttachPath);
		debugLog("New Attachment Path:", newAttachPath);

		// if the old attachment folder does not exist, skip
		const exitsAttachPath = await this.adapter.exists(oldAttachPath);
		if (!exitsAttachPath) {
			debugLog("Attachment path does not exist:", oldAttachPath);
			return;
		}

		// rename attachment folder first
		const strip = stripPaths(oldAttachPath, newAttachPath);
		if (strip === undefined) {
			new Notice(
				`Error rename path ${oldAttachPath} to ${newAttachPath}`
			);
			return;
		}

		const stripedOldAttachPath = strip.nsrc;
		const stripedNewAttachPath = strip.ndst;

		debugLog("Striped Source:", stripedOldAttachPath);
		debugLog("Striped Destination:", stripedNewAttachPath);

		const exitsDst = await this.adapter.exists(stripedNewAttachPath);
		if (exitsDst) {
			// if the file exists in the vault
			if (renameType == RENAME_EVENT_TYPE_FILE) {
				new Notice(`Same file name exists: ${stripedNewAttachPath}`);
				return;
			} else if (renameType == RENAME_EVENT_TYPE_FOLDER) {
				// for most case, this should not be happen, we just notice it.
				new Notice(`Folder already exists: ${stripedNewAttachPath}`);
				return;
			}
		} else {
			const cfile =
				this.app.vault.getAbstractFileByPath(stripedOldAttachPath);
			if (cfile === null) {
				return;
			}
			await this.app.fileManager.renameFile(cfile, stripedNewAttachPath);
		}

		// rename attachment filename as needed
		if (renameForamt && renameType == RENAME_EVENT_TYPE_FILE) {
			// suppose the attachment folder already renamed
			// rename all attachment files that the filename content the notename in attachment path
			let attachmentFiles: ListedFiles = await this.adapter.list(
				newAttachPath
			);
			for (let filePath of attachmentFiles.files) {
				debugLog("Listing File:", filePath);
				let fileName = path.posix.basename(filePath);
				const fileExtension = fileName.substring(fileName.lastIndexOf("."));
				if ((this.settings.handleAll && testExcludeExtension(fileExtension, this.settings.excludeExtensionPattern)) || !isImage(fileName)) {
					continue;
				} 
				fileName = fileName.replace(oldNoteName, rf.basename);
				
				let newFilePath = normalizePath(path.posix.join(newAttachPath, fileName));
				debugLog("New File Path:", newFilePath)
				let tfile = this.app.vault.getAbstractFileByPath(filePath);
				if (tfile == null)
						continue;
				await this.app.fileManager.renameFile(tfile, newFilePath);
			}
		}
	}

	/**
	 * Check if the file is an attachment
	 * @param file - the file to check
	 * @param oldPath - the old path of this file
	 * @returns true if the file is an attachment, otherwise false
	 */
	async isAttachment(file: TAbstractFile, oldPath: string): Promise<boolean> {
		if (file instanceof TFile) {
			// checking the old state of the file
			const extension = path.posix.extname(oldPath);
			if (extension === ".md" || extension === ".canvas") {
				return false;
			}
		}
		return true;
	}

	/**
	 * Post-processing of created img file.
	 * @param file - thie file to process
	 * @returns - none
	 */
	async processPastedImg(file: TFile) {
		const activeFile = this.getActiveFile();
		if (activeFile === undefined) {
			new Notice("Error: no active file found.");
			return;
		}
		const ext = activeFile.extension;

		debugLog("Active File Path", activeFile.path);

		// TODO: what if activeFile.parent was undefined
		const attachPath = this.getAttachmentPath(
			activeFile.basename,
			activeFile.parent?.path as string
		);

		const attachName =
			this.getPastedImageFileName(activeFile.basename) +
			"." +
			file.extension;

		debugLog("New Path of File:", path.posix.join(attachPath, attachName));

		// no using updatelink right now.
		this.renameFile(
			file,
			attachPath,
			attachName,
			activeFile.path,
			ext,
			true
		);
	}

	/**
	 * Rename the file spcified by `@param file`, and update the link of the file if specified updateLink
	 * @param file - file to rename
	 * @param attachPath - where to the renamed file will be move to
	 * @param attachName - name of the renamed file
	 * @param sourcePath - path of the associated activefile file
	 * @param extension - extension of associated activefile of file
	 * @param updateLink - whether to replace the link of renamed file
	 * @returns - none
	 */
	async renameFile(
		file: TFile,
		attachPath: string,
		attachName: string,
		sourcePath: string,
		extension: string,
		updateLink?: boolean
	) {
		// Make sure the path was craeted
		if (!(await this.adapter.exists(attachPath))) {
			await this.adapter.mkdir(attachPath);
		}

		debugLog("Souce Path of Reanme:", file.path);

		const dest = normalizePath(path.posix.join(attachPath, attachName));

		debugLog("Destination Path of Reanme:", dest);

		const oldLinkText = this.app.fileManager.generateMarkdownLink(
			file,
			sourcePath
		);
		const oldPath = file.path;
		const oldName = file.name;

		try {
			// this api will not update the link automatically on `create` event
			await this.app.fileManager.renameFile(file, dest);
			new Notice(`Renamed ${oldName} to ${attachName}`);
		} catch (err) {
			new Notice(`Failed to rename ${file.path} to ${dest}`);
			throw err;
		}

		if (!updateLink) {
			return;
		}

		// in case fileManager.renameFile may not update the internal link in the active file,
		// we manually replace the current line by manipulating the editor
		let newLinkText = await this.app.fileManager.generateMarkdownLink(
			file,
			sourcePath
		);
		debugLog("replace text", oldLinkText, newLinkText);

		const view = this.getActiveView();
		if (view === null) {
			new Notice(
				`Failed to update link in ${sourcePath}: no active view`
			);
			return;
		}
		const contnet = view.getViewData();
		let val = "";
		switch (extension) {
			case "md":
				val = contnet.replace(oldLinkText, newLinkText);
				break;
			case "canvas":
				val = contnet.replace(
					`/(file\s*\:\s*\")${oldPath}(\")/`,
					`$1${dest}$2`
				);
				break;
		}

		view.setViewData(val, false);
		new Notice(`Updated 1 link in ${sourcePath}`);
	}

	/**
	 * Return the active text file, `md` or `canvas`
	 * @returns - the active file or undefined if no active file
	 */
	getActiveFile(): TFile | undefined {
		const view = this.getActiveView();
		const file = view?.file;
		return file;
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
	 * @returns attachment path
	 */
	getAttachmentPath(noteName: string, notePath: string): string {
		const root = this.getRootPath(notePath);
		const attachPath = path.join(
			root,
			this.settings.attachmentPath
				.replace(`${SETTINGS_VARIABLES_NOTEPATH}`, notePath)
				.replace(`${SETTINGS_VARIABLES_NOTENAME}`, noteName)
		);
		return normalizePath(attachPath);
	}

	/**
	 * Get root path to save attachment file
	 * @param notePath - path of note
	 * @returns root path to save attachment file
	 */
	getRootPath(notePath: string): string {
		let root = "";

		//@ts-ignore
		const obsmediadir = app.vault.getConfig("attachmentFolderPath");
		// debugLog("obsmediadir", obsmediadir);
		switch (this.settings.saveAttE) {
			case `${SETTINGS_ROOT_INFOLDER}`:
				root = path.posix.join(this.settings.attachmentRoot);
				break;
			case `${SETTINGS_ROOT_NEXTTONOTE}`:
				root = path.posix.join(
					notePath,
					this.settings.attachmentRoot.replace("./", "")
				);
				break;
			default:
				if (obsmediadir === "/") {
					// in vault root folder case
					root = obsmediadir;
				} else if (obsmediadir === "./") {
					// in current folder case
					root = path.posix.join(notePath);
				} else if (obsmediadir.match(/\.\/.+/g) !== null) {
					// in subfolder case
					root = path.posix.join(
						notePath,
						obsmediadir.replace("./", "")
					);
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
	 * @returns image file name
	 */
	getPastedImageFileName(noteName: string) {
		const datetime = window.moment().format(this.settings.dateFormat);
		const imgName = this.settings.attachFormat
			.replace(`${SETTINGS_VARIABLES_DATES}`, datetime)
			.replace(`${SETTINGS_VARIABLES_NOTENAME}`, noteName);
		return imgName;
	}

	backupConfigs() {
		//@ts-ignore
		this.originalObsAttachPath = this.app.vault.getConfig(
			"attachmentFolderPath"
		);
	}

	restoreConfigs() {
		//@ts-ignore
		this.app.vault.setConfig(
			"attachmentFolderPath",
			this.originalObsAttachPath
		);
	}
	updateAttachmentFolderConfig(path: string) {
		//@ts-ignore
		this.app.vault.setConfig("attachmentFolderPath", path);
	}

	onunload() {
		// this.restoreConfigs();
	}

	async loadSettings() {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			await this.loadData()
		);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}
