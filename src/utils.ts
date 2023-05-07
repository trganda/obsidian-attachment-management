import { TAbstractFile, TFile } from "obsidian";

const fs = require("fs").promises;
const PASTED_IMAGE_PREFIX = 'Pasted image '

export const DEBUG = !(process.env.BUILD_ENV === 'production')
if (DEBUG) console.log('DEBUG is enabled')

export function debugLog(...args: any[]) {
	if (DEBUG) {
		console.log((new Date()).toISOString().slice(11, 23), ...args)
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
		if (file.extension === 'md') {
			return true
		}
	}
	return false
}

export function isCanvasFile(file: TAbstractFile): boolean {
	if (file instanceof TFile) {
		if (file.extension === 'canvas') {
			return true
		}
	}
	return false
}

export function isPastedImage(file: TAbstractFile): boolean {
	if (file instanceof TFile) {
		if (file.name.startsWith(PASTED_IMAGE_PREFIX)) {
			return true
		}
	}
	return false
}