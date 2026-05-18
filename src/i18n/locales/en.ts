import { TranslationMap } from "../index";

export const en: TranslationMap = {
  common: {
    cancel: "Cancel",
  },

  settings: {
    title: "Attachment Management Settings",
    rootPath: {
      name: "Root path to save attachment",
      desc: "Select root path of attachment",
      options: {
        obsidian: "Copy Obsidian settings",
        inFolder: "In the folder specified below",
        nextToNote: "Next to note in folder specified below",
      },
    },
    rootFolder: {
      name: "Root folder",
      desc: "Root folder of new attachment",
    },
    attachmentPath: {
      name: "Attachment path",
      desc: "Path of attachment in root folder, available variables ${notepath}, ${notename}, ${parent}",
    },
    attachmentFormat: {
      name: "Attachment format",
      desc: "Define how to name the attachment file, available variables ${date}, ${notename}, ${md5} and ${originalname}.",
    },
    dateFormat: {
      name: "Date format",
      desc: "Moment date format to use",
      linkText: "Moment format options",
    },
    autoRename: {
      name: "Automatically rename attachment",
      desc: "Automatically rename the attachment folder/filename when you rename the folder/filename where the corresponding md/canvas file be placed.",
    },
    extensionOverride: {
      name: "Extension override",
      desc: "Using the extension override if you want to autorename the attachment with a specific extension (e.g. pdf or zip).",
      addButton: "Add extension overrides",
      extension: {
        name: "Extension",
        desc: "Extension to override",
        placeholder: "pdf|docx?",
      },
      tooltips: {
        remove: "Remove extension override",
        edit: "Edit extension override",
        save: "Save extension override",
      },
      saveNotice: "Saved extension override",
    },
    excludeExtension: {
      name: "Exclude extension pattern",
      desc: "Regex pattern to exclude certain extensions from being handled.",
      placeholder: "pdf|docx?|xlsx?|pptx?|zip|rar",
    },
    excludedPaths: {
      name: "Excluded paths",
      desc: "Provide the full path of the folder names (case sensitive and without leading slash '/') divided by semicolon (;) to be excluded from renaming.",
    },
    excludeSubpaths: {
      name: "Exclude subpaths",
      desc: "Turn on this option if you want to also exclude all subfolders of the folder paths provided above.",
    },
  },

  override: {
    title: "Overriding Settings",
    menuTitle: "Overriding attachment setting",
    addExtensionOverrides: "Add extension overrides",
    extension: {
      name: "Extension",
      desc: "Extension to override",
      placeholder: "pdf",
    },
    buttons: {
      reset: "Reset",
      submit: "Submit",
    },
    notifications: {
      reset: "Reset attachment setting of {path}",
      overridden: "Overridden attachment setting of {path}",
    },
  },

  extensionOverride: {
    title: "Extension Override Settings",
    rootPath: {
      name: "Root path to save attachment",
      desc: "Select root path of attachment for this extension",
    },
    rootFolder: {
      name: "Root folder",
      desc: "Root folder for this extension",
    },
    attachmentPath: {
      name: "Attachment path",
      desc: "Path of attachment in root folder for this extension",
    },
    attachmentFormat: {
      name: "Attachment format",
      desc: "Define how to name the attachment file for this extension",
    },
    buttons: {
      save: "Save",
    },
  },

  confirm: {
    title: "Tips",
    message:
      "This operation is irreversible and experimental. Please backup your vault first! Are you sure you want to continue?",
    continue: "Yes",
  },

  notices: {
    fileExcluded: "{path} was excluded",
    overrideRemoved: "Removed override setting of {path}",
    fileRenamed: "Renamed {from} to {to}",
    arrangeCompleted: "Arrange completed",
    resetAttachmentSetting: "Reset attachment setting of {path}",
    error: {
      unknownError: "An unknown error occurred",
    },
  },

  commands: {
    rearrangeAllLinks: "Rearrange all linked attachments",
    rearrangeActiveLinks: "Rearrange linked attachments",
    resetOverrideSetting: "Reset override setting",
  },

  errors: {
    canvasNotSupported: "Canvas is not supported as an extension override.",
    markdownNotSupported: "Markdown is not supported as an extension override.",
    extensionEmpty: "Extension override cannot be empty.",
    duplicateExtension: "Duplicate extension override.",
    excludedExtension: "Extension override cannot be an excluded extension.",
    attachFormatEmpty: "Attachment format cannot be empty.",
    attachFormatOriginalnameMixed:
      "${originalname} must be used alone; it cannot be combined with other text or variables.",
    attachFormatIllegalChar: "Attachment format contains illegal filename character: {char}",
    attachFormatUnknownVariable: "Unknown variable in attachment format: {name}",
    attachmentPathEmpty: "Attachment path cannot be empty.",
    attachmentPathIllegalChar: "Attachment path contains illegal filename character: {char}",
    attachmentPathUnknownVariable: "Unknown variable in attachment path: {name}",
  },
};
