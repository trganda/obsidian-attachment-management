import { TFolder } from "obsidian";
import { debugLog } from "./log";
import { path } from "./path";

export interface NameObj {
    name: string;
    basename: string;
    extension: string;
}

// ref: https://stackoverflow.com/a/6969486/596206
function escapeRegExp(s: string) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function deduplicateNewName(newName: string, file: TFolder): Promise<NameObj> {
    // list files in dir
    const dir = file.path;
    const listed = await this.app.vault.adapter.list(dir);
    debugLog("deduplicateNewName - sibling files", listed);

    // parse newName
    const newNameExt = path.extname(newName),
        newNameStem = newName.slice(0, newName.length - newNameExt.length - 1),
        newNameStemEscaped = escapeRegExp(newNameStem),
        delimiter = "-",
        delimiterEscaped = escapeRegExp(delimiter);

    const dupNameRegex = new RegExp(
        `^(?<name>${newNameStemEscaped})${delimiterEscaped}(?<number>\\d{1,3})\\.${newNameExt}$`
    );

    debugLog("dupNameRegex", dupNameRegex);

    const dupNameNumbers: number[] = [];
    let isNewNameExist = false;
    // match dupNames and update the number
    for (let sibling of listed.files) {
        sibling = path.basename(sibling);
        if (sibling == newName) {
            isNewNameExist = true;
            continue;
        }

        // match dupNames
        const m = dupNameRegex.exec(sibling);
        if (!m || m.groups === undefined) continue;
        // parse int for m.groups.number
        dupNameNumbers.push(parseInt(m.groups.number));
    }

    if (isNewNameExist) {
        // get max number
        const newNumber = dupNameNumbers.length > 0 ? Math.max(...dupNameNumbers) + 1 : 1;
        // change newName
        newName = `${newNameStem}${delimiter}${newNumber}.${newNameExt}`;
    }

    return {
        name: newName,
        basename: newName.slice(0, newName.length - newNameExt.length - 1),
        extension: newNameExt,
    };
}
