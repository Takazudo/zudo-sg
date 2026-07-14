import { fileProviderConfig } from "virtual:composer-file-provider-config";
import { composerManifest } from "@/styleguide/data/composer-registry";
import {
  COMPOSITION_PROVIDERS,
  CompositionPersistenceError,
  loadCompositionRecord,
  validateCompositionRecord,
  type CompositionLoadOutcome,
  type CompositionPersistenceErrorCode,
  type CompositionPersistenceOperation,
  type CompositionRecord,
  type CompositionStore,
  type CompositionSummary,
} from "../../library";
import { createManifest, type ComponentManifest } from "../../model/types";
import { generateJsx } from "../../source/generate-jsx";
import type {
  ComposerFileProviderConfig,
  ComposerFileProviderErrorPayload,
} from "./types";

const MAX_REPAIR_ROUNDS = 1_024;

type Operation = CompositionPersistenceOperation;

type SuccessResponse<T> = { ok: true; result: T };
type ErrorResponse = {
  ok: false;
  error: ComposerFileProviderErrorPayload;
  record?: unknown;
};

function isProtocolResponse<T>(value: unknown): value is SuccessResponse<T> | ErrorResponse {
  if (typeof value !== "object" || value === null || !("ok" in value)) return false;
  if (value.ok === true) return "result" in value;
  if (value.ok !== false || !("error" in value)) return false;
  const error = value.error;
  return typeof error === "object"
    && error !== null
    && "code" in error
    && typeof error.code === "string"
    && "message" in error
    && typeof error.message === "string"
    && (!("operation" in error) || typeof error.operation === "string");
}

function persistenceError(
  operation: Operation,
  code: CompositionPersistenceErrorCode,
  message: string,
  retryable: boolean,
  cause?: unknown,
): CompositionPersistenceError {
  return new CompositionPersistenceError(
    operation,
    code,
    message,
    retryable,
    cause === undefined ? undefined : { cause },
  );
}

function normalizeErrorCode(value: string): CompositionPersistenceErrorCode {
  switch (value) {
    case "unavailable":
    case "blocked":
    case "unsupported-version":
    case "validation":
    case "read-failed":
    case "write-failed":
    case "transaction-failed":
    case "conflict":
      return value;
    default:
      return "unknown";
  }
}

function isRetryable(code: CompositionPersistenceErrorCode): boolean {
  return code === "unavailable"
    || code === "read-failed"
    || code === "write-failed"
    || code === "transaction-failed"
    || code === "unknown";
}

function diagnosticsMessage(record: CompositionRecord, count: number): string {
  return `Could not generate production JSX for composition "${record.id}" (${count} diagnostic${count === 1 ? "" : "s"}). Resolve unsupported or invalid nodes before saving.`;
}

/**
 * Browser half of the dev-only file provider. Construct this through
 * `createFileProviderCompositionStore()` so production builds, whose virtual
 * config is `undefined`, cannot surface a usable file provider.
 */
class BrowserFileProviderCompositionStore implements CompositionStore {
  readonly provider = COMPOSITION_PROVIDERS.files;

  constructor(
    private readonly config: ComposerFileProviderConfig,
    private readonly manifest: ComponentManifest,
    private readonly fetchImpl: typeof fetch,
  ) {}

  async list(): Promise<readonly CompositionSummary[]> {
    return this.readWithRepair<readonly CompositionSummary[]>("list");
  }

  async get(id: string): Promise<CompositionLoadOutcome> {
    return this.readWithRepair<CompositionLoadOutcome>("get", id, (result) =>
      this.decodeGetResult(result, id),
    );
  }

  async put(record: CompositionRecord): Promise<void> {
    const validation = validateCompositionRecord(record);
    if (!validation.ok) {
      throw persistenceError("put", "validation", validation.issue.message, false);
    }
    const generated = generateJsx(validation.record.document, this.manifest);
    if (!generated.ok) {
      throw persistenceError(
        "put",
        "validation",
        diagnosticsMessage(validation.record, generated.diagnostics.opaqueIds.length),
        false,
      );
    }
    await this.request<null>("put", { record: validation.record, jsx: generated.code });
  }

  async delete(id: string): Promise<boolean> {
    return this.request<boolean>("delete", { id });
  }

  async clear(): Promise<void> {
    await this.request<null>("clear");
  }

  private async readWithRepair<T>(
    operation: "list" | "get",
    id?: string,
    decodeResult: (result: T) => T = (result) => result,
  ): Promise<T> {
    const jsxById: Record<string, string> = Object.create(null);
    for (let round = 0; round < MAX_REPAIR_ROUNDS; round += 1) {
      const response = await this.fetchJson<T>(operation, {
        ...(id === undefined ? {} : { id }),
        jsxById,
      });
      if (response.ok) return decodeResult(response.result);
      if (response.error.code !== "jsx-required") {
        throw this.fromServerError(operation, response.error);
      }

      const validation = validateCompositionRecord(response.record);
      if (!validation.ok) {
        throw persistenceError(
          operation,
          "validation",
          "The file provider returned an invalid canonical record for JSX repair.",
          false,
        );
      }
      if (jsxById[validation.record.id] !== undefined) {
        throw persistenceError(
          operation,
          "conflict",
          `The file provider repeatedly requested JSX for composition "${validation.record.id}".`,
          true,
        );
      }
      const generated = generateJsx(validation.record.document, this.manifest);
      if (!generated.ok) {
        throw persistenceError(
          operation,
          "validation",
          diagnosticsMessage(validation.record, generated.diagnostics.opaqueIds.length),
          false,
        );
      }
      jsxById[validation.record.id] = generated.code;
    }
    throw persistenceError(
      operation,
      "conflict",
      "File-provider repair did not converge. Reduce the number of compositions and retry.",
      true,
    );
  }

  /**
   * The development endpoint is a persistence boundary too. Decode a loaded
   * record again rather than trusting the transport's claimed schema, so an
   * older server response has the same v1 → v2 outcome as every other reader.
   */
  private decodeGetResult(result: CompositionLoadOutcome, requestedId: string): CompositionLoadOutcome {
    if (result.status !== "loaded") return result;
    const decoded = loadCompositionRecord(result.record);
    if (decoded.status !== "loaded") return decoded;
    if (decoded.record.id !== requestedId) {
      throw persistenceError(
        "get",
        "conflict",
        "The file provider returned a composition whose id does not match the requested id.",
        true,
      );
    }
    return decoded;
  }

  private async request<T>(operation: Operation, fields: Record<string, unknown> = {}): Promise<T> {
    const response = await this.fetchJson<T>(operation, fields);
    if (response.ok) return response.result;
    throw this.fromServerError(operation, response.error);
  }

  private async fetchJson<T>(
    operation: Operation,
    fields: Record<string, unknown>,
  ): Promise<SuccessResponse<T> | ErrorResponse> {
    let response: Response;
    try {
      response = await this.fetchImpl(this.config.endpoint, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          [this.config.capabilityHeader]: this.config.capability,
        },
        body: JSON.stringify({ operation, ...fields }),
        cache: "no-store",
        credentials: "same-origin",
      });
    } catch (cause) {
      throw persistenceError(
        operation,
        "unavailable",
        "The development file provider is unavailable. Confirm `pnpm dev` is running and retry.",
        true,
        cause,
      );
    }

    const mediaType = response.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase();
    if (mediaType !== "application/json") {
      throw persistenceError(
        operation,
        "unknown",
        "The development file provider returned a non-JSON response.",
        true,
      );
    }

    let payload: unknown;
    try {
      payload = await response.json();
    } catch (cause) {
      throw persistenceError(
        operation,
        "unknown",
        "The development file provider returned malformed JSON.",
        true,
        cause,
      );
    }
    if (!isProtocolResponse<T>(payload)) {
      throw persistenceError(
        operation,
        "unknown",
        "The development file provider returned an invalid response.",
        true,
      );
    }
    return payload;
  }

  private fromServerError(
    operation: Operation,
    error: ComposerFileProviderErrorPayload,
  ): CompositionPersistenceError {
    const code = normalizeErrorCode(error.code);
    return persistenceError(operation, code, error.message, isRetryable(code));
  }
}

export interface CreateFileProviderCompositionStoreOptions {
  /** Defaults to the real serializable production Composer manifest. */
  manifest?: ComponentManifest;
  /** Test seam; production callers use globalThis.fetch. */
  fetch?: typeof fetch;
}

/**
 * Returns the file store only when the dev virtual capability exists.
 * Production builds resolve the virtual module to `undefined`, leaving
 * IndexedDB as the only available provider.
 */
export function createFileProviderCompositionStore(
  options: CreateFileProviderCompositionStoreOptions = {},
): CompositionStore | undefined {
  if (fileProviderConfig === undefined) return undefined;
  return new BrowserFileProviderCompositionStore(
    fileProviderConfig,
    options.manifest ?? createManifest(composerManifest),
    options.fetch ?? globalThis.fetch.bind(globalThis),
  );
}
