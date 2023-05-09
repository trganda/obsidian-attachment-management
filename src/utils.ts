import { Notice, TAbstractFile, TFile, TFolder, normalizePath } from "obsidian";

const PASTED_IMAGE_PREFIX = "Pasted image ";

export const DEBUG = !(process.env.BUILD_ENV === "production");
if (DEBUG) console.log("DEBUG is enabled");

export function debugLog(...args: any[]) {
	if (DEBUG) {
		console.log(new Date().toISOString().slice(11, 23), ...args);
	}
}

export const blobToArrayBuffer = (blob: Blob) => {
	return new Promise((resolve) => {
		const reader = new FileReader();
		reader.onloadend = () => resolve(reader.result);
		reader.readAsArrayBuffer(blob);
	});
};

export function isMarkdownFile(file: TAbstractFile): boolean {
	if (file instanceof TFile) {
		if (file.extension === "md") {
			return true;
		}
	}
	return false;
}

export function isCanvasFile(file: TAbstractFile): boolean {
	if (file instanceof TFile) {
		if (file.extension === "canvas") {
			return true;
		}
	}
	return false;
}

export function isPastedImage(file: TAbstractFile): boolean {
	if (file instanceof TFile) {
		if (file.name.startsWith(PASTED_IMAGE_PREFIX)) {
			return true;
		}
	}
	return false;
}

// find the first prefix difference of two paths
// e.g.:
//     "Resources/Untitled/Untitled 313/Untitled"
//     "Resources/Untitled1/Untitled 313/Untitled"
// result:
//     "Resources/Untitled"
//     "Resources/Untitled1"
export function stripPaths(
	src: string,
	dst: string
): { nsrc: string; ndst: string } | undefined {
	if (src === dst) {
		return { nsrc: src, ndst: dst };
	}

	const srcParts = src.split("/");
	const dstParts = dst.split("/");

	if (srcParts.length !== dstParts.length) {
		return undefined;
	}

	for (let i = 0; i < srcParts.length; i++) {
		const srcPart = srcParts[i];
		const dstPart = dstParts[i];

		// find the first different part
		if (srcPart !== dstPart) {
			return {
				nsrc: srcParts.slice(0, i + 1).join("/"),
				ndst: dstParts.slice(0, i + 1).join("/"),
			};
		}
	}

	return { nsrc: "", ndst: "" };
}

/**
 * Calucate the depth from parent to children
 * @param parent - parent path
 * @param children - children path
 * @returns depth number
 */
export function pathDepth(parent: string, children: string): number | null {
	if (!children.startsWith(parent)) {
		debugLog(`Error format parent: ${parent} children: ${children}`);
		return null;
	}

	if (parent === children) {
		return 0;
	}

	const suffixPath = children.slice(parent.length, children.length);

	return suffixPath.split("/").length - 1;
}

export function getTAbstractFileByPathDepth(
	file: TAbstractFile,
	parent: string
): TAbstractFile | null {
	const depth = pathDepth(parent, file.path);

	if (depth === null) {
		return null;
	}

	if (depth === 0) {
		return file;
	}

	let paraentFile: TAbstractFile | null = null;
	for (let i = 0; i < depth; i++) {
		paraentFile = file.parent;
	}

	return paraentFile;
}
