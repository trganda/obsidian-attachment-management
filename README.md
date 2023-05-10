# Obsidian Attachment Management Plugin

This plugin support to more flexibly to setting your attachment location with variable `${notepath}`, `${notename}`, `${date}`.

## Features

This plugin currently support:

- [x] Setting attachment location with `${notepath}`, `${notename}`, `${date}`
- [x] Auto-rename the attachment when paste image to `md` or `canvas`
- [x] Auto-rename the attachment file or folder while your rename the article (`md` or `canvas`) file.
- [x] Auto-rename the attachment when drop image to `md`
- [ ] Auto-rename the attachment when drop image to `canvas`

## Usage

TODO

## Adding your plugin to the community plugin list

- Check https://github.com/obsidianmd/obsidian-releases/blob/master/plugin-review.md
- Publish an initial version.
- Make sure you have a `README.md` file in the root of your repo.
- Make a pull request at https://github.com/obsidianmd/obsidian-releases to add your plugin.

## How to install

- Install from Obsidan community plugins.
- Clone this repo
  - `npm i` or `yarn` to install dependencies
  - `npm run build` to start compilation in watch mode.
  - Copy the `main.js` and `manifest.json` files to your vault `VaultFolder.obsidian/plugins/obsidian-attachment-managment`
