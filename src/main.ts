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
} from "obsidian";
import {
	AttachmentManagementPluginSettings,
	DEFAULT_SETTINGS,
	SettingTab,
} from "./settings";
import * as path from "path";
import {
	blobToArrayBuffer,
	debugLog,
	isCanvasFile,
	isMarkdownFile,
	isPastedImage,
} from "./utils";

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
		this.backupObsAttachPath();

		// this.registerEvent(
		// 	this.app.workspace.on(
		// 		"editor-paste",
		// 		(evt: ClipboardEvent, editor: Editor, info: MarkdownView) => {
		// 			this.onPaste(evt, editor, info);
		// 		}
		// 	)
		// );

		this.registerEvent(
			this.app.vault.on("create", (file) => {
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
				if (isPastedImage(file)) {
					debugLog("pasted image created", file);
					this.processCreateImg(file);
				}
			})
		);


		this.registerEvent(
			this.app.vault.on("rename", (file) => {
				debugLog("renamed:", file.name);
				// TODO
			})
		)

		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new SettingTab(this.app, this));
	}

	async processCreateImg(file: TFile) {
		debugLog(file.name);

		const activeFile = this.getActiveFile();
		if (activeFile === undefined) {
			new Notice("Error: No active file found.");
			return;
		}
		const ext = activeFile.extension;

		debugLog(activeFile.basename);
		debugLog(activeFile.parent?.path);

		const attachPath = this.getAttachmentPath(
			activeFile.basename,
			activeFile.parent?.path as string
		);

		const attachName =
			this.getPastedImageFileName(activeFile.basename) +
			"." +
			file.extension;
		debugLog("New path and name of created file:", attachPath, attachName);
		this.renameFile(
			file,
			attachPath,
			attachName,
			activeFile.path,
			ext,
			true
		);
	}

	// Move and rename the file.
	async renameFile(
		file: TFile,
		attachPath: string,
		attachName: string,
		sourcePath: string,
		extension: string,
		replaceCurrentLine?: boolean
	) {
		// Make sure the path was craeted
		if (!(await this.adapter.exists(attachPath))) {
			await this.adapter.mkdir(attachPath);
		}

		debugLog("Souce path:", file.path);
		const dst = normalizePath(path.join(attachPath, attachName));
		debugLog("Destination path:", dst);

		const oldLinkText = this.app.fileManager.generateMarkdownLink(
			file,
			sourcePath
		);
		const oldPath = file.path;
		try {
			await this.adapter.rename(file.path, dst);
			// await this.adapter.remove(file.path);
		} catch (err) {
			new Notice(`Failed to move ${file.path} to ${dst}`);
			throw err;
		}

		if (!replaceCurrentLine) {
			return;
		}

		// in case fileManager.renameFile may not update the internal link in the active file,
		// we manually replace the current line by manipulating the editor
		let newLinkText = await this.app.fileManager.generateMarkdownLink(
			file,
			dst
		);
		debugLog("replace text", oldLinkText, newLinkText);

		const view = this.getActiveView();
		if (view === null) {
			new Notice(
				`Failed to replace linking in ${sourcePath}: no active editor`
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
					`$1${dst}$2`
				);
				break;
		}

		view.setViewData(val, false);
	}

	// async onPaste(evt: ClipboardEvent, editor: Editor, view: MarkdownView) {
	// 	console.log("onPaste");
	// 	if (evt === undefined) {
	// 		return;
	// 	}

	// 	let clipBoardData = evt.clipboardData;
	// 	if (clipBoardData == null || clipBoardData.items == null) {
	// 		return;
	// 	}

	// 	const noteName = view.file.basename;
	// 	const notePath = path.dirname(view.file.path);

	// 	const attachPath = this.getAttachmentPath(noteName, notePath);

	// 	console.log(attachPath);

	// 	let clipBoardItems = clipBoardData.items;
	// 	if (!clipBoardData.getData("text/plain")) {
	// 		for (let i in clipBoardItems) {
	// 			if (!clipBoardItems.hasOwnProperty(i)) continue;
	// 			let item = clipBoardItems[i];
	// 			if (item.kind !== "file") continue;
	// 			if (!(item.type === "image/png" || item.type === "image/jpeg"))
	// 				continue;
	// 			let pasteImage = item.getAsFile();
	// 			if (!pasteImage) continue;

	// 			let extension = "";
	// 			item.type === "image/png"
	// 				? (extension = "png")
	// 				: item.type === "image/jpeg" && (extension = "jpeg");

	// 			evt.preventDefault();

	// 			if (!(await this.adapter.exists(attachPath)))
	// 				await this.adapter.mkdir(attachPath);

	// 			const img = await blobToArrayBuffer(pasteImage);
	// 			const imgName = this.getPastedImageFileName(noteName);

	// 			this.updateAttachmentFolderConfig(attachPath);
	// 			//@ts-ignore
	// 			const imageFile = await this.app.saveAttachment(
	// 				imgName,
	// 				extension,
	// 				img
	// 			);
	// 			this.restoreObsAttachPath();

	// 			let markdownLink =
	// 				await this.app.fileManager.generateMarkdownLink(
	// 					imageFile,
	// 					view.file.path
	// 				);
	// 			markdownLink += "\n\n";
	// 			editor.replaceSelection(markdownLink);
	// 		}
	// 	}
	// }

	getActiveFile(): TFile | undefined {
		const view = this.app.workspace.getActiveViewOfType(TextFileView);
		const file = view?.file;
		debugLog("active file", file?.path);
		return file;
	}

	getActiveEditor(): Editor | undefined {
		const view = this.app.workspace.getActiveViewOfType(TextFileView);
		const mdView = view as MarkdownView;
		if (mdView) {
			return mdView?.editor;
		}
		return undefined;
	}

	getActiveView() {
		return this.app.workspace.getActiveViewOfType(TextFileView);
	}

	getAttachmentPath(noteName: string, notePath: string): string {
		const root = this.getRootPath(notePath);
		const attachPath = path.join(
			root,
			this.settings.attachmentPath
				.replace("${notepath}", notePath)
				.replace("${notename}", noteName)
		);
		return normalizePath(attachPath);
	}

	getRootPath(notePath: string): string {
		let root = "/";

		//@ts-ignore
		const obsmediadir = app.vault.getConfig("attachmentFolderPath");
		switch (this.settings.saveAttE) {
			case "inFolderBelow":
				root = path.join(this.settings.attachmentRoot);
				break;
			case "nextToNote":
				root = path.join(
					notePath,
					this.settings.attachmentRoot.replace("./", "")
				);
				break;
			default:
				if (obsmediadir === "/") {
					root = obsmediadir;
				} else if (obsmediadir === "./") {
					root = path.join(notePath);
				} else if (obsmediadir.match(/\.\/.+/g) !== null) {
					root = path.join(notePath, obsmediadir.replace("./", ""));
				} else {
					root = obsmediadir;
				}
		}
		return normalizePath(root);
	}

	getPastedImageFileName(noteName: string) {
		const datetime = window.moment().format(this.settings.dateFormat);
		const imgName = this.settings.imageFormat
			.replace("${date}", datetime)
			.replace("${notename}", noteName);
		return imgName;
	}

	backupObsAttachPath() {
		//@ts-ignore
		this.originalObsAttachPath = this.app.vault.getConfig(
			"attachmentFolderPath"
		);
	}

	restoreObsAttachPath() {
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

	onunload() {}

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
