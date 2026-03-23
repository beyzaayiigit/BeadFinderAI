import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

type AnalyzeMaterial = {
  name: string;
  color: string;
  size: string;
};

type AnalyzeResult = {
  isBracelet: boolean;
  materials: AnalyzeMaterial[];
  searchTerms: string[];
  reason?: string;
};

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB
const OPENROUTER_MODELS = [
  "nvidia/nemotron-nano-12b-v2-vl:free",
  "mistralai/mistral-small-3.1-24b-instruct:free",
  "google/gemma-3-12b-it:free",
  "google/gemma-3-27b-it:free",
] as const;

function safeJsonParse(input: string): unknown {
  const cleaned = input
    .trim()
    // markdown code fences gibi durumları temizle
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();

  try {
    return JSON.parse(cleaned);
  } catch {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (!match) return null;
    return JSON.parse(match[0]);
  }
}

function normalizeMaterialName(name: string): string {
  const n = name.toLowerCase().trim();
  if (!n) return "";
  if (n.includes("boncuk")) return "Boncuk";
  if (
    n.includes("kapatma") ||
    n.includes("klips") ||
    n.includes("kilit") ||
    n.includes("clasp") ||
    n.includes("mekan")
  ) {
    return "Kapatma aparatı";
  }
  if (n.includes("ara") || n.includes("spacer")) return "Ara boncuk";
  if (n.includes("ip") || n.includes("misina") || n.includes("lastik")) return "İp / Misina";
  if (n.includes("zincir")) return "Zincir";
  if (n.includes("charm") || n.includes("kolye ucu")) return "Aksesuar uç";
  if (n.includes("fazla boy") || n === "boy" || n.includes("farklıcılık")) return "";
  return name.trim();
}

function normalizeSize(size: string): string {
  const s = size.toLowerCase().replace(",", ".").trim();
  const m = s.match(/(\d+(\.\d+)?)\s*(mm|cm)/i);
  if (!m) return "Bilinmiyor";
  return `${m[1]}${m[3].toLowerCase()}`;
}

function normalizeColor(color: string): string {
  const c = color.trim();
  return c.length > 0 ? c : "Bilinmiyor";
}

function normalizeResult(value: unknown): AnalyzeResult {
  const obj =
    typeof value === "object" && value !== null
      ? (value as Record<string, unknown>)
      : {};

  const isBracelet = obj["isBracelet"] === true;

  const materialsRaw = Array.isArray(obj["materials"]) ? obj["materials"] : [];
  const materials: AnalyzeMaterial[] = materialsRaw
    .filter((m): m is Record<string, unknown> => typeof m === "object" && m !== null)
    .map((m) => {
      const rawName = typeof m["name"] === "string" ? m["name"] : "";
      const rawColor = typeof m["color"] === "string" ? m["color"] : "";
      const rawSize = typeof m["size"] === "string" ? m["size"] : "";
      return {
        name: normalizeMaterialName(rawName),
        color: normalizeColor(rawColor),
        size: normalizeSize(rawSize),
      };
    })
    .filter((m) => m.name.length > 0);

  // Aynı malzemeyi tekrar etmeyi azalt.
  const dedupedMaterials = materials.filter(
    (m, i, arr) =>
      arr.findIndex(
        (x) => x.name === m.name && x.color === m.color && x.size === m.size
      ) === i
  );

  const searchTermsRaw = Array.isArray(obj["searchTerms"]) ? obj["searchTerms"] : [];
  const searchTerms: string[] = searchTermsRaw.filter(
    (t): t is string => typeof t === "string" && t.trim().length > 0
  );

  const reason = typeof obj["reason"] === "string" ? obj["reason"] : undefined;

  return {
    isBracelet,
    materials: isBracelet ? dedupedMaterials : [],
    searchTerms: isBracelet ? searchTerms : [],
    reason,
  };
}

function buildPrompt() {
  return [
    "Bu görseldeki takı malzemelerini analiz et.",
    "Önce bileklik olup olmadığını değerlendir: Eğer bileklik değilse isBracelet=false yap ve reason alanına kısa bir açıklama yaz.",
    "Eğer bileklik'e benziyorsa isBracelet=true yap ve materials alanına şu bilgileri ekle.",
    "Sadece somut malzeme adı yaz: Boncuk, Ara boncuk, Kapatma aparatı, İp/Misina, Zincir, Aksesuar uç gibi.",
    "Muğlak/soyut ifade YAZMA: örn. 'farklıcılık', 'fazla boy', 'mekanik parça' gibi ifadeler yasak.",
    "- Her bir malzeme için: name (malzeme türü), color (en yakın renk), size (yaklaşık boyut).",
    "size alanında sadece mm veya cm kullan. Örn: 4mm, 6mm, 1cm",
    "Ardından satın almaya uygun arama için 3 adet arama terimi üret ve searchTerms alanına koy.",
    "",
    "Çıktı formatı: Sadece geçerli JSON döndür. Dışarıda açıklama/markdown kullanma.",
    "JSON anahtarları: { isBracelet: boolean, materials: [{ name: string, color: string, size: string }], searchTerms: string[], reason?: string }",
    "Örnek: {\"isBracelet\":true,\"materials\":[{\"name\":\"Cam boncuk\",\"color\":\"Açık bej\",\"size\":\"6mm\"}],\"searchTerms\":[\"...\",\"...\",\"...\"]}",
  ].join("\n");
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Sunucuda OPENROUTER_API_KEY tanımlı değil." },
      { status: 500 }
    );
  }

  // Güvenli log: anahtarın değerini yazmadan sadece var/yok bilgisi.
  console.info("[/api/analyze] OPENROUTER_API_KEY present:", Boolean(apiKey));

  const contentType = req.headers.get("content-type") || "";
  if (!contentType.includes("multipart/form-data")) {
    return NextResponse.json(
      { error: "Beklenen içerik türü multipart/form-data değil." },
      { status: 400 }
    );
  }

  try {
    const formData = await req.formData();
    const image = formData.get("image");

    if (!image) {
      return NextResponse.json({ error: "Görsel (image) gönderilmedi." }, { status: 400 });
    }

    const blob = image as unknown as Blob;
    if (!("arrayBuffer" in blob)) {
      return NextResponse.json({ error: "image dosyası geçersiz." }, { status: 400 });
    }

    const mimeType = blob.type;
    if (!mimeType?.startsWith("image/")) {
      return NextResponse.json(
        { error: "Sadece image/* türleri kabul ediyorum." },
        { status: 400 }
      );
    }

    const arrayBuffer = await blob.arrayBuffer();
    if (arrayBuffer.byteLength > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json(
        { error: "Dosya çok büyük. Maksimum 10MB." },
        { status: 400 }
      );
    }

    const base64 = Buffer.from(arrayBuffer).toString("base64");

    const prompt = buildPrompt();
    let responseText = "";
    let lastHttpStatus = 500;
    let lastMessage = "OpenRouter isteği başarısız.";

    for (const model of OPENROUTER_MODELS) {
      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "http://localhost:3000",
          "X-Title": "BeadFinder AI",
        },
        body: JSON.stringify({
          model,
          temperature: 0.2,
          messages: [
            {
              role: "user",
              content: [
                { type: "text", text: prompt },
                {
                  type: "image_url",
                  image_url: {
                    url: `data:${mimeType};base64,${base64}`,
                  },
                },
              ],
            },
          ],
        }),
      });

      const responseJson = (await response.json().catch(() => null)) as
        | {
            error?: { message?: string };
            choices?: Array<{ message?: { content?: unknown } }>;
          }
        | null;

      if (!response.ok) {
        lastHttpStatus = response.status;
        lastMessage =
          responseJson?.error?.message ??
          `OpenRouter isteği başarısız (HTTP ${response.status}).`;
        console.warn(`[/api/analyze] OpenRouter model failed: ${model} -> ${lastMessage}`);
        continue;
      }

      const content = responseJson?.choices?.[0]?.message?.content;
      responseText =
        typeof content === "string"
          ? content
          : Array.isArray(content)
            ? content
                .map((item) =>
                  typeof item === "object" &&
                  item !== null &&
                  "text" in item &&
                  typeof (item as { text?: unknown }).text === "string"
                    ? (item as { text: string }).text
                    : ""
                )
                .join("\n")
            : "";

      if (responseText.trim().length > 0) break;
    }

    if (!responseText.trim()) {
      const normalizedMessage =
        lastMessage.toLowerCase().includes("provider returned error")
          ? "OpenRouter sağlayıcısı şu an isteği işleyemiyor. Biraz sonra tekrar deneyin veya farklı bir model deneyin."
          : lastMessage;
      return NextResponse.json({ error: normalizedMessage }, { status: lastHttpStatus });
    }

    const parsed = safeJsonParse(responseText);

    if (!parsed || typeof parsed !== "object") {
      return NextResponse.json(
        { error: "AI yanıtı beklenen JSON formatında değil." },
        { status: 502 }
      );
    }

    const normalized = normalizeResult(parsed);
    return NextResponse.json(normalized);
  } catch (err) {
    console.error("[/api/analyze] error:", err);

    const anyErr = err as { status?: number; message?: string } | undefined;

    const message = anyErr?.message ?? "AI analizi sırasında bir hata oluştu.";

    const status =
      typeof anyErr?.status === "number" ? anyErr.status : 500;

    // Quota/Rate limit gibi durumları kullanıcıya anlaşılır göster.
    const retryMatch = String(message).match(/retry in\s+([0-9.]+)s?/i);
    const retryAfterSeconds = retryMatch
      ? Math.max(0, Math.ceil(Number(retryMatch[1])))
      : undefined;

    if (
      status === 429 ||
      String(message).toLowerCase().includes("quota") ||
      String(message).toLowerCase().includes("resource_exhausted") ||
      String(message).toLowerCase().includes("rate limit")
    ) {
      return NextResponse.json(
        {
          error:
            "Kotanız dolu ya da istek limiti aşıldı. Bir süre sonra tekrar deneyin.",
          retryAfterSeconds,
        },
        { status: 429 }
      );
    }

    return NextResponse.json({ error: message }, { status });
  }
}

