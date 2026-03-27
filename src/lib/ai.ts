import { RequestUrlParam, requestUrl } from "obsidian";
import { debugLog } from "./log";

/**
 * Wraps requestUrl with a timeout. Obsidian's requestUrl does not support
 * cancellation, so we use Promise.race — the HTTP request continues in the
 * background but the caller stops waiting.
 */
async function requestUrlWithTimeout(
  request: RequestUrlParam,
  timeoutMs: number
) {
  return Promise.race([
    requestUrl(request),
    new Promise<never>((_, reject) =>
      window.setTimeout(
        () => reject(new Error("AI request timed out")),
        timeoutMs
      )
    ),
  ]);
}

/**
 * Context extracted from the note surrounding the pasted image link.
 */
export interface AiContext {
  /** Title of the note (basename without extension) */
  noteTitle: string;
  /** Nearest heading above the image link, empty string if none */
  heading: string;
  /** Cleaned text surrounding the image link position */
  surroundingText: string;
  /** Base64-encoded image data (optional, for vision API) */
  imageBase64?: string;
  /** MIME type of the image (e.g. "image/png") */
  imageMimeType?: string;
  /** Parsed source app name from original filename (e.g. "Google Chrome") */
  sourceAppHint?: string;
}

/**
 * Settings for AI-powered rename functionality.
 */
export interface AiRenameSettings {
  /** Whether AI rename is enabled */
  enabled: boolean;
  /** Full API endpoint URL (e.g. "https://api.openai.com/v1/chat/completions" or ".../v1/responses") */
  apiEndpoint: string;
  /** API key for authentication */
  apiKey: string;
  /** Model name (e.g. "gpt-4o-mini") */
  model: string;
  /** Custom system prompt, empty string means use default */
  customPrompt: string;
  /** Whether to send pasted image content to vision-capable models */
  sendImageContent: boolean;
  /** Maximum image file size in MB to send (larger images fall back to text-only) */
  maxImageSizeMB: number;
  /** Request timeout in milliseconds */
  timeout: number;
}

export const DEFAULT_AI_RENAME_SETTINGS: AiRenameSettings = {
  enabled: false,
  apiEndpoint: "",
  apiKey: "",
  model: "gpt-4o-mini",
  customPrompt: "",
  sendImageContent: true,
  maxImageSizeMB: 4,
  timeout: 10000,
};

const DEFAULT_AI_PROMPT =
  "You are a file naming assistant. Generate a short filename " +
  "(2-5 words, lowercase, separated by hyphens).\n" +
  "When an image is provided, name it based on what you SEE:\n" +
  "- Prefer the most specific, searchable topic in the image\n" +
  "- For UI/app screenshots, describe the task or object shown\n" +
  "- Use app/site name only as qualifier to disambiguate\n" +
  "- If a source app hint is provided, use it to understand " +
  "the image context (e.g. 'Google Chrome' means webpage)\n" +
  "- If the image contains a long title, extract only its core topic\n" +
  "Avoid generic words: screenshot, article, blog-post, config, " +
  "image, photo, page.\n" +
  "When no image is provided, use the note context instead.\n" +
  "Do not include file extension. Output only the filename.";

// ---------------------------------------------------------------------------
// Internal helpers for dual API support (Chat Completions + Responses)
// ---------------------------------------------------------------------------

interface ApiTarget {
  url: string;
  isResponses: boolean;
}

/**
 * Resolves the user-provided endpoint URL into a concrete request URL
 * and determines which API format to use.
 *
 * - Ends with `/responses` → Responses API
 * - Ends with `/completions` → Chat Completions API
 * - Otherwise (legacy base URL like `.../v1`) → auto-append `/chat/completions`
 */
function resolveApiTarget(endpoint: string): ApiTarget {
  const trimmed = endpoint.trim();

  // Reason: Use URL.pathname to determine API format so that query strings
  // (e.g. Azure's ?api-version=...) don't break the detection.
  try {
    const parsed = new URL(trimmed);
    const pathname = parsed.pathname.replace(/\/+$/, "");

    if (pathname.endsWith("/responses")) {
      return { url: parsed.toString(), isResponses: true };
    }
    if (pathname.endsWith("/completions")) {
      return { url: parsed.toString(), isResponses: false };
    }

    // Legacy config — users who configured base URL before this change.
    parsed.pathname = `${pathname}/chat/completions`;
    return { url: parsed.toString(), isResponses: false };
  } catch {
    // Fallback for non-standard URLs that can't be parsed
    const fallback = trimmed.replace(/\/+$/, "");
    if (fallback.endsWith("/responses")) return { url: fallback, isResponses: true };
    if (fallback.endsWith("/completions")) return { url: fallback, isResponses: false };
    return { url: `${fallback}/chat/completions`, isResponses: false };
  }
}

/**
 * Builds the request body for either Chat Completions or Responses API.
 * Handles both text-only and multimodal (text + image) payloads.
 */
function buildRequestBody(
  target: ApiTarget,
  model: string,
  systemPrompt: string,
  userText: string,
  imageBase64: string | null,
  imageMimeType: string | null,
  maxTokens: number
): Record<string, unknown> {
  const dataUri = imageBase64 && imageMimeType
    ? `data:${imageMimeType};base64,${imageBase64}`
    : null;

  if (target.isResponses) {
    // Responses API format
    const contentParts: Array<Record<string, unknown>> = [
      { type: "input_text", text: userText },
    ];
    if (dataUri) {
      contentParts.push({ type: "input_image", image_url: dataUri });
    }
    return {
      model,
      instructions: systemPrompt,
      input: [{ role: "user", content: contentParts }],
      max_output_tokens: maxTokens,
      temperature: 0.3,
    };
  }

  // Chat Completions API format
  // Reason: When no image, keep content as plain string for maximum compatibility
  // with older OpenAI-compatible providers that may not support content arrays.
  const userContent = dataUri
    ? [
        { type: "text", text: userText },
        { type: "image_url", image_url: { url: dataUri } },
      ]
    : userText;

  return {
    model,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userContent },
    ],
    max_tokens: maxTokens,
    temperature: 0.3,
  };
}

/**
 * Parses the generated text from the API response.
 * For Responses API, searches through output content for the first output_text
 * rather than hardcoding array indices, for better robustness.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseResponseText(target: ApiTarget, data: any): string | null {
  if (target.isResponses) {
    // Reason: Responses API may return multiple output items with varying types.
    // Iterate to find the first text content rather than assuming [0][0].
    const outputs = data?.output;
    if (!Array.isArray(outputs)) return null;
    for (const item of outputs) {
      const contents = item?.content;
      if (!Array.isArray(contents)) continue;
      for (const part of contents) {
        if (part?.type === "output_text" && typeof part.text === "string") {
          return part.text.trim();
        }
      }
    }
    return null;
  }

  return data?.choices?.[0]?.message?.content?.trim() ?? null;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Extracts context from the note content around the image link position.
 * Finds the nearest heading above the link and surrounding paragraph text,
 * filtering out frontmatter, code blocks, and noisy link references.
 */
export function extractNoteContext(
  noteContent: string,
  linkText: string,
  noteName: string
): AiContext {
  const linkPos = noteContent.indexOf(linkText);
  // Reason: If the exact link isn't found, use end of content as a fallback
  // position so we still extract some useful context from the note.
  const position = linkPos >= 0 ? linkPos : noteContent.length;

  const textBefore = noteContent.substring(0, position);

  // Find nearest heading above the link position
  const headingMatches = textBefore.match(/^(#{1,6})\s+(.+)$/gm);
  const heading = headingMatches
    ? headingMatches[headingMatches.length - 1].replace(/^#{1,6}\s+/, "")
    : "";

  // Extract surrounding text, removing noise
  const contextStart = Math.max(0, position - 600);
  const contextEnd = Math.min(noteContent.length, position + 600);
  let rawContext = noteContent.substring(contextStart, contextEnd);

  rawContext = rawContext.replace(/^---[\s\S]*?---\s*/m, "");
  rawContext = rawContext.replace(/```[\s\S]*?```/g, "");
  rawContext = rawContext.replace(/`[^`]+`/g, "");
  rawContext = rawContext.replace(/!\[([^\]]*)\]\([^)]+\)/g, "$1");
  rawContext = rawContext.replace(/!\[\[([^\]|]+)[^\]]*\]\]/g, "$1");
  rawContext = rawContext.replace(/https?:\/\/[^\s)]+/g, "");
  rawContext = rawContext.replace(/\s+/g, " ").trim();

  const maxContextLen = 1200;
  if (rawContext.length > maxContextLen) {
    rawContext = rawContext.substring(0, maxContextLen);
  }

  return {
    noteTitle: noteName,
    heading,
    surroundingText: rawContext,
  };
}

/**
 * Calls an OpenAI-compatible API to generate a descriptive filename
 * based on the note context and optionally the image content.
 */
export async function generateAiFileName(
  settings: AiRenameSettings,
  context: AiContext
): Promise<string | null> {
  if (!settings.apiEndpoint || !settings.apiKey) {
    debugLog("generateAiFileName - missing endpoint or apiKey");
    return null;
  }

  const target = resolveApiTarget(settings.apiEndpoint);
  const systemPrompt = settings.customPrompt || DEFAULT_AI_PROMPT;
  const hasImage = !!context.imageBase64 && !!context.imageMimeType;

  // Reason: When an image is provided, it should be the primary naming source.
  // Note context is secondary — only use it if it's clearly related to the image.
  const userText = hasImage
    ? [
        "An image is attached. Name the file based on what you SEE.",
        context.sourceAppHint ? `Source app hint: ${context.sourceAppHint}` : "",
        context.heading ? `Section (reference only): ${context.heading}` : "",
      ]
        .filter(Boolean)
        .join("\n")
    : [
        `Note title: ${context.noteTitle}`,
        context.heading ? `Current section: ${context.heading}` : "",
        `Context:\n${context.surroundingText}`,
      ]
        .filter(Boolean)
        .join("\n");

  const body = buildRequestBody(
    target,
    settings.model,
    systemPrompt,
    userText,
    hasImage ? context.imageBase64! : null,
    hasImage ? context.imageMimeType! : null,
    50
  );

  debugLog("generateAiFileName - target:", target.url, "isResponses:", target.isResponses, "hasImage:", hasImage);

  const timeoutMs = settings.timeout || 10000;

  try {
    const response = await requestUrlWithTimeout({
      url: target.url,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${settings.apiKey}`,
      },
      body: JSON.stringify(body),
    }, timeoutMs);

    const data = response.json;
    const rawName = parseResponseText(target, data);
    if (!rawName) {
      debugLog("generateAiFileName - empty response from API");
      return null;
    }

    debugLog("generateAiFileName - raw AI response:", rawName);
    return sanitizeAiFileName(rawName);
  } catch (err) {
    debugLog("generateAiFileName - request failed:", err);
    return null;
  }
}

/**
 * Sanitizes an AI-generated filename into a valid slug format.
 */
export function sanitizeAiFileName(rawName: string): string | null {
  let name = rawName
    .replace(/^["'`]+|["'`]+$/g, "")
    .replace(/\.\w{1,5}$/, "")
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, "-")
    // Reason: Use Unicode-aware character class to preserve CJK/Cyrillic/Arabic
    // characters in AI-generated filenames for international users.
    .replace(/[^\p{Letter}\p{Number}-]/gu, "")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "");

  if (name.length > 60) {
    name = name.substring(0, 60).replace(/-[^-]*$/, "");
  }

  if (!/^[\p{Letter}\p{Number}]+(?:-[\p{Letter}\p{Number}]+)*$/u.test(name)) {
    debugLog("sanitizeAiFileName - invalid slug after sanitization:", name);
    return null;
  }

  return name;
}

/**
 * Tests the AI API connection with a simple request.
 */
export async function testAiConnection(
  settings: AiRenameSettings
): Promise<{ success: boolean; error?: string }> {
  if (!settings.apiEndpoint || !settings.apiKey) {
    return { success: false, error: "API endpoint and key are required" };
  }

  const target = resolveApiTarget(settings.apiEndpoint);
  const body = buildRequestBody(
    target,
    settings.model,
    "Reply briefly.",
    "Reply with: ok",
    null,
    null,
    5
  );

  const timeoutMs = settings.timeout || 10000;

  try {
    await requestUrlWithTimeout({
      url: target.url,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${settings.apiKey}`,
      },
      body: JSON.stringify(body),
    }, timeoutMs);
    return { success: true };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}
