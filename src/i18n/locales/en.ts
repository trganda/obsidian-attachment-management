import { TranslationMap } from '../index';

export const en: TranslationMap = {
  // 通用
  common: {
    save: 'Save',
    cancel: 'Cancel',
    delete: 'Delete',
    edit: 'Edit',
    add: 'Add',
    remove: 'Remove',
    confirm: 'Confirm',
    close: 'Close'
  },

  // 设置页面
  settings: {
    title: 'Attachment Management Settings',
    language: {
      name: 'Language',
      desc: 'Select the interface language'
    },
    rootPath: {
      name: 'Root path to save attachment',
      desc: 'Select root path of attachment',
      options: {
        obsidian: 'Copy Obsidian settings',
        inFolder: 'In the folder specified below',
        nextToNote: 'Next to note in folder specified below'
      }
    },
    rootFolder: {
      name: 'Root folder',
      desc: 'Root folder of new attachment'
    },
    attachmentPath: {
      name: 'Attachment path',
      desc: 'Path of attachment in root folder, available variables {{notepath}}, {{notename}}, {{parent}}'
    },
    attachmentFormat: {
      name: 'Attachment format',
      desc: 'Define how to name the attachment file, available variables {{date}}, {{notename}}, {{md5}} and {{originalname}}.'
    },
    dateFormat: {
      name: 'Date format',
      desc: 'Moment date format to use',
      linkText: 'Moment format options'
    },
    autoRename: {
      name: 'Automatically rename attachment',
      desc: 'Automatically rename the attachment folder/filename when you rename the folder/filename where the corresponding md/canvas file be placed.'
    },
    extensionOverride: {
      name: 'Extension override',
      desc: 'Using the extension override if you want to autorename the attachment with a specific extension (e.g. pdf or zip).',
      addButton: 'Add extension overrides',
      extension: {
        name: 'Extension',
        desc: 'Extension to override',
        placeholder: 'pdf|docx?'
      },
      tooltips: {
        remove: 'Remove extension override',
        edit: 'Edit extension override',
        save: 'Save extension override'
      },
      saved: 'Saved extension override'
    },
    excludeExtension: {
      name: 'Exclude extension pattern',
      desc: 'Regex pattern to exclude certain extensions from being handled.',
      placeholder: 'pdf|docx?|xlsx?|pptx?|zip|rar'
    },
    excludedPaths: {
      name: 'Excluded paths',
      desc: 'Provide the full path of the folder names (case sensitive and without leading slash \'/\') divided by semicolon (;) to be excluded from renaming.'
    },
    excludeSubpaths: {
      name: 'Exclude subpaths',
      desc: 'Turn on this option if you want to also exclude all subfolders of the folder paths provided above.'
    }
  },

  // 覆盖设置模态框
  override: {
    title: 'Overriding Settings',
    menuTitle: 'Overriding attachment setting',
    addExtensionOverrides: 'Add extension overrides',
    extension: {
      name: 'Extension',
      desc: 'Extension to override',
      placeholder: 'pdf'
    },
    buttons: {
      reset: 'Reset',
      submit: 'Submit'
    },
    notifications: {
      reset: 'Reset attachment setting of {path}',
      overridden: 'Overridden attachment setting of {path}'
    }
  },

  // 扩展覆盖模态框
  extensionOverride: {
    title: 'Extension Override Settings',
    extension: {
      name: 'Extension',
      desc: 'Extension pattern to override (e.g., pdf, docx, jpg)',
      placeholder: 'pdf|docx?'
    },
    rootPath: {
      name: 'Root path to save attachment',
      desc: 'Select root path of attachment for this extension'
    },
    rootFolder: {
      name: 'Root folder',
      desc: 'Root folder for this extension'
    },
    attachmentPath: {
      name: 'Attachment path',
      desc: 'Path of attachment in root folder for this extension'
    },
    attachmentFormat: {
      name: 'Attachment format',
      desc: 'Define how to name the attachment file for this extension'
    },
    buttons: {
      save: 'Save'
    },
    notice: {
      extensionEmpty: 'Extension cannot be empty',
      extensionExists: 'Extension already exists',
      saved: 'Extension override saved successfully'
    }
  },

  // 确认对话框
  confirm: {
    title: 'Tips',
    message: 'This operation is irreversible and experimental. Please backup your vault first!',
    continue: 'Continue',
    deleteOverride: 'Are you sure you want to delete this override setting?',
    deleteExtensionOverride: 'Are you sure you want to delete this extension override?'
  },

  // 通知消息
  notices: {
    settingsSaved: 'Settings saved successfully',
    overrideSaved: 'Override setting saved successfully',
    overrideDeleted: 'Override setting deleted successfully',
    extensionOverrideSaved: 'Extension override saved successfully',
    extensionOverrideDeleted: 'Extension override deleted successfully',
    attachmentRenamed: 'Attachment renamed successfully',
    attachmentMoved: 'Attachment moved successfully',
    arrangeCompleted: 'Arrange completed',
    fileExcluded: '{path} was excluded',
    resetAttachmentSetting: 'Reset attachment setting of {path}',
    error: {
      invalidPath: 'Invalid path specified',
      fileNotFound: 'File not found',
      permissionDenied: 'Permission denied',
      unknownError: 'An unknown error occurred'
    }
  },

  // 命令
  commands: {
    rearrangeActiveFile: 'Rearrange attachments for active file',
    rearrangeAllFiles: 'Rearrange attachments for all files',
    openSettings: 'Open Attachment Management settings',
    overrideAttachmentSetting: 'Override attachment setting',
    rearrangeAllLinks: 'Rearrange all linked attachments',
    rearrangeActiveLinks: 'Rearrange linked attachments',
    resetOverrideSetting: 'Reset override setting',
    clearUnusedStorage: 'Clear unused original name storage'
  },



  // 错误消息
  errors: {
    canvasNotSupported: 'Canvas is not supported as an extension override.',
    markdownNotSupported: 'Markdown is not supported as an extension override.',
    extensionEmpty: 'Extension override cannot be empty.',
    duplicateExtension: 'Duplicate extension override.',
    excludedExtension: 'Extension override cannot be an excluded extension.'
  }
};
