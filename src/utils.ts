const fs = require("fs").promises;

export const blobToArrayBuffer = (blob: Blob) => {
	return new Promise((resolve) => {
		const reader = new FileReader();
		reader.onloadend = () => resolve(reader.result);
		reader.readAsArrayBuffer(blob);
	});
};

export async function copyFromDisk(src: string, dest: string): Promise<any> {
	try {
		await fs.copyFile(src, dest, (err: Error) => {
			if (err) throw err;
			console.log(src + " copied to " + dest);
		});
		return dest;
	} catch (e) {
		return null;
	}
}
