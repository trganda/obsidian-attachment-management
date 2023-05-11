import { Modal, TFile, App, Setting } from "obsidian";
import * as path from "path";
import { debugLog } from "./utils";

class ImageRenameModal extends Modal {
	src: TFile

	constructor(app: App, src: TFile) {
		super(app);
		this.src = src
	}

	onOpen() {
		this.containerEl.addClass('image-rename-modal')
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}