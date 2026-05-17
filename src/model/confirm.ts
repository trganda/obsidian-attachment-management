import { Modal, Notice, Setting, setIcon } from "obsidian";
import AttachmentManagementPlugin from "../main";
import { ArrangeHandler, RearrangeType } from "../arrange";
import { t } from "../i18n/index";

export class ConfirmModal extends Modal {
  plugin: AttachmentManagementPlugin;

  constructor(plugin: AttachmentManagementPlugin) {
    super(plugin.app);
    this.plugin = plugin;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();

    const header = contentEl.createDiv({ cls: "amg-confirm-header" });
    header.style.display = "flex";
    header.style.alignItems = "center";
    header.style.gap = "8px";
    header.style.marginBottom = "12px";

    const iconEl = header.createSpan({ cls: "amg-confirm-icon" });
    iconEl.style.color = "var(--color-orange)";
    iconEl.style.display = "inline-flex";
    setIcon(iconEl, "alert-triangle");

    header.createEl("h3", {
      text: t("confirm.title"),
      cls: "amg-confirm-title",
    }).style.margin = "0";

    const message = contentEl.createEl("p", {
      text: t("confirm.message"),
      cls: "amg-confirm-message",
    });
    message.style.margin = "0 0 16px 0";
    message.style.lineHeight = "1.5";

    new Setting(contentEl)
      .addButton((btn) => {
        btn.setButtonText(t("common.cancel")).onClick(() => {
          this.close();
        });
      })
      .addButton((btn) =>
        btn
          .setButtonText(t("confirm.continue"))
          .setWarning()
          .onClick(() => {
            new ArrangeHandler(this.plugin.settings, this.plugin.app, this.plugin)
              .rearrangeAttachment(RearrangeType.LINKS)
              .then(() => new Notice(t("notifications.arrangeCompleted")))
              .catch((err) => new Notice(`${t("notices.error.unknownError")}: ${err?.message ?? err}`))
              .finally(() => this.close());
          })
      );
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
}
