"use strict";

process.env.NODE_ENV = "test";
process.env.LOG_LEVEL = "silent";

const {
  isValidZone,
  isValidStall,
  isValidMode,
  sanitizeItems,
  sanitizeUserId,
} = require("../src/middleware/validate");

const { requireAdminKey } = require("../src/middleware/auth");

// ─── Input validation ─────────────────────────────────────────────────────────

describe("isValidZone()", () => {
  test("accepts valid zone IDs A–H", () => {
    ["A", "B", "C", "D", "E", "F", "G", "H"].forEach((id) =>
      expect(isValidZone(id)).toBe(true),
    );
  });
  test("rejects unknown zone ID", () => expect(isValidZone("Z")).toBe(false));
  test("rejects number input", () => expect(isValidZone(1)).toBe(false));
  test("rejects null", () => expect(isValidZone(null)).toBe(false));
  test("rejects empty string", () => expect(isValidZone("")).toBe(false));
  test("rejects SQL injection", () =>
    expect(isValidZone("A'; DROP TABLE zones--")).toBe(false));
  test("rejects object input", () =>
    expect(isValidZone({ id: "A" })).toBe(false));
});

describe("isValidStall()", () => {
  test("accepts valid stall IDs s1–s4", () => {
    ["s1", "s2", "s3", "s4"].forEach((id) =>
      expect(isValidStall(id)).toBe(true),
    );
  });
  test("rejects unknown stall", () => expect(isValidStall("s99")).toBe(false));
  test("rejects null", () => expect(isValidStall(null)).toBe(false));
  test("rejects empty string", () => expect(isValidStall("")).toBe(false));
});

describe("isValidMode()", () => {
  test("accepts all valid modes", () => {
    ["normal", "pre_match", "halftime", "exit_rush"].forEach((m) =>
      expect(isValidMode(m)).toBe(true),
    );
  });
  test("rejects unknown mode", () => expect(isValidMode("chaos")).toBe(false));
  test("rejects __proto__", () => expect(isValidMode("__proto__")).toBe(false));
  test("rejects constructor", () =>
    expect(isValidMode("constructor")).toBe(false));
  test("rejects number", () => expect(isValidMode(1)).toBe(false));
});

describe("sanitizeItems()", () => {
  test("returns cleaned array for valid input", () => {
    const result = sanitizeItems(["1x Burger", "2x Fries"]);
    expect(result).toEqual(["1x Burger", "2x Fries"]);
  });

  test("strips < > \" ' characters", () => {
    const result = sanitizeItems(["<script>alert(1)</script>"]);
    expect(result[0]).not.toContain("<");
    expect(result[0]).not.toContain(">");
  });

  test("returns null for empty array", () =>
    expect(sanitizeItems([])).toBeNull());

  test("returns null for array > 20 items", () => {
    const big = Array.from({ length: 21 }, (_, i) => `item_${i}`);
    expect(sanitizeItems(big)).toBeNull();
  });

  test("returns null for non-array", () => {
    expect(sanitizeItems("string")).toBeNull();
    expect(sanitizeItems(null)).toBeNull();
    expect(sanitizeItems(42)).toBeNull();
  });

  test("filters out non-string entries", () => {
    const result = sanitizeItems(["valid item", 42, null, "another item"]);
    expect(result).toEqual(["valid item", "another item"]);
  });

  test("trims whitespace from items", () => {
    const result = sanitizeItems(["  Burger  ", "  Fries  "]);
    expect(result).toEqual(["Burger", "Fries"]);
  });

  test("returns null if all items are invalid", () => {
    expect(sanitizeItems([42, null, true])).toBeNull();
  });
});

describe("sanitizeUserId()", () => {
  test("returns trimmed userId for valid input", () => {
    expect(sanitizeUserId("fan_001")).toBe("fan_001");
  });

  test("strips < > \" ' from userId", () => {
    const result = sanitizeUserId("<script>hack</script>");
    expect(result).not.toContain("<");
    expect(result).not.toContain(">");
  });

  test("returns guest for null", () =>
    expect(sanitizeUserId(null)).toBe("guest"));
  test("returns guest for number", () =>
    expect(sanitizeUserId(42)).toBe("guest"));
  test("returns guest for empty after trim", () =>
    expect(sanitizeUserId("   ")).toBe("guest"));
  test("returns guest for string > 64 chars", () => {
    const long = "a".repeat(65);
    expect(sanitizeUserId(long)).toBe("guest");
  });
});

// ─── Auth middleware ──────────────────────────────────────────────────────────

describe("requireAdminKey()", () => {
  const mockReq = (headers = {}) => ({
    headers,
    ip: "127.0.0.1",
    path: "/api/simulate",
  });
  const mockRes = () => {
    const r = { status: jest.fn(), json: jest.fn() };
    r.status.mockReturnValue(r);
    return r;
  };

  const config = require("../src/config");

  afterEach(() => {
    config.ADMIN_API_KEY = null;
    requireAdminKey._warned = false;
  });

  test("returns 500 when ADMIN_API_KEY not set (fail closed)", () => {
    config.ADMIN_API_KEY = null;
    const res = mockRes();
    const next = jest.fn();
    requireAdminKey(mockReq({}), res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(500);
  });

  test("returns 401 when key required but header missing", () => {
    config.ADMIN_API_KEY = "secret-key-32-chars-xxxxxxxxxxxxxxxxx";
    const res = mockRes();
    const next = jest.fn();
    requireAdminKey(mockReq({}), res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
  });

  test("returns 403 for wrong key", () => {
    config.ADMIN_API_KEY = "correct-key-32-chars-xxxxxxxxxxxxxxxxx";
    const res = mockRes();
    const next = jest.fn();
    requireAdminKey(mockReq({ "x-admin-key": "wrong-key" }), res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
  });

  test("calls next() for correct key", () => {
    const key = "my-secret-key-32-chars-xxxxxxxxxxxxxxxx";
    config.ADMIN_API_KEY = key;
    const next = jest.fn();
    requireAdminKey(mockReq({ "x-admin-key": key }), mockRes(), next);
    expect(next).toHaveBeenCalled();
  });

  test("rejects key with wrong length (timing-safe check)", () => {
    config.ADMIN_API_KEY = "short";
    const res = mockRes();
    const next = jest.fn();
    requireAdminKey(
      mockReq({ "x-admin-key": "short-but-different" }),
      res,
      next,
    );
    expect(next).not.toHaveBeenCalled();
  });
});

// ─── catchAsync ───────────────────────────────────────────────────────────────
describe("catchAsync()", () => {
  const catchAsync = require("../src/middleware/catchAsync");

  test("calls next(err) when async handler throws", async () => {
    const err = new Error("async failure");
    const fn = catchAsync(async () => {
      throw err;
    });
    const next = jest.fn();
    await fn({}, {}, next);
    expect(next).toHaveBeenCalledWith(err);
  });

  test("calls next(err) when async handler rejects a promise", async () => {
    const fn = catchAsync(() => Promise.reject(new Error("rejected")));
    const next = jest.fn();
    await fn({}, {}, next);
    expect(next).toHaveBeenCalled();
    expect(next.mock.calls[0][0].message).toBe("rejected");
  });

  test("does NOT call next when handler resolves successfully", async () => {
    const res = { json: jest.fn() };
    const fn = catchAsync(async (_req, res) => {
      res.json({ ok: true });
    });
    const next = jest.fn();
    await fn({}, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({ ok: true });
  });

  test("passes req, res, next to the wrapped handler", async () => {
    const mockReq = { body: "test" };
    const mockRes = { json: jest.fn() };
    const mockNext = jest.fn();
    const fn = catchAsync(async (req, res, next) => {
      expect(req).toBe(mockReq);
      expect(res).toBe(mockRes);
      expect(next).toBe(mockNext);
    });
    await fn(mockReq, mockRes, mockNext);
    expect(mockNext).not.toHaveBeenCalled();
  });
});
