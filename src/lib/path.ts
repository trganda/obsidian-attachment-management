// modified from https://github.com/reorx/obsidian-paste-image-rename/blob/c187bf6ffc897da793eba930f9578710795460ec/src/utils.ts#L37

export const path = {
  // Credit: [@creationix/path.js](https://gist.github.com/creationix/7435851)
  join(...partSegments: string[]): string {
    // Split the inputs into a list of path commands.
    let parts: string[] = [];
    for (let i = 0, l = partSegments.length; i < l; i++) {
      parts = parts.concat(partSegments[i].split("/"));
    }
    // Interpret the path commands to get the new resolved path.
    const newParts = [];
    for (let i = 0, l = parts.length; i < l; i++) {
      const part = parts[i];
      // Remove leading and trailing slashes
      // Also remove "." segments
      if (!part || part === ".") continue;
      // Interpret ".." to pop the last segment
      if (part === "..") newParts.pop();
      // Push new path segments.
      else newParts.push(part);
    }
    // Preserve the initial slash if there was one.
    if (parts[0] === "") newParts.unshift("");
    // Turn back into a single string path.
    return newParts.join("/");
  },

  // A simple function to get the dirname of a path
  // Trailing slashes are ignored. Leading slash is preserved.
  dirname(filepath: string): string {
    return this.join(filepath, "..");
  },

  // returns the last part of a path, e.g. 'foo.jpg'
  basename(filepath: string, extension = ""): string {
    const sp = filepath.split("/");
    const filename = sp[sp.length - 1];
    if (extension !== "") {
      return filename.slice(0, filename.length - extension.length - 1);
    }
    return sp[sp.length - 1];
  },

  // return extension without dot, e.g. 'jpg'
  extname(filepath: string): string {
    const positions = [...filepath.matchAll(new RegExp("\\.", "gi"))].map((a) => a.index);
    const idx = positions[positions.length - 1];
    if (idx === undefined) {
      return "";
    }
    return filepath.slice(idx + 1);
  },
};
