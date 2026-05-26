import type { LocaleShape } from "../index";
import type { en } from "./en";

export const ja = {
  common: {
    cancel: "キャンセル",
  },

  settings: {
    title: "Attachment Management 設定",
    rootPath: {
      name: "添付ファイルの保存先ルートパス",
      desc: "添付ファイルのルートパスを選択",
      options: {
        obsidian: "Obsidian の設定をコピー",
        inFolder: "指定したフォルダ内",
        nextToNote: "ノートと同じフォルダ内の指定したサブフォルダ",
      },
    },
    rootFolder: {
      name: "ルートフォルダ",
      desc: "新しい添付ファイルのルートフォルダ",
    },
    attachmentPath: {
      name: "添付ファイルのパス",
      desc: "ルートフォルダ内の添付ファイルのパス。利用可能な変数：${notepath}、${notename}、${parent}",
    },
    attachmentFormat: {
      name: "添付ファイルのフォーマット",
      desc: "添付ファイルの名前の付け方を定義します。利用可能な変数：${date}、${notename}、${md5}、${originalname}。",
    },
    dateFormat: {
      name: "日付フォーマット",
      desc: "使用する Moment.js の日付フォーマット",
      linkText: "Moment.js のフォーマットオプション",
    },
    autoRename: {
      name: "添付ファイルを自動でリネーム",
      desc: "対応する md/canvas ファイルが置かれているフォルダ/ファイルの名前を変更すると、添付ファイルのフォルダ/ファイル名も自動的に変更されます。",
    },
    extensionOverride: {
      name: "拡張子ごとの上書き設定",
      desc: "特定の拡張子（例：pdf や zip）を持つ添付ファイルを自動リネームしたい場合、拡張子ごとの上書き設定を使用します。",
      addButton: "拡張子ごとの上書き設定を追加",
      extension: {
        name: "拡張子",
        desc: "上書きする拡張子",
        placeholder: "pdf|docx?",
      },
      tooltips: {
        remove: "拡張子ごとの上書き設定を削除",
        edit: "拡張子ごとの上書き設定を編集",
        save: "拡張子ごとの上書き設定を保存",
      },
      saveNotice: "拡張子ごとの上書き設定を保存しました",
    },
    excludeExtension: {
      name: "除外する拡張子のパターン",
      desc: "処理対象から除外する拡張子を正規表現で指定します。",
      placeholder: "pdf|docx?|xlsx?|pptx?|zip|rar",
    },
    excludedPaths: {
      name: "除外パス",
      desc: "リネームから除外するフォルダのフルパスをセミコロン（;）で区切って指定します（大文字と小文字を区別し、先頭にスラッシュ「/」を付けないでください）。",
    },
    excludeSubpaths: {
      name: "サブパスを除外",
      desc: "このオプションをオンにすると、上記で指定したフォルダパスのすべてのサブフォルダも除外されます。",
    },
  },

  override: {
    title: "上書き設定",
    menuTitle: "添付ファイル設定を上書き",
    addExtensionOverrides: "拡張子ごとの上書き設定を追加",
    extension: {
      name: "拡張子",
      desc: "上書きする拡張子",
      placeholder: "pdf",
    },
    buttons: {
      reset: "リセット",
      submit: "送信",
    },
    notifications: {
      reset: "{path} の添付ファイル設定をリセットしました",
      overridden: "{path} の添付ファイル設定を上書きしました",
    },
  },

  extensionOverride: {
    title: "拡張子ごとの上書き設定",
    rootPath: {
      name: "添付ファイルの保存先ルートパス",
      desc: "この拡張子の添付ファイルのルートパスを選択",
    },
    rootFolder: {
      name: "ルートフォルダ",
      desc: "この拡張子のルートフォルダ",
    },
    attachmentPath: {
      name: "添付ファイルのパス",
      desc: "この拡張子のルートフォルダ内の添付ファイルのパス",
    },
    attachmentFormat: {
      name: "添付ファイルのフォーマット",
      desc: "この拡張子の添付ファイルの名前の付け方を定義します",
    },
    buttons: {
      save: "保存",
    },
  },

  confirm: {
    title: "ヒント",
    message: "この操作は元に戻せず、実験的なものです。最初に Vault をバックアップしてください！本当に続行しますか？",
    continue: "続行",
  },

  notices: {
    fileExcluded: "{path} は除外されました",
    overrideRemoved: "{path} の上書き設定を削除しました",
    fileRenamed: "{from} から {to} にリネームしました",
    filesRenamedBatch: "{count} 件の添付ファイルをリネームしました",
    arrangeCompleted: "整理が完了しました",
    resetAttachmentSetting: "{path} の添付ファイル設定をリセットしました",
    error: {
      unknownError: "不明なエラーが発生しました",
    },
  },

  commands: {
    rearrangeAllLinks: "リンクされているすべての添付ファイルを再整理",
    rearrangeActiveLinks: "リンクされている添付ファイルを再整理",
    resetOverrideSetting: "上書き設定をリセット",
    clearUnusedStorage: "未使用の元のファイル名ストレージをクリア",
  },

  errors: {
    canvasNotSupported: "Canvas は拡張子ごとの上書き設定としてサポートされていません。",
    markdownNotSupported: "Markdown は拡張子ごとの上書き設定としてサポートされていません。",
    extensionEmpty: "拡張子ごとの上書き設定は空にできません。",
    duplicateExtension: "重複した拡張子ごとの上書き設定。",
    excludedExtension: "拡張子ごとの上書き設定は、除外された拡張子にできません。",
    attachFormatEmpty: "添付ファイルのフォーマットを空にできません。",
    attachFormatIllegalChar: "添付ファイルのフォーマットに不正なファイル名文字が含まれています：{char}",
    attachFormatUnknownVariable: "添付ファイルのフォーマット内の未知の変数：{name}",
    attachmentPathEmpty: "添付ファイルのパスを空にできません。",
    attachmentPathIllegalChar: "添付ファイルのパスに不正なファイル名文字が含まれています：{char}",
    attachmentPathUnknownVariable: "添付ファイルのパス内の未知の変数：{name}",
  },
} as const satisfies LocaleShape<typeof en>;
