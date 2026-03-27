import { TranslationMap } from "../index";

export const zhCn: TranslationMap = {
  // 通用
  common: {
    save: "保存",
    cancel: "取消",
    delete: "删除",
    edit: "编辑",
    add: "添加",
    remove: "移除",
    confirm: "确认",
    close: "关闭"
  },

  // 设置页面
  settings: {
    title: "附件管理设置",
    language: {
      name: "语言",
      desc: "选择界面语言"
    },
    rootPath: {
      name: "附件保存根路径",
      desc: "选择附件的根路径",
      options: {
        obsidian: "复制 Obsidian 设置",
        inFolder: "在下方指定的文件夹中",
        nextToNote: "在笔记旁边的指定文件夹中"
      }
    },
    rootFolder: {
      name: "根文件夹",
      desc: "新附件的根文件夹"
    },
    attachmentPath: {
      name: "附件路径",
      desc: "附件在根文件夹中的路径，可用变量 {{notepath}}、{{notename}}、{{parent}}"
    },
    attachmentFormat: {
      name: "附件格式",
      desc: "定义如何命名附件文件，可用变量 {{dates}}、{{notename}}、{{md5}} 和 {{originalname}}。"
    },
    dateFormat: {
      name: "日期格式",
      desc: "使用的 Moment 日期格式",
      linkText: "Moment 格式选项"
    },
    autoRename: {
      name: "自动重命名附件",
      desc: "当您重命名对应 md/canvas 文件所在的文件夹/文件名时，自动重命名附件文件夹/文件名。"
    },
    extensionOverride: {
      name: "扩展名覆盖",
      desc: "如果您想要对特定扩展名的附件进行自动重命名（例如 pdf 或 zip），请使用扩展名覆盖。",
      addButton: "添加扩展名覆盖",
      extension: {
        name: "扩展名",
        desc: "要覆盖的扩展名",
        placeholder: "pdf|docx?"
      },
      tooltips: {
        remove: "移除扩展名覆盖",
        edit: "编辑扩展名覆盖",
        save: "保存扩展名覆盖"
      },
      saved: "已保存扩展名覆盖"
    },
    excludeExtension: {
      name: "排除扩展名模式",
      desc: "用于排除某些扩展名不被处理的正则表达式模式。",
      placeholder: "pdf|docx?|xlsx?|pptx?|zip|rar"
    },
    excludedPaths: {
      name: "排除路径",
      desc: "提供要从重命名中排除的文件夹名称的完整路径（区分大小写且不带前导斜杠 \"/\"），用分号（;）分隔。"
    },
    excludeSubpaths: {
      name: "排除子路径",
      desc: "如果您还想排除上面提供的文件夹路径的所有子文件夹，请打开此选项。"
    },
    autoFillAltText: {
      name: "自动填充图片 alt 文本",
      desc: "重命名后自动将附件文件名填充到图片链接的 alt 文本中。"
    },
    aiRename: {
      title: "AI 重命名",
      enabled: {
        name: "启用 AI 重命名",
        desc: "使用 AI 根据笔记上下文自动为粘贴的图片生成有意义的文件名。"
      },
      apiEndpoint: {
        name: "API 端点",
        desc: "完整的 API 端点 URL，支持 Chat Completions（.../chat/completions）和 Responses（.../responses）格式。",
        placeholder: "https://api.openai.com/v1/chat/completions"
      },
      apiKey: {
        name: "API 密钥",
        desc: "用于身份验证的 API 密钥。以明文存储在插件数据中，可能随 vault 同步传播。"
      },
      model: {
        name: "模型",
        desc: "用于生成文件名的模型名称。支持视觉的模型（如 gpt-4o）能为图片生成更准确的名称。",
        placeholder: "gpt-4o-mini"
      },
      timeout: {
        name: "超时时间（毫秒）",
        desc: "等待 AI 响应的最大时间，超时后回退到模板命名。"
      },
      customPrompt: {
        name: "自定义提示词",
        desc: "自定义 AI 的系统提示词。留空则使用默认提示词。",
        placeholder: "根据上下文生成一个简短的描述性文件名..."
      },
      sendImageContent: {
        name: "发送图片内容",
        desc: "将粘贴的图片内容发送给 AI 以获得更准确的命名，需要模型支持视觉能力。"
      },
      maxImageSize: {
        name: "最大图片大小（MB）",
        desc: "超过此大小的图片将回退到纯文本命名。"
      },
      testConnection: "测试",
      testSuccess: "AI 连接测试成功！",
      testFailed: "AI 连接测试失败：{error}",
      testing: "...",
      privacyNotice: "注意：启用后，笔记的部分内容（如开启了「发送图片内容」，图片数据也会）将被发送到配置的 API 端点。"
    }
  },

  // 覆盖设置模态框
  override: {
    title: "覆盖设置",
    menuTitle: "覆盖附件设置",
    addExtensionOverrides: "添加扩展名覆盖",
    extension: {
      name: "扩展名",
      desc: "要覆盖的扩展名",
      placeholder: "pdf"
    },
    buttons: {
      reset: "重置",
      submit: "提交"
    },
    notifications: {
      reset: "已重置 {path} 的附件设置",
      overridden: "已覆盖 {path} 的附件设置"
    }
  },

  // 扩展覆盖模态框
  extensionOverride: {
    title: "扩展名覆盖设置",
    extension: {
      name: "扩展名",
      desc: "要覆盖的扩展名模式（例如：pdf、docx、jpg）",
      placeholder: "pdf|docx?"
    },
    rootPath: {
      name: "附件保存根路径",
      desc: "选择此扩展名的附件根路径"
    },
    rootFolder: {
      name: "根文件夹",
      desc: "此扩展名的根文件夹"
    },
    attachmentPath: {
      name: "附件路径",
      desc: "此扩展名在根文件夹中的附件路径"
    },
    attachmentFormat: {
      name: "附件格式",
      desc: "定义此扩展名的附件文件命名方式"
    },
    buttons: {
      save: "保存"
    },
    notice: {
      extensionEmpty: "扩展名不能为空",
      extensionExists: "扩展名已存在",
      saved: "扩展名覆盖保存成功"
    }
  },

  // 确认对话框
  confirm: {
    title: "提示",
    message: "此操作不可逆且为实验性功能，请先备份您的库！",
    continue: "继续",
    deleteOverride: "您确定要删除此覆盖设置吗？",
    deleteExtensionOverride: "您确定要删除此扩展名覆盖吗？"
  },

  // 通知消息
  notices: {
    settingsSaved: "设置保存成功",
    overrideSaved: "覆盖设置保存成功",
    overrideDeleted: "覆盖设置删除成功",
    extensionOverrideSaved: "扩展名覆盖保存成功",
    extensionOverrideDeleted: "扩展名覆盖删除成功",
    attachmentRenamed: "附件重命名成功",
    attachmentMoved: "附件移动成功",
    error: {
      invalidPath: "指定的路径无效",
      fileNotFound: "文件未找到",
      permissionDenied: "权限被拒绝",
      unknownError: "发生未知错误"
    }
  },

  // 命令
  commands: {
    rearrangeActiveFile: "重新整理当前文件的附件",
    rearrangeAllFiles: "重新整理所有文件的附件",
    openSettings: "打开附件管理设置",
    overrideAttachmentSetting: "覆盖附件设置",
    rearrangeAllLinks: "重新整理所有链接的附件",
    rearrangeActiveLinks: "重新整理链接的附件",
    resetOverrideSetting: "重置覆盖设置",
    clearUnusedStorage: "清理未使用的原始名称存储"
  },

  // 通知消息
  notifications: {
    success: "操作成功完成",
    error: "发生错误",
    warning: "警告",
    arrangeCompleted: "整理完成",
    fileExcluded: "{path} 已被排除",
    resetAttachmentSetting: "已重置 {path} 的附件设置"
  },

  // 错误消息
  errors: {
    canvasNotSupported: "不支持将 Canvas 作为扩展覆盖。",
    markdownNotSupported: "不支持将 Markdown 作为扩展覆盖。",
    extensionEmpty: "扩展覆盖不能为空。",
    duplicateExtension: "重复的扩展覆盖。",
    excludedExtension: "扩展覆盖不能是被排除的扩展。"
  }
};