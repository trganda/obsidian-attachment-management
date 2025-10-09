import { TranslationMap } from '../index';

export const ja: TranslationMap = {
  // 通用
  common: {
    save: '保存',
    cancel: 'キャンセル',
    delete: '削除',
    edit: '編集',
    add: '追加',
    remove: '削除',
    confirm: '確認',
    close: '閉じる'
  },

  // 設定ページ
  settings: {
    title: 'Attachment Management 設定',
    language: {
      name: '言語',
      desc: 'インターフェースの言語を選択'
    },
    rootPath: {
      name: '添付ファイルの保存先ルートパス',
      desc: '添付ファイルのルートパスを選択',
      options: {
        obsidian: 'Obsidianの設定をコピー',
        inFolder: '指定したフォルダ内',
        nextToNote: 'ノートと同じフォルダ内の指定したサブフォルダ'
      }
    },
    rootFolder: {
      name: 'ルートフォルダ',
      desc: '新しい添付ファイルのルートフォルダ'
    },
    attachmentPath: {
      name: '添付ファイルのパス',
      desc: 'ルートフォルダ内の添付ファイルのパス。変数 {{notepath}}, {{notename}}, {{parent}} が利用可能です。'
    },
    attachmentFormat: {
      name: '添付ファイルのフォーマット',
      desc: '添付ファイルの名前の付け方を定義します。変数 {{dates}}, {{notename}}, {{md5}}, {{originalname}} が利用可能です。'
    },
    dateFormat: {
      name: '日付フォーマット',
      desc: '使用するMoment.jsの日付フォーマット',
      linkText: 'Moment.jsのフォーマットオプション'
    },
    autoRename: {
      name: '添付ファイルを自動でリネーム',
      desc: '対応するmd/canvasファイルが置かれているフォルダ/ファイルの名前を変更すると、添付ファイルのフォルダ/ファイル名も自動的に変更されます。'
    },
    extensionOverride: {
      name: '拡張子ごとの上書き設定',
      desc: '特定の拡張子（例：pdfやzip）を持つ添付ファイルを自動リネームしたい場合、拡張子ごとの上書き設定を使用します。',
      addButton: '拡張子ごとの上書き設定を追加',
      extension: {
        name: '拡張子',
        desc: '上書きする拡張子',
        placeholder: 'pdf|docx?'
      },
      tooltips: {
        remove: '拡張子ごとの上書き設定を削除',
        edit: '拡張子ごとの上書き設定を編集',
        save: '拡張子ごとの上書き設定を保存'
      },
      saved: '拡張子ごとの上書き設定を保存しました'
    },
    excludeExtension: {
      name: '除外する拡張子のパターン',
      desc: '処理対象から除外する拡張子を正規表現で指定します。',
      placeholder: 'pdf|docx?|xlsx?|pptx?|zip|rar'
    },
    excludedPaths: {
      name: '除外パス',
      desc: 'リネームから除外するフォルダのフルパスをセミコロン（;）で区切って指定します（大文字と小文字を区別し、先頭にスラッシュ「/」を付けないでください）。'
    },
    excludeSubpaths: {
      name: 'サブパスを除外',
      desc: 'このオプションをオンにすると、上記で指定したフォルダパスのすべてのサブフォルダも除外されます。'
    }
  },

  // 上書き設定モーダル
  override: {
    title: '上書き設定',
    menuTitle: '添付ファイル設定を上書き',
    addExtensionOverrides: '拡張子ごとの上書き設定を追加',
    extension: {
      name: '拡張子',
      desc: '上書きする拡張子',
      placeholder: 'pdf'
    },
    buttons: {
      reset: 'リセット',
      submit: '送信'
    },
    notifications: {
      reset: '{path} の添付ファイル設定をリセットしました',
      overridden: '{path} の添付ファイル設定を上書きしました'
    }
  },

  // 拡張子ごとの上書きモーダル
  extensionOverride: {
    title: '拡張子ごとの上書き設定',
    extension: {
      name: '拡張子',
      desc: '上書きする拡張子のパターン（例：pdf, docx, jpg）',
      placeholder: 'pdf|docx?'
    },
    rootPath: {
      name: '添付ファイルの保存先ルートパス',
      desc: 'この拡張子の添付ファイルのルートパスを選択'
    },
    rootFolder: {
      name: 'ルートフォルダ',
      desc: 'この拡張子のルートフォルダ'
    },
    attachmentPath: {
      name: '添付ファイルのパス',
      desc: 'この拡張子のルートフォルダ内の添付ファイルのパス'
    },
    attachmentFormat: {
      name: '添付ファイルのフォーマット',
      desc: 'この拡張子の添付ファイルの名前の付け方を定義します'
    },
    buttons: {
      save: '保存'
    },
    notice: {
      extensionEmpty: '拡張子は空にできません',
      extensionExists: '拡張子はすでに存在します',
      saved: '拡張子ごとの上書き設定を保存しました'
    }
  },

  // 確認ダイアログ
  confirm: {
    title: 'ヒント',
    message: 'この操作は元に戻せず、実験的なものです。最初にVaultをバックアップしてください！',
    continue: '続行',
    deleteOverride: 'この上書き設定を本当に削除しますか？',
    deleteExtensionOverride: 'この拡張子ごとの上書き設定を本当に削除しますか？'
  },

  // 通知メッセージ
  notices: {
    settingsSaved: '設定を正常に保存しました',
    overrideSaved: '上書き設定を正常に保存しました',
    overrideDeleted: '上書き設定を正常に削除しました',
    extensionOverrideSaved: '拡張子ごとの上書き設定を正常に保存しました',
    extensionOverrideDeleted: '拡張子ごとの上書き設定を正常に削除しました',
    attachmentRenamed: '添付ファイルを正常にリネームしました',
    attachmentMoved: '添付ファイルを正常に移動しました',
    arrangeCompleted: '整理が完了しました',
    fileExcluded: '{path} は除外されました',
    resetAttachmentSetting: '{path} の添付ファイル設定をリセットしました',
    error: {
      invalidPath: '無効なパスが指定されました',
      fileNotFound: 'ファイルが見つかりません',
      permissionDenied: '権限がありません',
      unknownError: '不明なエラーが発生しました'
    }
  },

  // コマンド
  commands: {
    rearrangeActiveFile: 'アクティブなファイルの添付ファイルを再整理',
    rearrangeAllFiles: 'すべてのファイルの添付ファイルを再整理',
    openSettings: 'Attachment Management の設定を開く',
    overrideAttachmentSetting: '添付ファイル設定を上書き',
    rearrangeAllLinks: 'リンクされているすべての添付ファイルを再整理',
    rearrangeActiveLinks: 'リンクされている添付ファイルを再整理',
    resetOverrideSetting: '上書き設定をリセット',
    clearUnusedStorage: '未使用のオリジナル名ストレージをクリア'
  },

  // エラーメッセージ
  errors: {
    canvasNotSupported: 'Canvasは拡張子ごとの上書き設定としてサポートされていません。',
    markdownNotSupported: 'Markdownは拡張子ごとの上書き設定としてサポートされていません。',
    extensionEmpty: '拡張子ごとの上書き設定は空にできません。',
    duplicateExtension: '重複した拡張子ごとの上書き設定。',
    excludedExtension: '拡張子ごとの上書き設定は、除外された拡張子にできません。'
  }
};
