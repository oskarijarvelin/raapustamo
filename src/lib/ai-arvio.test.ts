import Anthropic from "@anthropic-ai/sdk";
import { describe, expect, it, vi } from "vitest";
import { AI_MALLI, arvioiPiirros, arvioVastauksesta, arvioViestista } from "./ai-arvio";
import { HYMIO } from "./testipiirrokset";

const viesti = (teksti: string, stop_reason: Anthropic.Message["stop_reason"] = "end_turn") =>
  ({ stop_reason, content: [{ type: "text", text: teksti }] }) as unknown as Anthropic.Message;

const asiakas = (create: (params: Anthropic.MessageCreateParamsNonStreaming) => Promise<unknown>) => {
  const mock = vi.fn(create);
  return { client: { messages: { create: mock } } as unknown as Anthropic, mock };
};

describe("arvioVastauksesta", () => {
  it("hyväksyy kelvollisen vastauksen ja rajaa varmuuden ja syyn", () => {
    expect(arvioVastauksesta('{"luokka":"ok","varmuus":0.934,"syy":" Hymiö "}')).toEqual({ luokka: "ok", varmuus: 0.93, syy: "Hymiö" });
    expect(arvioVastauksesta('{"luokka":"sopimaton","varmuus":7,"syy":"x"}')?.varmuus).toBe(1);
    expect(arvioVastauksesta(`{"luokka":"ok","varmuus":0.5,"syy":"${"a".repeat(500)}"}`)?.syy).toHaveLength(200);
  });

  it("hylkää rikkinäisen tai tuntemattoman vastauksen", () => {
    for (const teksti of ["", "ei json", "null", '{"luokka":"hyvaksy","varmuus":1,"syy":""}', '{"luokka":"ok","varmuus":"paljon","syy":""}']) {
      expect(arvioVastauksesta(teksti)).toBeNull();
    }
  });
});

describe("arvioViestista", () => {
  it("lukee tekstilohkon", () => {
    expect(arvioViestista(viesti('{"luokka":"epailyttava","varmuus":0.6,"syy":"Nimi"}'))?.luokka).toBe("epailyttava");
  });

  it("merkitsee kieltäytymisen epäilyttäväksi eikä ok:ksi", () => {
    expect(arvioViestista(viesti("", "refusal"))?.luokka).toBe("epailyttava");
  });

  it("ei arvioi katkennutta vastausta", () => {
    expect(arvioViestista(viesti('{"luokka":"ok"', "max_tokens"))).toBeNull();
  });
});

describe("arvioiPiirros", () => {
  it("lähettää piirroksen PNG-kuvana Haiku 5.5:lle JSON-skeemalla", async () => {
    const { client, mock } = asiakas(async () => viesti('{"luokka":"ok","varmuus":0.9,"syy":"Hymiö"}'));
    expect(await arvioiPiirros(HYMIO, client)).toEqual({ luokka: "ok", varmuus: 0.9, syy: "Hymiö" });
    const params = mock.mock.calls[0][0];
    expect(params.model).toBe(AI_MALLI);
    expect(params.output_config?.format?.type).toBe("json_schema");
    const [kuva] = params.messages[0].content as Anthropic.ContentBlockParam[];
    expect(kuva.type === "image" && kuva.source.type === "base64" && kuva.source.media_type).toBe("image/png");
  });

  it("palauttaa null, jos API kaatuu, jotta piirros menee jonoon ilman arviota", async () => {
    const { client } = asiakas(async () => {
      throw new Anthropic.APIConnectionError({ message: "verkko" });
    });
    expect(await arvioiPiirros(HYMIO, client)).toBeNull();
  });

  it("ei tee mitään ilman API-avainta", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    expect(await arvioiPiirros(HYMIO)).toBeNull();
    vi.unstubAllEnvs();
  });
});
