import assert from "node:assert/strict";
import { createRequire } from "node:module";
import path from "node:path";
import test from "node:test";
import vm from "node:vm";
import { build } from "esbuild";

const require = createRequire(import.meta.url);
const bundle = await build({
  stdin: {
    contents: `export { ArrangeHandler, RearrangeType } from "./src/arrange";
      export { CreateHandler } from "./src/create";
      export { isFileExcluded } from "./src/exclude";
      export { DEFAULT_SETTINGS } from "./src/settings/settings";
      export { default as Plugin } from "./src/main";`,
    resolveDir: process.cwd(),
  },
  bundle: true,
  write: false,
  platform: "node",
  format: "cjs",
  external: ["obsidian"],
  define: { "process.env.BUILD_ENV": '"production"' },
  plugins: [
    {
      name: "attachment-metadata-fixture",
      setup(builder) {
        builder.onLoad({ filter: /src\/settings\/metadata\.ts$/ }, () => ({
          contents: `export function getMetadata() { return {
          getAttachmentPath: settings => settings.attachmentPath,
          getAttachFileName: async () => "renamed"
        }; }`,
          loader: "ts",
        }));
      },
    },
  ],
});

function fixture({ subpaths = true, destination = "assets" } = {}) {
  class TAbstractFile {}
  class TFolder extends TAbstractFile {
    constructor(filePath) {
      super();
      this.path = filePath;
      this.children = [];
    }
  }
  class TFile extends TAbstractFile {
    constructor(filePath) {
      super();
      this.path = filePath;
      this.name = path.posix.basename(filePath);
      this.extension = path.posix.extname(filePath).slice(1);
      this.basename = this.name.slice(0, -this.extension.length - 1);
      this.parent = new TFolder(path.posix.dirname(filePath));
      this.stat = { mtime: Date.now(), ctime: Date.now() };
    }
  }
  class Plugin {
    constructor(app) {
      this.app = app;
    }
    registerEvent() {}
    addCommand() {}
    addSettingTab() {}
    async loadData() {
      return settings;
    }
    async saveData() {}
  }
  const noop = class {};
  const moment = Object.assign(() => ({ format: () => "" }), { locale: () => "en" });
  const obsidian = new Proxy(
    {
      TAbstractFile,
      TFile,
      TFolder,
      Plugin,
      moment,
      normalizePath: (value) => path.posix.normalize(value),
      debounce: (callback) => callback,
    },
    { get: (target, key) => target[key] ?? noop },
  );
  const module = { exports: {} };
  vm.runInNewContext(bundle.outputFiles[0].text, {
    module,
    exports: module.exports,
    require: (name) => (name === "obsidian" ? obsidian : require(name)),
    console,
  });
  const api = module.exports;
  const settings = structuredClone(api.DEFAULT_SETTINGS);
  Object.assign(settings, { excludePathsArray: ["Excluded"], excludeSubpaths: subpaths, autoRenameAttachment: true });
  settings.attachPath.attachmentPath = destination;
  const files = [
    "Notes/normal.md",
    "Excluded/note.md",
    "Excluded/nested/note.md",
    "Excluded/image.png",
    "Excluded/nested/image.png",
    "Images/normal.png",
  ].map((p) => new TFile(p));
  const byPath = new Map(files.map((file) => [file.path, file]));
  const writes = [];
  const events = {};
  const vault = {
    on: (name, handler) => {
      events[name] = handler;
    },
    getFiles: () => files,
    getAbstractFileByPath: (filePath) => byPath.get(filePath) ?? null,
    adapter: {
      exists: async () => true,
      list: async () => ({ files: [], folders: [] }),
      mkdir: async (filePath) => writes.push(["mkdir", filePath]),
      rename: async (...args) => writes.push(["rename", ...args]),
      rmdir: async (filePath) => writes.push(["rmdir", filePath]),
      process: async (filePath) => writes.push(["process", filePath]),
    },
  };
  const folder = new TFolder(destination);
  folder.vault = vault;
  byPath.set(destination, folder);
  const app = {
    vault,
    metadataCache: {
      resolvedLinks: {
        "Notes/normal.md": { "Images/normal.png": 1, "Excluded/image.png": 1 },
        "Excluded/note.md": { "Images/normal.png": 1 },
        "Excluded/nested/note.md": { "Excluded/nested/image.png": 1 },
      },
    },
    workspace: {
      getActiveViewOfType: () => ({ file: files[1] }),
      onLayoutReady: (callback) => callback(),
      on() {},
    },
    fileManager: { renameFile: async (file, target) => writes.push(["renameFile", file.path, target]) },
  };
  const handler = new api.ArrangeHandler(settings, app);
  return { api, settings, files, writes, events, app, handler };
}

test("vault-wide collection skips excluded notes and attachments referenced from other folders", async () => {
  const { handler, settings, api } = fixture();
  const records = await handler.getAttachmentsInVaultByLinks(settings, api.RearrangeType.LINKS);
  assert.deepEqual(Object.keys(records), ["Notes/normal.md"]);
  assert.deepEqual([...records["Notes/normal.md"]], ["Images/normal.png"]);
});

test("folder-only exclusions retain files in subfolders", async () => {
  const { handler, settings, api } = fixture({ subpaths: false });
  const records = await handler.getAttachmentsInVaultByLinks(settings, api.RearrangeType.LINKS);
  assert(!("Excluded/note.md" in records));
  assert(records["Excluded/nested/note.md"].has("Excluded/nested/image.png"));
  assert(api.isFileExcluded("Excluded/image.png", settings));
  assert(!api.isFileExcluded("Excluded/nested/image.png", settings));
});

test("active-file and file-specific collection honor exclusions", async () => {
  const { handler, settings, api, files } = fixture();
  for (const type of [api.RearrangeType.ACTIVE, api.RearrangeType.FILE]) {
    assert.equal(Object.keys(await handler.getAttachmentsInVaultByLinks(settings, type, files[1])).length, 0);
  }
});

test("vault-wide rearrangement still moves ordinary attachments", async () => {
  const { handler, api, writes } = fixture();
  await handler.rearrangeAttachment(api.RearrangeType.LINKS);
  assert.equal(writes.length, 1);
  assert.deepEqual(writes[0], ["renameFile", "Images/normal.png", "assets/renamed.png"]);
});

test("excluded destinations and old source paths cannot be rearranged", async () => {
  const env = fixture({ destination: "Excluded" });
  await env.handler.rearrangeAttachment(env.api.RearrangeType.LINKS);
  assert.equal(env.writes.length, 0);
  const normal = fixture();
  await normal.handler.rearrangeAttachment(normal.api.RearrangeType.FILE, normal.files[0], "Excluded/old.md");
  assert.equal(normal.writes.length, 0);
});

test("creation and direct rename entry points reject excluded sources, attachments and destinations", () => {
  const { api, app, settings, files, writes } = fixture();
  const handler = new api.CreateHandler({ app }, settings);
  handler.processAttach(files[5], files[1]);
  handler.processAttach(files[3], files[0]);
  handler.renameCreateFile(files[3], "assets", "moved.png", files[0]);
  handler.renameCreateFile(files[5], "Excluded", "moved.png", files[0]);
  handler.updateLinkInSource(files[1], "old", "new");
  assert.equal(writes.length, 0);
});

test("file events do not queue or clean files inside excluded folders, including renamed-out notes", async () => {
  const { api, app, settings, files, writes, events } = fixture();
  const plugin = new api.Plugin(app);
  plugin.manifest = { name: "Attachment Management", version: "test" };
  await plugin.onload();
  await events.create(files[3]);
  assert.equal(plugin.createdQueue.length, 0);
  await events.rename(files[0], "Excluded/old.md");
  const detached = files[1];
  detached.parent = null;
  await events.delete(detached);
  assert.equal(writes.length, 0);
  assert.deepEqual(plugin.settings.excludePathsArray, settings.excludePathsArray);
});
