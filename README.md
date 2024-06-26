# Obsidian Attachment Management

This plugin supports more flexibly setting your attachment location with variables like `${notepath}`, `${notename}`, `${date}` and `${md5}`. An override setting feature can be used to change the global setting of a folder, file or extension.

> Read the [Original Name](#original-name) section before using the `${originalname}` variable.

## Roadmap of Features

This plugin currently supports:

- [x] Setting the attachment location with `${notepath}`, `${notename}`, `${date}` and `${parent}`
- [x] Auto-rename the attachment when pasting to `markdown` or `canvas`
- [x] Auto-rename the attachment file or folder while you rename the article (`markdown` or `canvas`) file
- [x] Auto-rename the attachment when dropping to `markdown` or `canvas`
- [x] Re-Arrange the attachment file that is linked by `markdown` or `canvas` to the corresponding path as you configured (experimental)
- [x] Processing duplicate attachment
  - [x] Processing duplicate attachment on create (the first time, you paste or drop an attachment in notes)
  - [x] Processing duplicate attachment on rename
- [x] Override attachment configuration for specified notes or folder
- [x] Exclude folders that you want this plugin to skip
  - [x] Add Exclude folder by menu

## How to Install

- Install from Obsidian community plugins.
- Clone this repo
  - `npm i` to install dependencies
  - `npm run build` to start compilation in watch mode.
  - Copy the `main.js`, `manifest.json` and `style.css` files to your vault `VaultFolder.obsidian/plugins/obsidian-attachment-management`
- Download the release file and unarchive the file to your vault `VaultFolder.obsidian/plugins/obsidian-attachment-management`

## Settings

The path of attachment is composed of three parts :

```
{root path}/{attachment path}/{attachment name}.extension
```

And you can use the variables below to config:

- `${notepath}`: The **directory** of the `markdown` or `canvas` file under the vault root.
- `${notename}`: The **filename** of the `markdown` or `canvas` file (without file extension).
- `${parent}`: The **parent** folder name of the `markdown` or `canvas` file.
- `${originalname}`: The **filename** of the attachment file when it was first created in Obsidian.
- `${date}`: Date time format by [Moment format options](https://momentjscom.readthedocs.io/en/latest/moment/04-displaying/01-format)

> **Notice** before using `${originalname}`, there is something you should know. This plugin will **not persist** the original name, it only use the filename to generate the attachment name on create event (first time added to obsidian). This means if you have used `${originalname}`, when you rearrange the attachment, there is no new name generated for the attachment, it just used the current name (i.e. change `Attachment format` from `asset-${originalname}` to `asset-1-${originalname}`, and use rearrange command, it's useless).

### Root Path to Save New Attachments

You **must** select a root folder to save the attachment associated with a `markdown` or `canvas` file.

![SCR-20230511-rgge](./images/SCR-20230511-rgge.png)

It can be set using the config of Obsidian in `Files & Links` and reset using this option.

- Copy Obsidian settings: use the Obsidian setting in the `Files & Links` section.
- In the folder specified below: set a fixed folder.
- Next to note in folder specified below: in the subfolder of the current `markdown` or `canvas` file.

### Attachment Path

A sub-folder to place attachment under the `{root path}`, available variables:

- `${notepath}`: The **directory** of the `markdown` or `canvas` file under the vault root.
- `${notename}`: The **filename** of the `markdown` or `canvas` file (without file extension).
- `${parent}`: The **parent** folder name of the `markdown` or `canvas` file.

Default value `${notepath}/${notename}`.

### Attachment Format

Set how to rename the attachment and available variables:

- `${notename}`: The **filename** of the `markdown` or `canvas` file (without file extension).
- `${originalname}`: The **filename** of the attachment file when first time it created.
- `${date}`: Date time format by [Moment format options](https://momentjscom.readthedocs.io/en/latest/moment/04-displaying/01-format)
- `${md5}`: MD5 hash of the attachment file (calculated when the attachment file was first created in the vault).

default value `IMG-{date}`.

### Date Format

Use [Moment format options](https://momentjscom.readthedocs.io/en/latest/moment/04-displaying/01-format) to set the `${date}`, default value `YYYYMMDDHHmmssSSS`. You should always use the `${date}` variable to prevent the same file name.

#### Exclude Extension Pattern

This option is useful if you want to ignore some file types. Write a Regex pattern to exclude certain extensions from being handled.

![SCR-20230918-pkys](./images/SCR-20230918-pkys.png)

### Automatically Rename Attachment

Automatically rename the attachment folder/filename when you rename the folder/filename where the corresponding md/canvas file is placed.

### Extension Override Setting

This feature allows you to specify the setting for a serials extension. You can use a regex pattern here to override the global setting.

![SCR-20230918-pihr](images/SCR-20230918-pihr.png)

### Exclude Paths

If you want some paths to be skipped by this plugin, add them to the text area.
If you have multiple paths, split them with a semicolon ';'.

By default, the "Exclude paths" will only work on the folder you added, and that folder contains at least one markdown file; you can toggle "Exclude subpaths" to exclude subpaths also.

> **The path is case-sensitive and should not have a leading slash '/' at the beginning.**

## Usage

Install and enable the plugin, after configuration you can paste or drop attachment file as usually and it will be auto renamed.

This plugin supports a command `Rearrange linked attachments/Rearrange all linked attachments`. If you run this command, it will rename all attachments (image file default, to rename another type, you need to enable [Handle All Attachements](#handle-all-attachments)) that have been linked in the `markdown` or `canvas` file as you configured.

![SCR-20230511-rrtk](./images/SCR-20230511-rrtk.png)

**Notice**: The `Rearrange linked attachments/Rearrange all linked attachments` is currently an experimental feature; if you want to try it out, it's best to back up your files first.

### Overriding Setting

You can set the attachment path setting for a file or folder. The priority of these settings are:

```
file setting > most close parent folder setting > global setting
```

If you want to reset the settings of files or folders to the global setting, use the command `Reset Override Setting` or the `Reset` button on the override setting panel. **The reset will only work on each file or folder that you trigger the command on**. A more appropriate method to handle resetting will be added in the future.

### Original Name

The `${originalname}` represents the original filename (without extension) of the attachment you added to the vault. Some people want to keep the original filename and/or combine it with other variables like `${date}`. If you want to keep the original filename of an attachment, set the **Attachment Format** with `${originalname}`.

If you want to use `${originalname}` with other variables, like `${originalname}-${date}`. This plugin will persist the original name for future use. Suppose you change the **Attachment Format** from `${originalname}-${date}` to `IMG-${originalname}`, it's work fine.

The original name is stored in **data.json**, the configuration file of the plugin. You can find it at `.obsidian/plugins/attachment-management/data.json`.

```json
  "originalNameStorage": [
    {
      "n": "Pasted image 20240113222517",
      "md5": "9B1546EBA299E1A2A2FC86C664A15073"
    }
  ],
```

As you can see, the original name was saved with a hash, so if you add the same file multiple times, only the last one will be saved. The **originalNameStorage** will not clear automatically, use command `Clear unused original name storage`. This command will keep the entry if the hash of an attachment is matched.

### Known Issues

- ~~No support for processing duplicated file names right now (in development). In backup, you could use the data variable [`x`](https://momentjscom.readthedocs.io/en/latest/moment/04-displaying/01-format/) to use Unix timestamp with millisecond as filename (it will prevent duplicated filename).~~
- When pasting or dropping a file in `canvas` and `markdown`, it will delay showing the updated link/filename. The reason is that Obsidian's API has no `paste` or `drop` event support for `canvas`, so I have implemented it in another way, and this caused the delay in renaming the attachment.

![Screen Recording](./images/canvas_drop_delay.gif)

- Suppose you have a structure below with default configuration:
  - Attachment directory, "assets/notes/hello/1.png"
  - Note directory, "notes/Hello.md"
  - Running the `Rearrange` command may lead to an error since the folder already exists but has a lowercase name.

## FAQ

Q: What if I add '/' to Exclude Paths?

A: It will exclude the whole vault folder.
