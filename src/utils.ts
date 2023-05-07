const fs = require('fs').promises;


export const blobToArrayBuffer = (blob: Blob) => {
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onloadend = () => resolve(reader.result)
    reader.readAsArrayBuffer(blob)
  })
}

//https://stackoverflow.com/questions/26156292/trim-specific-character-from-a-string
export function trimAny(str: string, chars: Array<string>) {
  var start = 0,
    end = str.length;

  while (start < end && chars.indexOf(str[start]) >= 0)
    ++start;

  while (end > start && chars.indexOf(str[end - 1]) >= 0)
    --end;

  return (start > 0 || end < str.length) ? str.substring(start, end) : str;
}

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