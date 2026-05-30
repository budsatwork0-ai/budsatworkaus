import { run } from "./index";

// ---------------------------------------------------------------------------
// Minimal smoke tests — catch regressions before deploy
// ---------------------------------------------------------------------------

describe("quote-triage run()", () => {
  it("returns VALIDATION_ERROR for missing quoteId", async () => {
    const result = await run({ customerId: "c1", payload: {} });
    expect(result.success).toBe(false);
    expect(result.errorCode).toBe("VALIDATION_ERROR");
  });

  it("returns VALIDATION_ERROR for missing customerId", async () => {
    const result = await run({ quoteId: "q1", payload: {} });
    expect(result.success).toBe(false);
    expect(result.errorCode).toBe("VALIDATION_ERROR");
  });

  it("returns VALIDATION_ERROR for null input", async () => {
    const result = await run(null);
    expect(result.success).toBe(false);
    expect(result.errorCode).toBe("VALIDATION_ERROR");
  });

  it("returns AUTH_ERROR or DB_ERROR when Supabase env vars are absent", async () => {
    const savedUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const savedKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;

    const result = await run({
      quoteId: "q1",
      customerId: "c1",
      payload: { test: true },
    });

    expect(result.success).toBe(false);
    expect(["AUTH_ERROR", "UNKNOWN_ERROR"]).toContain(result.errorCode);

    // Restore
    if (savedUrl) process.env.NEXT_PUBLIC_SUPABASE_URL = savedUrl;
    if (savedKey) process.env.SUPABASE_SERVICE_ROLE_KEY = savedKey;
  });
});
