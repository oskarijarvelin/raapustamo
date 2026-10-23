// Esitysmateriaalin video kaappauskoneelta keynote-editorin taustaksi WebRTC:llä. Yhteys
// muodostetaan yksityisellä Realtime-kanavalla (keynote-video:<lava>), mutta itse video kulkee
// suoraan lähiverkossa lähettimeltä iPadille.
import type { SupabaseClient } from "@supabase/supabase-js";
import { lavanVideokanava, type VideoViesti } from "@/lib/keynote";
import { avaaKanava, type Kanava, type Yhteydentila } from "./lavayhteys";

const TAPAHTUMA = "video";
/** Diojen teksti pysyy terävänä tällä bittinopeudella 1080p30-kuvassa. */
const BITTINOPEUS = 6_000_000;
/** Katsoja ilmoittautuu uudelleen näin usein, kunnes yhteys syntyy. */
const ILMOITTAUTUMISVALI = 5000;
/** Jos yhteys ei synny tässä ajassa (esim. vastaus katosi), katsoja aloittaa alusta. */
const YHDISTAMISRAJA = 15_000;
/** Näin kauan katkenneena ollut katsoja poistetaan lähettimeltä (selain toteaisi sen vasta ~30 s päästä). */
const KATKOSRAJA = 10_000;

// STUN auttaa, jos lähiverkon osoitteet eivät kelpaa (esim. Safarin ICE-rajoitukset). Jos verkko estää
// laitteiden väliset yhteydet (client isolation), tarvitaan TURN-palvelin: NEXT_PUBLIC_TURN_*.
const ICE_PALVELIMET: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  ...(process.env.NEXT_PUBLIC_TURN_URL
    ? [
        {
          urls: process.env.NEXT_PUBLIC_TURN_URL,
          username: process.env.NEXT_PUBLIC_TURN_KAYTTAJA,
          credential: process.env.NEXT_PUBLIC_TURN_SALASANA,
        },
      ]
    : []),
];

const satunnainenId = () => Math.random().toString(36).slice(2, 10);

/** H.264 ensin: iPad purkaa sen raudalla. Muut koodekit jäävät varalle. */
function suosiH264(transceiver: RTCRtpTransceiver) {
  const koodekit = RTCRtpReceiver.getCapabilities?.("video")?.codecs;
  if (!koodekit || !transceiver.setCodecPreferences) return;
  const h264 = koodekit.filter((k) => k.mimeType.toLowerCase() === "video/h264");
  try {
    transceiver.setCodecPreferences([...h264, ...koodekit.filter((k) => !h264.includes(k))]);
  } catch {
    // Selain ei hyväksynyt järjestystä: käytetään oletusta.
  }
}

// --- Lähetin (kaappauskone) ---

export interface KatsojanTila {
  id: string;
  tila: RTCPeerConnectionState;
  kbps: number | null;
  /** Edestakainen viive millisekunteina */
  rtt: number | null;
}

interface Katsojayhteys {
  pc: RTCPeerConnection;
  transceiver: RTCRtpTransceiver;
  jono: RTCIceCandidateInit[];
  tavut: number;
  aika: number;
  kbps: number | null;
  rtt: number | null;
  /** Milloin yhteys katkesi (disconnected), 0 = ei katkosta */
  katkos: number;
}

export class Videolahetin {
  readonly id = satunnainenId();
  private kanava: Kanava<VideoViesti>;
  private raita: MediaStreamTrack | null = null;
  private katsojat = new Map<string, Katsojayhteys>();
  private tilastot: ReturnType<typeof setInterval>;

  constructor(
    supabase: SupabaseClient | null,
    lava: string,
    private kuuntelija: { yhteys: (tila: Yhteydentila) => void; katsojat: (katsojat: KatsojanTila[]) => void },
  ) {
    this.kanava = avaaKanava<VideoViesti>(supabase, lavanVideokanava(lava), TAPAHTUMA, {
      viesti: (v) => void this.kasittele(v).catch((virhe) => console.warn("Videoviesti epäonnistui", virhe)),
      yhteys: (tila) => {
        kuuntelija.yhteys(tila);
        // Kanavan avautuessa (myös katkon jälkeen) odottavat katsojat ilmoittautuvat.
        if (tila === "yhdistetty" && this.raita) this.kanava.laheta({ tyyppi: "lahetin", lahetin: this.id });
      },
    });
    this.tilastot = setInterval(() => void this.paivitaTilastot(), 2000);
  }

  /** Vaihtaa lähetettävän kuvan. null lopettaa lähetyksen ja sulkee katsojien yhteydet. */
  async aseta(raita: MediaStreamTrack | null) {
    const edellinen = this.raita;
    this.raita = raita;
    if (raita) raita.contentHint = "detail";
    if (!raita) {
      this.kanava.laheta({ tyyppi: "lopeta", lahetin: this.id });
      for (const id of [...this.katsojat.keys()]) this.sulje(id);
    } else if (edellinen && this.katsojat.size) {
      await Promise.all([...this.katsojat.values()].map((k) => k.transceiver.sender.replaceTrack(raita)));
    } else {
      this.kanava.laheta({ tyyppi: "lahetin", lahetin: this.id });
    }
  }

  lopeta() {
    void this.aseta(null);
    clearInterval(this.tilastot);
    this.kanava.sulje();
  }

  private async kasittele(v: VideoViesti) {
    if (v.tyyppi === "katsoja") {
      if (this.raita) await this.yhdista(v.katsoja);
      return;
    }
    if (v.tyyppi === "poistu") return this.sulje(v.katsoja);
    if ((v.tyyppi !== "vastaus" && v.tyyppi !== "ice") || v.lahetin !== this.id) return;
    const k = this.katsojat.get(v.katsoja);
    if (!k) return;
    if (v.tyyppi === "vastaus") {
      await k.pc.setRemoteDescription({ type: "answer", sdp: v.sdp });
      for (const ehdokas of k.jono.splice(0)) await k.pc.addIceCandidate(ehdokas);
    } else if (v.kenelta === "katsoja") {
      if (k.pc.remoteDescription) await k.pc.addIceCandidate(v.ehdokas);
      else k.jono.push(v.ehdokas);
    }
  }

  private async yhdista(katsoja: string) {
    const raita = this.raita;
    if (!raita) return;
    // Sama katsoja ilmoittautuu uudelleen esim. uudelleenlatauksen jälkeen: aloitetaan alusta.
    this.sulje(katsoja);
    const pc = new RTCPeerConnection({ iceServers: ICE_PALVELIMET });
    const transceiver = pc.addTransceiver(raita, {
      direction: "sendonly",
      streams: [new MediaStream([raita])],
      sendEncodings: [{ maxBitrate: BITTINOPEUS, maxFramerate: 30 }],
    });
    suosiH264(transceiver);
    const k: Katsojayhteys = { pc, transceiver, jono: [], tavut: 0, aika: 0, kbps: null, rtt: null, katkos: 0 };
    this.katsojat.set(katsoja, k);

    pc.onicecandidate = (e) => {
      if (e.candidate) this.kanava.laheta({ tyyppi: "ice", lahetin: this.id, katsoja, kenelta: "lahetin", ehdokas: e.candidate.toJSON() });
    };
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "failed" || pc.connectionState === "closed") this.sulje(katsoja);
      k.katkos = pc.connectionState === "disconnected" ? Date.now() : 0;
      this.ilmoitaKatsojat();
    };

    await pc.setLocalDescription(await pc.createOffer());
    this.kanava.laheta({ tyyppi: "tarjous", lahetin: this.id, katsoja, sdp: pc.localDescription!.sdp });
    this.ilmoitaKatsojat();

    // Diat: mieluummin pienempi kuvataajuus kuin epäterävä teksti.
    try {
      const parametrit = transceiver.sender.getParameters() as RTCRtpSendParameters & { degradationPreference?: string };
      parametrit.degradationPreference = "maintain-resolution";
      await transceiver.sender.setParameters(parametrit);
    } catch {
      // Ei tuettu tässä selaimessa.
    }
  }

  private sulje(katsoja: string) {
    const k = this.katsojat.get(katsoja);
    if (!k) return;
    this.katsojat.delete(katsoja);
    k.pc.onconnectionstatechange = null;
    k.pc.close();
    this.ilmoitaKatsojat();
  }

  private async paivitaTilastot() {
    for (const [id, k] of [...this.katsojat.entries()]) {
      if (k.katkos && Date.now() - k.katkos > KATKOSRAJA) this.sulje(id);
      if (k.pc.connectionState !== "connected") continue;
      const raportti = await k.pc.getStats(k.transceiver.sender.track);
      raportti.forEach((r) => {
        if (r.type === "outbound-rtp" && typeof r.bytesSent === "number") {
          if (k.aika) k.kbps = Math.round(((r.bytesSent - k.tavut) * 8) / (r.timestamp - k.aika));
          k.tavut = r.bytesSent;
          k.aika = r.timestamp;
        }
        if (r.type === "candidate-pair" && r.nominated && typeof r.currentRoundTripTime === "number") k.rtt = Math.round(r.currentRoundTripTime * 1000);
      });
    }
    this.ilmoitaKatsojat();
  }

  private ilmoitaKatsojat() {
    this.kuuntelija.katsojat(
      [...this.katsojat.entries()].map(([id, k]) => ({ id, tila: k.pc.connectionState, kbps: k.kbps, rtt: k.rtt })),
    );
  }
}

// --- Katsoja (editori) ---

export type VideonTila = "odottaa" | "yhdistetaan" | "yhdistetty" | "katkennut";

export class Videokatsoja {
  readonly id = satunnainenId();
  private kanava: Kanava<VideoViesti>;
  private pc: RTCPeerConnection | null = null;
  private lahetin: string | null = null;
  private jono: RTCIceCandidateInit[] = [];
  private yhdistamisenAlku = 0;
  private ajastin: ReturnType<typeof setInterval>;
  /** Sivun sulkeutuessa React ei siivoa, joten poistumisesta kerrotaan erikseen. */
  private poistu = () => this.kanava.laheta({ tyyppi: "poistu", katsoja: this.id });

  constructor(
    supabase: SupabaseClient | null,
    lava: string,
    private kuuntelija: { virta: (virta: MediaStream | null) => void; tila: (tila: VideonTila) => void },
  ) {
    this.kanava = avaaKanava<VideoViesti>(supabase, lavanVideokanava(lava), TAPAHTUMA, {
      viesti: (v) => void this.kasittele(v).catch((virhe) => console.warn("Videoviesti epäonnistui", virhe)),
      yhteys: (tila) => tila === "yhdistetty" && this.ilmoittaudu(),
    });
    this.ajastin = setInterval(() => {
      if (this.pc && this.pc.connectionState !== "connected" && Date.now() - this.yhdistamisenAlku > YHDISTAMISRAJA) {
        this.katkaise();
        this.kuuntelija.tila("katkennut");
      }
      if (!this.yhdistetty()) this.ilmoittaudu();
    }, ILMOITTAUTUMISVALI);
    addEventListener("pagehide", this.poistu);
    kuuntelija.tila("odottaa");
  }

  sulje() {
    clearInterval(this.ajastin);
    removeEventListener("pagehide", this.poistu);
    this.poistu();
    this.katkaise();
    this.kanava.sulje();
  }

  /** Yhteys on olemassa tai muodostumassa, joten uutta ei pyydetä. */
  private yhdistetty = () => this.pc !== null && ["new", "connecting", "connected"].includes(this.pc.connectionState);

  private ilmoittaudu() {
    this.kanava.laheta({ tyyppi: "katsoja", katsoja: this.id });
  }

  private katkaise() {
    if (!this.pc) return;
    this.pc.onconnectionstatechange = null;
    this.pc.close();
    this.pc = null;
    this.lahetin = null;
    this.kuuntelija.virta(null);
  }

  private async kasittele(v: VideoViesti) {
    switch (v.tyyppi) {
      case "lahetin":
        if (!this.yhdistetty() || v.lahetin !== this.lahetin) this.ilmoittaudu();
        return;
      case "lopeta":
        if (v.lahetin !== this.lahetin) return;
        this.katkaise();
        this.kuuntelija.tila("odottaa");
        return;
      case "tarjous":
        if (v.katsoja === this.id) await this.vastaa(v.lahetin, v.sdp);
        return;
      case "ice":
        if (v.katsoja !== this.id || v.kenelta !== "lahetin" || v.lahetin !== this.lahetin || !this.pc) return;
        if (this.pc.remoteDescription) await this.pc.addIceCandidate(v.ehdokas);
        else this.jono.push(v.ehdokas);
        return;
    }
  }

  private async vastaa(lahetin: string, sdp: string) {
    this.katkaise();
    const pc = new RTCPeerConnection({ iceServers: ICE_PALVELIMET });
    this.pc = pc;
    this.lahetin = lahetin;
    this.jono = [];
    this.yhdistamisenAlku = Date.now();
    this.kuuntelija.tila("yhdistetaan");

    pc.ontrack = (e) => this.kuuntelija.virta(e.streams[0] ?? new MediaStream([e.track]));
    pc.onicecandidate = (e) => {
      if (e.candidate) this.kanava.laheta({ tyyppi: "ice", lahetin, katsoja: this.id, kenelta: "katsoja", ehdokas: e.candidate.toJSON() });
    };
    pc.onconnectionstatechange = () => {
      const tila = pc.connectionState;
      if (tila === "connected") this.kuuntelija.tila("yhdistetty");
      else if (tila === "failed" || tila === "closed") {
        // Ilmoittautumisajastin pyytää uuden yhteyden.
        this.katkaise();
        this.kuuntelija.tila("katkennut");
      }
    };

    await pc.setRemoteDescription({ type: "offer", sdp });
    for (const ehdokas of this.jono.splice(0)) await pc.addIceCandidate(ehdokas);
    await pc.setLocalDescription(await pc.createAnswer());
    this.kanava.laheta({ tyyppi: "vastaus", lahetin, katsoja: this.id, sdp: pc.localDescription!.sdp });
  }
}
