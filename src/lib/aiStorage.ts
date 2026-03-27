import { debugLog } from "./log";

/**
 * Record of an AI-generated attachment name.
 * Uses md5 + sourcePath as composite key to handle same-content
 * images in different notes having different AI names.
 */
export interface AiNameRecord {
  /** MD5 hash of the attachment file content */
  md5: string;
  /** Path of the source note that contains this attachment */
  sourcePath: string;
  /** AI-generated basename (without extension) */
  name: string;
}

/**
 * Saves an AI-generated name to storage. If a record with the same
 * md5 + sourcePath already exists, it is replaced.
 */
export function saveAiName(
  storage: AiNameRecord[],
  record: AiNameRecord
): void {
  // Remove existing record with same composite key
  const existingIdx = storage.findIndex(
    (r) => r.md5 === record.md5 && r.sourcePath === record.sourcePath
  );
  if (existingIdx >= 0) {
    storage.splice(existingIdx, 1);
  }
  storage.push(record);
  debugLog("saveAiName - saved:", record);
}

/**
 * Loads an AI-generated name from storage by md5 + sourcePath.
 * Returns the name string if found, undefined otherwise.
 */
export function loadAiName(
  storage: AiNameRecord[],
  md5: string,
  sourcePath: string
): string | undefined {
  const record = storage.find(
    (r) => r.md5 === md5 && r.sourcePath === sourcePath
  );
  return record?.name;
}

/**
 * Migrates AI name records when a source note is renamed.
 * Updates all records matching oldPath to use newPath.
 */
export function migrateAiNamePath(
  storage: AiNameRecord[],
  oldPath: string,
  newPath: string
): void {
  let migrated = 0;
  for (const record of storage) {
    if (record.sourcePath === oldPath) {
      record.sourcePath = newPath;
      migrated++;
    }
  }
  if (migrated > 0) {
    debugLog("migrateAiNamePath - migrated", migrated, "records from", oldPath, "to", newPath);
  }
}

/**
 * Removes AI name records whose sourcePath no longer exists
 * in the provided set of valid note paths.
 */
export function cleanupAiNameStorage(
  storage: AiNameRecord[],
  validNotePaths: Set<string>
): AiNameRecord[] {
  return storage.filter((r) => validNotePaths.has(r.sourcePath));
}
