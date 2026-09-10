import { describe, it, expect, afterEach, vi } from "vitest";
import { sendWhatsAppText, sendWhatsAppDocument } from "./whatsapp";

const ENV_KEYS = [
  "WHATSAPP_ENABLED",
  "WHATSAPP_SIMULATE",
  "WHATSAPP_PHONE_NUMBER_ID",
  "WHATSAPP_ACCESS_TOKEN",
];

afterEach(() => {
  for (const k of ENV_KEYS) delete process.env[k];
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("WhatsApp — sem fallback silencioso de simulação", () => {
  it("credencial ausente e sem WHATSAPP_SIMULATE → FALHA real, nunca simulado", async () => {
    const r = await sendWhatsAppText({ to: "5541999998888", body: "oi" });
    expect(r.ok).toBe(false);
    expect(r.simulated).toBeFalsy();
    expect(r.error).toMatch(/não configurado/i);
    const d = await sendWhatsAppDocument({
      to: "5541999998888",
      link: "https://x/y.pdf",
      filename: "y.pdf",
    });
    expect(d.ok).toBe(false);
    expect(d.simulated).toBeFalsy();
  });

  it("WHATSAPP_SIMULATE=true → simula (uso local/testes)", async () => {
    process.env.WHATSAPP_SIMULATE = "true";
    const r = await sendWhatsAppText({ to: "5541999998888", body: "oi" });
    expect(r.ok).toBe(true);
    expect(r.simulated).toBe(true);
  });

  it("credencial por empresa presente → chama a Graph API real e devolve o message_id", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ messages: [{ id: "wamid.REAL123" }] }),
    });
    vi.stubGlobal("fetch", fetchMock);
    const r = await sendWhatsAppText({
      to: "5541999998888",
      body: "oi",
      phoneNumberId: "1393575343830978",
      accessToken: "tok_real",
    });
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(String(fetchMock.mock.calls[0][0])).toContain("graph.facebook.com");
    expect(r).toEqual({ ok: true, providerMessageId: "wamid.REAL123" });
  });

  it("Graph API retorna erro → repassa o erro real da Meta, sem simular", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({ error: { message: "Error validating access token" } }),
      }),
    );
    const r = await sendWhatsAppText({
      to: "5541999998888",
      body: "oi",
      phoneNumberId: "123",
      accessToken: "expired",
    });
    expect(r.ok).toBe(false);
    expect(r.simulated).toBeFalsy();
    expect(r.error).toBe("Error validating access token");
  });
});
