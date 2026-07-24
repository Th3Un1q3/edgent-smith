import { describe, it, expect, beforeEach, afterEach } from "vitest"
import * as fs from "node:fs"
import * as os from "node:os"
import path from "node:path"

import {
  SessionStorage,
  FileSystemSessionStorageAdapter,
  SESSION_FIELDS,
} from "@plugins/helpers/kv-store"

describe("SESSION_FIELDS", () => {
  it("exposes all expected field keys", () => {
    expect(SESSION_FIELDS.startedAt).toBe("startedAt")
    expect(SESSION_FIELDS.cancelledAt).toBe("cancelledAt")
    expect(SESSION_FIELDS.lastMessageSentAt).toBe("lastMessageSentAt")
    expect(SESSION_FIELDS.idleAt).toBe("idleAt")
    expect(SESSION_FIELDS.toolCalls).toBe("toolCalls")
    expect(SESSION_FIELDS.agent).toBe("agent")
    expect(SESSION_FIELDS.needsReview).toBe("needsReview")
  })
})

describe("FileSystemSessionStorageAdapter", () => {
  let temporaryDirectory: string

  beforeEach(() => {
    temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "kv-store-test-"))
  })

  afterEach(() => {
    fs.rmSync(temporaryDirectory, { recursive: true, force: true })
  })

  it("uses default basePath when none provided", () => {
    const adapter = new FileSystemSessionStorageAdapter()
    // The default path is ".opencode/plugins/sessions"
    // Verify it constructs without error
    expect(adapter).toBeInstanceOf(FileSystemSessionStorageAdapter)
    // read on non-existent file should return undefined
    const result = adapter.read("non-existent-default")
    expect(result).toBeUndefined()
  })

  describe("read()", () => {
    it("returns parsed state when file exists and has valid JSON", () => {
      const adapter = new FileSystemSessionStorageAdapter(temporaryDirectory)
      const sessionId = "ses-read-valid"

      fs.mkdirSync(temporaryDirectory, { recursive: true })
      fs.writeFileSync(path.join(temporaryDirectory, `${sessionId}.json`), JSON.stringify({ key: "value" }), "utf8")

      const result = adapter.read(sessionId)
      expect(result).toEqual({ key: "value" })
    })

    it("returns empty object when file exists but is empty", () => {
      const adapter = new FileSystemSessionStorageAdapter(temporaryDirectory)
      const sessionId = "ses-read-empty"

      fs.mkdirSync(temporaryDirectory, { recursive: true })
      fs.writeFileSync(path.join(temporaryDirectory, `${sessionId}.json`), "", "utf8")

      const result = adapter.read(sessionId)
      expect(result).toEqual({})
    })

    it("returns empty object when file exists but contains only whitespace", () => {
      const adapter = new FileSystemSessionStorageAdapter(temporaryDirectory)
      const sessionId = "ses-read-whitespace"

      fs.mkdirSync(temporaryDirectory, { recursive: true })
      fs.writeFileSync(path.join(temporaryDirectory, `${sessionId}.json`), "   \n  ", "utf8")

      const result = adapter.read(sessionId)
      expect(result).toEqual({})
    })

    it("returns undefined when file does not exist", () => {
      const adapter = new FileSystemSessionStorageAdapter(temporaryDirectory)
      const result = adapter.read("non-existent-session")
      expect(result).toBeUndefined()
    })

    it("returns undefined when file contains invalid JSON", () => {
      const adapter = new FileSystemSessionStorageAdapter(temporaryDirectory)
      const sessionId = "ses-read-invalid"

      fs.mkdirSync(temporaryDirectory, { recursive: true })
      fs.writeFileSync(path.join(temporaryDirectory, `${sessionId}.json`), "{invalid json", "utf8")

      const result = adapter.read(sessionId)
      expect(result).toBeUndefined()
    })
  })

  describe("write()", () => {
    it("writes state to a new file", () => {
      const adapter = new FileSystemSessionStorageAdapter(temporaryDirectory)
      const sessionId = "ses-write-new"

      adapter.write(sessionId, { foo: "bar", num: 42 })

      const filePath = path.join(temporaryDirectory, `${sessionId}.json`)
      expect(fs.existsSync(filePath)).toBe(true)

      const raw = fs.readFileSync(filePath, "utf8")
      const parsed = JSON.parse(raw)
      expect(parsed).toEqual({ foo: "bar", num: 42 })
    })

    it("overwrites existing file with new state", () => {
      const adapter = new FileSystemSessionStorageAdapter(temporaryDirectory)
      const sessionId = "ses-write-overwrite"

      // Create initial file
      fs.mkdirSync(temporaryDirectory, { recursive: true })
      fs.writeFileSync(path.join(temporaryDirectory, `${sessionId}.json`), JSON.stringify({ old: true }), "utf8")

      adapter.write(sessionId, { new: "data" })

      const raw = fs.readFileSync(path.join(temporaryDirectory, `${sessionId}.json`), "utf8")
      const parsed = JSON.parse(raw)
      expect(parsed).toEqual({ new: "data" })
    })

    it("creates parent directory if it does not exist", () => {
      // Use a deeper nested temp dir that doesn't exist yet
      const deepDirectory = path.join(temporaryDirectory, "deep", "nest")
      const adapter = new FileSystemSessionStorageAdapter(deepDirectory)

      expect(fs.existsSync(deepDirectory)).toBe(false)
      adapter.write("ses-deep", { nested: true })
      expect(fs.existsSync(deepDirectory)).toBe(true)
      expect(fs.existsSync(path.join(deepDirectory, "ses-deep.json"))).toBe(true)
    })
  })
})

describe("SessionStorage", () => {
  let temporaryDirectory: string
  let adapter: FileSystemSessionStorageAdapter
  let storage: SessionStorage

  beforeEach(() => {
    temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "kv-store-test-"))
    adapter = new FileSystemSessionStorageAdapter(temporaryDirectory)
    storage = new SessionStorage(adapter)
  })

  afterEach(() => {
    fs.rmSync(temporaryDirectory, { recursive: true, force: true })
  })

  describe("reset()", () => {
    it("throws an error indicating it is not implemented", () => {
      expect(() => SessionStorage.reset()).toThrow("Method not implemented.")
    })
  })

  describe("constructor", () => {
    it("creates a SessionStorage with default adapter when none provided", () => {
      const defaultStorage = new SessionStorage()
      // readState on non-existent session returns undefined with default adapter
      const result = defaultStorage.readState("non-existent-default", (state) => state)
      expect(result).toBeUndefined()
    })
  })

  describe("readState()", () => {
    it("returns reader result when state exists", () => {
      const sessionId = "ses-reader-exists"
      adapter.write(sessionId, { count: 5, name: "test" })

      const result = storage.readState<
        { count: number; name: string },
        { doubled: number; upperName: string }
      >(sessionId, (state) => ({
        doubled: state.count * 2,
        upperName: state.name.toUpperCase(),
      }))

      expect(result).toEqual({ doubled: 10, upperName: "TEST" })
    })

    it("returns undefined when state does not exist", () => {
      const result = storage.readState("non-existent", (state) => state)
      expect(result).toBeUndefined()
    })
  })

  describe("updateState()", () => {
    it("creates new state when session does not exist by calling updater with empty object", () => {
      const result = storage.updateState<{ initialized: boolean }, { initialized: boolean }>(
        "ses-new",
        () => ({ initialized: true })
      )

      expect(result).toEqual({ initialized: true })

      // Verify persistence
      const persisted = adapter.read("ses-new")
      expect(persisted).toEqual({ initialized: true })
    })

    it("merges updater result with existing state", () => {
      // Pre-populate state
      adapter.write("ses-update", { existing: "value", count: 1 })

      const result = storage.updateState<{ existing: string; count: number; added: string }, { existing: string; count: number; added: string }>(
        "ses-update",
        (current) => ({ ...current, count: current.count + 1, added: "new" })
      )

      expect(result).toEqual({ existing: "value", count: 2, added: "new" })

      // Verify persistence
      const persisted = adapter.read("ses-update")
      expect(persisted).toEqual({ existing: "value", count: 2, added: "new" })
    })

    it("returns updater result for chaining", () => {
      const result = storage.updateState<{ step: number }, number>(
        "ses-chain",
        () => 42
      )

      expect(result).toBe(42)
    })
  })
})
