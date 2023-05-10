import { App, PluginSettingTab, Setting } from "obsidian";
import AttachmentManagementPlugin from "./main";
import { SETTINGS_ROOT_OBSFOLDER, SETTINGS_VARIABLES_NOTEPATH, SETTINGS_VARIABLES_NOTENAME, SETTINGS_VARIABLES_DATES, SETTINGS_ROOT_INFOLDER, SETTINGS_ROOT_NEXTTONOTE } from "./constant";

export interface AttachmentManagementPluginSettings {
	attachmentRoot: string;
	saveAttE: string;
	attachmentPath: string;
	imageFormat: string;
	dateFormat: string;
	autoRenameFolder: boolean;
	autoRenameFiles: boolean;
}

export const DEFAULT_SETTINGS: AttachmentManagementPluginSettings = {
	attachmentRoot: "",
	saveAttE: `${SETTINGS_ROOT_OBSFOLDER}`,
	attachmentPath: `${SETTINGS_VARIABLES_NOTEPATH}/${SETTINGS_VARIABLES_NOTENAME}`,
	imageFormat: `IMG-${SETTINGS_VARIABLES_DATES}`,
	dateFormat: "YYYYMMDDHHmmssSSS",
	autoRenameFolder: true,
	autoRenameFiles: false,
};

export class SettingTab extends PluginSettingTab {
	plugin: AttachmentManagementPlugin;

	constructor(app: App, plugin: AttachmentManagementPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	displSw(cont: any): void {
		cont.findAll(".setting-item").forEach((el: any) => {
			if (el.getAttr("class").includes("root_folder_set")) {
				if (this.plugin.settings.saveAttE === "obsFolder") {
					el.hide();
				} else {
					el.show();
				}
			}
		});
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();

		containerEl.createEl("h2", {
			text: "Settings for Attachment Management.",
		});

		new Setting(containerEl)
			.setName("Root path to save new attachements")
			.setDesc("Select root path for all new attachements")
			.addDropdown((text) =>
				text
					.addOption(`${SETTINGS_ROOT_OBSFOLDER}`, "Copy Obsidian settings")
					.addOption(`${SETTINGS_ROOT_INFOLDER}`, "In the folder specified below")
					.addOption(
						`${SETTINGS_ROOT_NEXTTONOTE}`,
						"Next to note in folder specified below"
					)
					.setValue(this.plugin.settings.saveAttE)
					.onChange(async (value) => {
						this.plugin.settings.saveAttE = value;
						this.displSw(containerEl);
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Root folder")
			.setDesc("Root folder of new attachment")
			.setClass("root_folder_set")
			.addText((text) =>
				text
					.setPlaceholder(DEFAULT_SETTINGS.attachmentRoot)
					.setValue(this.plugin.settings.attachmentRoot)
					.onChange(async (value) => {
						console.log("Attachment root: " + value);
						this.plugin.settings.attachmentRoot = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Attachment path")
			.setDesc(
				`Path of new attachment in root folder, aviliable variables ${SETTINGS_VARIABLES_NOTEPATH} and ${SETTINGS_VARIABLES_NOTENAME}`
			)
			.addText((text) =>
				text
					.setPlaceholder(DEFAULT_SETTINGS.attachmentPath)
					.setValue(this.plugin.settings.attachmentPath)
					.onChange(async (value) => {
						console.log("Attachment path: " + value);
						this.plugin.settings.attachmentPath = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Image format")
			.setDesc(
				`Define how to name the image file, aviliable variables ${SETTINGS_VARIABLES_DATES} and ${SETTINGS_VARIABLES_NOTENAME}`
			)
			.addText((text) =>
				text
					.setPlaceholder(DEFAULT_SETTINGS.imageFormat)
					.setValue(this.plugin.settings.imageFormat)
					.onChange(async (value) => {
						console.log("Pasted image format: " + value);
						this.plugin.settings.imageFormat = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Date format")
			.setDesc(
				createFragment((frag) => {
					frag.appendText("Moment date format to use ");
					frag.createEl("a", {
						href: 'https://momentjscom.readthedocs.io/en/latest/moment/04-displaying/01-format/"',
						text: "Moment format options",
					});
				})
			)
			.addText((text) =>
				text
					.setPlaceholder(DEFAULT_SETTINGS.dateFormat)
					.setValue(this.plugin.settings.dateFormat)
					.onChange(async (value) => {
						console.log("Date format: " + value);
						this.plugin.settings.dateFormat = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Automatically rename attachment")
			.setDesc(
				"Automatically rename attachment folder/filename while rename the folder/filename of corresponding md/cavans file"
			)
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.autoRenameFolder)
					.onChange(async (value) => {
						console.log(
							"Automatically rename attachment folder: " + value
						);
						this.plugin.settings.autoRenameFolder = value;
						await this.plugin.saveSettings();
					})
			);

		// new Setting(containerEl)
		// 	.setName("Automatically rename attachment files")
		// 	.setDesc(
		// 		`When renaming md files, automatically rename attachment files if file name contains "${SETTINGS_VARIABLES_NOTENAME}".`
		// 	)
		// 	.addToggle((toggle) =>
		// 		toggle
		// 			.setValue(this.plugin.settings.autoRenameFiles)
		// 			.onChange(async (value: boolean) => {
		// 				this.plugin.settings.autoRenameFiles = value;
		// 				await this.plugin.saveSettings();
		// 			})
		// 	);

		this.displSw(containerEl);
	}
}
