import { TranslationMap } from "../index";

export const zhCn: TranslationMap = {
  common: {
    cancel: "取消",
  },

  settings: {
    title: "附件管理设置",
    rootPath: {
      name: "附件保存根路径",
      desc: "选择附件的根路径",
      options: {
        obsidian: "复制 Obsidian 设置",
        inFolder: "在下方指定的文件夹中",
        nextToNote: "在笔记旁边的指定文件夹中",
      },
    },
    rootFolder: {
      name: "根文件夹",
      desc: "新附件的根文件夹",
    },
    attachmentPath: {
      name: "附件路径",
      desc: "附件在根文件夹中的路径，可用变量 ${notepath}、${notename}、${parent}",
    },
    attachmentFormat: {
      name: "附件格式",
      desc: "定义如何命名附件文件，可用变量 ${date}、${notename}、${md5} 和 ${originalname}。",
    },
    dateFormat: {
      name: "日期格式",
      desc: "使用的 Moment 日期格式",
      linkText: "Moment 格式选项",
    },
    autoRename: {
      name: "自动重命名附件",
      desc: "当您重命名对应 md/canvas 文件所在的文件夹/文件名时，自动重命名附件文件夹/文件名。",
    },
    extensionOverride: {
      name: "扩展名覆盖",
      desc: "如果您想要对特定扩展名的附件进行自动重命名（例如 pdf 或 zip),请使用扩展名覆盖。",
      addButton: "添加扩展名覆盖",
      extension: {
        name: "扩展名",
        desc: "要覆盖的扩展名",
        placeholder: "pdf|docx?",
      },
      tooltips: {
        remove: "移除扩展名覆盖",
        edit: "编辑扩展名覆盖",
        save: "保存扩展名覆盖",
      },
      saveNotice: "已保存扩展名覆盖",
    },
    excludeExtension: {
      name: "排除扩展名模式",
      desc: "用于排除某些扩展名不被处理的正则表达式模式。",
      placeholder: "pdf|docx?|xlsx?|pptx?|zip|rar",
    },
    excludedPaths: {
      name: "排除路径",
      desc: "提供要从重命名中排除的文件夹名称的完整路径（区分大小写且不带前导斜杠 '/'），用分号（;）分隔。",
    },
    excludeSubpaths: {
      name: "排除子路径",
      desc: "如果您还想排除上面提供的文件夹路径的所有子文件夹，请打开此选项。",
    },
  },

  override: {
    title: "覆盖设置",
    menuTitle: "覆盖附件设置",
    addExtensionOverrides: "添加扩展名覆盖",
    extension: {
      name: "扩展名",
      desc: "要覆盖的扩展名",
      placeholder: "pdf",
    },
    buttons: {
      reset: "重置",
      submit: "提交",
    },
    notifications: {
      reset: "已重置 {path} 的附件设置",
      overridden: "已覆盖 {path} 的附件设置",
    },
  },

  extensionOverride: {
    title: "扩展名覆盖设置",
    rootPath: {
      name: "附件保存根路径",
      desc: "选择此扩展名的附件根路径",
    },
    rootFolder: {
      name: "根文件夹",
      desc: "此扩展名的根文件夹",
    },
    attachmentPath: {
      name: "附件路径",
      desc: "此扩展名在根文件夹中的附件路径",
    },
    attachmentFormat: {
      name: "附件格式",
      desc: "定义此扩展名的附件文件命名方式",
    },
    buttons: {
      save: "保存",
    },
  },

  confirm: {
    title: "提示",
    message: "此操作不可逆且为实验性功能，请先备份您的库！确定要继续吗？",
    continue: "继续",
  },

  notices: {
    fileExcluded: "{path} 已被排除",
    overrideRemoved: "已移除 {path} 的覆盖设置",
    fileRenamed: "已将 {from} 重命名为 {to}",
    error: {
      unknownError: "发生未知错误",
    },
  },

  notifications: {
    arrangeCompleted: "整理完成",
    resetAttachmentSetting: "已重置 {path} 的附件设置",
  },

  commands: {
    rearrangeAllLinks: "重新整理所有链接的附件",
    rearrangeActiveLinks: "重新整理链接的附件",
    resetOverrideSetting: "重置覆盖设置",
  },

  errors: {
    canvasNotSupported: "不支持将 Canvas 作为扩展覆盖。",
    markdownNotSupported: "不支持将 Markdown 作为扩展覆盖。",
    extensionEmpty: "扩展覆盖不能为空。",
    duplicateExtension: "重复的扩展覆盖。",
    excludedExtension: "扩展覆盖不能是被排除的扩展。",
    attachFormatEmpty: "附件格式不能为空。",
    attachFormatOriginalnameMixed: "${originalname} 必须单独使用，不能与其他文本或变量组合。",
    attachFormatIllegalChar: "附件格式包含非法文件名字符：{char}",
    attachFormatUnknownVariable: "附件格式中存在未知变量：{name}",
    attachmentPathEmpty: "附件路径不能为空。",
    attachmentPathIllegalChar: "附件路径包含非法文件名字符：{char}",
    attachmentPathUnknownVariable: "附件路径中存在未知变量：{name}",
  },
};
