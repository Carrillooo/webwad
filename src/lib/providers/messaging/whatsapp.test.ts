import { describe, it, expect } from "vitest";
import { verifyWebhook, parseIncoming } from "./whatsapp";

describe("WhatsApp webhook", () => {
  it("verifies the subscription handshake with the right token", () => {
    // vitest.config sets WHATSAPP_VERIFY_TOKEN = "verify-token-test".
    expect(verifyWebhook("subscribe", "verify-token-test", "challenge123")).toBe("challenge123");
    expect(verifyWebhook("subscribe", "wrong", "challenge123")).toBeNull();
    expect(verifyWebhook("unsubscribe", "verify-token-test", "x")).toBeNull();
  });

  it("parses inbound text messages, ignoring non-text", () => {
    const payload = {
      entry: [
        {
          changes: [
            {
              value: {
                messages: [
                  { from: "34600111222", id: "wamid.1", type: "text", text: { body: "Reunión el viernes a las 5" } },
                  { from: "34600111222", id: "wamid.2", type: "image" },
                ],
              },
            },
          ],
        },
      ],
    };
    const msgs = parseIncoming(payload);
    expect(msgs).toHaveLength(1);
    expect(msgs[0].text).toContain("viernes");
    expect(msgs[0].from).toBe("34600111222");
  });

  it("returns empty for malformed payloads", () => {
    expect(parseIncoming({})).toEqual([]);
    expect(parseIncoming(null)).toEqual([]);
  });
});
