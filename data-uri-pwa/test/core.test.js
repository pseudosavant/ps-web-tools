import { describe, expect, it } from "vitest";

import {
  bytesToBase64,
  createRevisionTracker,
  formatBytes,
  getPreviewKind,
  normalizeMimeType,
  textToDataURI
} from "../core.js";

describe("textToDataURI", () => {
  it("encodes ASCII text", () => {
    expect(textToDataURI("Hello")).toEqual({
      uri: "data:text/plain;charset=utf-8;base64,SGVsbG8=",
      size: 5
    });
  });

  it("encodes Unicode as UTF-8", () => {
    expect(textToDataURI("Hello 🌍")).toEqual({
      uri: "data:text/plain;charset=utf-8;base64,SGVsbG8g8J+MjQ==",
      size: 10
    });
  });

  it("encodes byte arrays larger than one conversion chunk", () => {
    const bytes = new Uint8Array(0x8000 + 17).fill(97);
    const encoded = bytesToBase64(bytes);

    expect(encoded.length).toBe(Math.ceil(bytes.length / 3) * 4);
    expect(atob(encoded)).toHaveLength(bytes.length);
  });
});

describe("normalizeMimeType", () => {
  it("removes parameters, whitespace, and casing", () => {
    expect(normalizeMimeType("  Text/Plain; Charset=UTF-8 ")).toBe("text/plain");
  });

  it("handles missing values", () => {
    expect(normalizeMimeType()).toBe("");
  });
});

describe("getPreviewKind", () => {
  it.each([
    "image/apng",
    "image/gif",
    "image/jpeg",
    "image/png",
    "image/webp"
  ])("allows broadly supported browser image format %s", type => {
    expect(getPreviewKind(type)).toBe("image");
  });

  it.each([
    "image/avif",
    "image/bmp",
    "image/vnd.microsoft.icon",
    "image/x-icon"
  ])("does not render less portable image format %s", type => {
    expect(getPreviewKind(type)).toBe("unsupported");
  });

  it.each([
    "text/plain",
    "text/html",
    "application/json",
    "application/problem+json",
    "application/xml",
    "image/svg+xml"
  ])("shows active or textual format %s as escaped text", type => {
    expect(getPreviewKind(type)).toBe("text");
  });

  it.each(["audio/mpeg", "audio/ogg", "audio/webm"])("allows audio format %s", type => {
    expect(getPreviewKind(type)).toBe("audio");
  });

  it.each(["video/mp4", "video/ogg", "video/webm"])("allows video format %s", type => {
    expect(getPreviewKind(type)).toBe("video");
  });

  it.each([
    "application/octet-stream",
    "application/pdf",
    "application/zip",
    "font/woff2"
  ])("blocks binary or document format %s", type => {
    expect(getPreviewKind(type)).toBe("unsupported");
  });
});

describe("formatBytes", () => {
  it.each([
    [0, "0 B"],
    [999, "999 B"],
    [1024, "1.0 KB"],
    [10 * 1024, "10 KB"],
    [5.5 * 1024 * 1024, "5.5 MB"]
  ])("formats %d bytes as %s", (bytes, expected) => {
    expect(formatBytes(bytes)).toBe(expected);
  });
});

describe("createRevisionTracker", () => {
  it("invalidates older work whenever a newer operation starts", () => {
    const revisions = createRevisionTracker();
    const first = revisions.next();
    const second = revisions.next();

    expect(revisions.current()).toBe(second);
    expect(revisions.isCurrent(first)).toBe(false);
    expect(revisions.isCurrent(second)).toBe(true);
  });
});
