import { Modal, Notice, Setting } from "obsidian";
import AttachmentManagementPlugin from "../main";
import { ArrangeHandler } from "src/arrange";

export class ConfirmModal extends Modal {
  plugin: AttachmentManagementPlugin;

  constructor(plugin: AttachmentManagementPlugin) {
    super(plugin.app);
    this.plugin = plugin;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();

    contentEl.createEl("h3", {
      text: "Tips",
    });
    contentEl.createSpan("", (el) => {
      el.innerText = "This operation is irreversible and experimental. Please backup your vault first!";
    });

    new Setting(contentEl)
      .addButton((btn) => {
        btn
          .setButtonText("Cancel")
          .setCta()
          .onClick(() => {
            this.close();
          });
      })
      .addButton((btn) =>
        btn.setButtonText("Continue").onClick(async () => {
          new ArrangeHandler(this.plugin.settings, this.plugin.app, this.plugin)
            .rearrangeAttachment("links")
            .finally(() => {
              new Notice("Arrange completed");
              this.close();
            });
        })
      );
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
}
