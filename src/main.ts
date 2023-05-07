import {
	App,
	Editor,
	FileSystemAdapter,
	MarkdownView,
	Notice,
	Plugin,
	normalizePath,
} from "obsidian";
import {
	AttachmentManagementPluginSettings,
	DEFAULT_SETTINGS,
	SettingTab,
} from "./settings";
import * as path from "path";
import { blobToArrayBuffer, copyFromDisk, trimAny } from "./utils";

export default class AttachmentManagementPlugin extends Plugin {
	settings: AttachmentManagementPluginSettings;
	adapter: FileSystemAdapter;
	originalObsAttach: string;

	async onload() {
		await this.loadSettings();

		// This creates an icon in the left ribbon.
		const ribbonIconEl = this.addRibbonIcon(
			"dice",
			"Sample Plugin",
			(evt: MouseEvent) => {
				// Called when the user clicks the icon.
				new Notice("This is a notice!");
			}
		);
		// Perform additional things with the ribbon
		ribbonIconEl.addClass("my-plugin-ribbon-class");

		this.adapter = this.app.vault.adapter as FileSystemAdapter;
		this.originalObsAttach = "";
		this.app.workspace.on(
			"editor-paste",
			(evt: ClipboardEvent, editor: Editor, info: MarkdownView) => {
				this.onPaste(evt, editor, info);
			}
		);

		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new SettingTab(this.app, this));

		// If the plugin hooks up any global DOM events (on parts of the app that doesn't belong to this plugin)
		// Using this function will automatically remove the event listener when this plugin is disabled.
		this.registerDomEvent(document, "click", (evt: MouseEvent) => {
			console.log("click", evt);
		});

		// When registering intervals, this function will automatically clear the interval when the plugin is disabled.
		this.registerInterval(
			window.setInterval(() => console.log("setInterval"), 5 * 60 * 1000)
		);
	}

	async onPaste(event: ClipboardEvent, editor: Editor, view: MarkdownView) {
		if (event === undefined) {
			return;
		}

		let clipBoardData = event.clipboardData;
		if (clipBoardData == null || clipBoardData.items == null) {
			return;
		}

		const noteName = view.file.basename;
		const notePath = path.dirname(view.file.path);

		const attachPath = this.getAttachmentPath(noteName, notePath);

		console.log(attachPath);

		let clipBoardItems = clipBoardData.items;
		if (!clipBoardData.getData("text/plain")) {
			for (let i in clipBoardItems) {
				if (!clipBoardItems.hasOwnProperty(i)) continue;
				let item = clipBoardItems[i];
				if (item.kind !== "file") continue;
				if (!(item.type === "image/png" || item.type === "image/jpeg"))
					continue;
				let pasteImage = item.getAsFile();
				if (!pasteImage) continue;

				let extension = "";
				item.type === "image/png"
					? (extension = "png")
					: item.type === "image/jpeg" && (extension = "jpeg");

				event.preventDefault();

				if (!(await this.adapter.exists(attachPath)))
					await this.adapter.mkdir(attachPath);

				const img = await blobToArrayBuffer(pasteImage);
				const imgName = this.getPastedImageFileName();

				this.backupConfigs();
				this.updateAttachmentFolderConfig(attachPath);
				//@ts-ignore
				const imageFile = await this.app.saveAttachment(
					imgName,
					extension,
					img
				);
				this.restoreConfigs();

				let markdownLink =
					await this.app.fileManager.generateMarkdownLink(
						imageFile,
						view.file.path
					);
				markdownLink += "\n\n";
				editor.replaceSelection(markdownLink);
			}
		}
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
				root = this.settings.attachmentRoot;
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

	getPastedImageFileName() {
		const datetime = window.moment().format(this.settings.dateFormat);
		const imgName = this.settings.imageFormat.replace("${date}", datetime);
		return imgName;
	}

	backupConfigs() {
		//@ts-ignore
		this.originalObsAttach = this.app.vault.getConfig(
			"attachmentFolderPath"
		);
	}

	restoreConfigs() {
		//@ts-ignore
		this.app.vault.setConfig(
			"attachmentFolderPath",
			this.originalObsAttach
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
