 "use client";

import { useEffect, useMemo, useState } from "react";

type Material = {
  name: string;
  color: string;
  size: string;
};

type AnalyzeResponse = {
  isBracelet: boolean;
  materials: Material[];
  searchTerms: string[];
  reason?: string;
};

type AnalyzeErrorResponse = {
  error?: string;
  retryAfterSeconds?: number;
};

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

function looksLikeImageFile(f: File) {
  if (f.type?.startsWith("image/")) return true;
  const name = (f.name || "").toLowerCase();
  return [".png", ".jpg", ".jpeg", ".webp", ".gif", ".bmp", ".tiff"].some((ext) =>
    name.endsWith(ext)
  );
}

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [pickedMeta, setPickedMeta] = useState<{
    name: string;
    type: string;
    size: number;
  } | null>(null);

  const [status, setStatus] = useState<
    "idle" | "loading" | "success" | "error" | "non-bracelet"
  >("idle");
  const [dotCount, setDotCount] = useState(0);

  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalyzeResponse | null>(null);
  const [copyNotice, setCopyNotice] = useState<string | null>(null);

  const safeSearchText = useMemo(() => {
    if (!result?.searchTerms?.length) return "";
    return result.searchTerms.join("\n");
  }, [result]);
  const previewUrl = useMemo(
    () => (file ? URL.createObjectURL(file) : null),
    [file]
  );

  useEffect(() => {
    if (status !== "loading") return;
    const t = window.setInterval(() => {
      setDotCount((d) => (d + 1) % 4);
    }, 500);
    return () => window.clearInterval(t);
  }, [status]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  function getColorToken(colorText: string) {
    const c = colorText.toLowerCase();
    if (c.includes("siyah")) return "bg-zinc-900";
    if (c.includes("beyaz")) return "bg-zinc-100";
    if (c.includes("kırmızı") || c.includes("red")) return "bg-red-500";
    if (c.includes("mavi") || c.includes("blue")) return "bg-blue-500";
    if (c.includes("yeşil") || c.includes("green")) return "bg-emerald-500";
    if (c.includes("sarı") || c.includes("yellow")) return "bg-yellow-400";
    if (c.includes("mor") || c.includes("purple")) return "bg-violet-500";
    if (c.includes("bej")) return "bg-amber-100";
    if (c.includes("kahve") || c.includes("brown")) return "bg-amber-700";
    if (c.includes("gümüş") || c.includes("gri") || c.includes("silver") || c.includes("gray"))
      return "bg-zinc-400";
    if (c.includes("altın") || c.includes("gold")) return "bg-yellow-500";
    return "bg-zinc-300";
  }

  async function onPickFile(f: File | null | undefined) {
    setError(null);
    setCopyNotice(null);
    setResult(null);
    setStatus("idle");
    setDotCount(0);

    if (!f) return;

    if (!looksLikeImageFile(f)) {
      setError(
        "Sadece görsel dosyaları kabul ediyorum (image/*). (Desteklenen örnek: jpg/png/webp/gif)"
      );
      setStatus("error");
      return;
    }

    if (f.size > MAX_FILE_SIZE_BYTES) {
      setError("Dosya çok büyük. Lütfen 10MB altı bir görsel yükleyin.");
      setStatus("error");
      return;
    }

    setFile(f);
  }

  async function analyze() {
    setError(null);
    setCopyNotice(null);
    setResult(null);
    setDotCount(0);

    if (!file) {
      setError("Lütfen önce bir fotoğraf yükleyin.");
      setStatus("error");
      return;
    }

    try {
      setStatus("loading");

      const formData = new FormData();
      formData.append("image", file);

      const res = await fetch("/api/analyze", {
        method: "POST",
        body: formData,
      });

      const json = (await res.json().catch(() => null)) as
        | AnalyzeResponse
        | AnalyzeErrorResponse
        | null;

      if (!res.ok) {
        const msg =
          json && typeof (json as { error?: unknown }).error === "string"
            ? (json as { error: string }).error
            : `Analiz başarısız (HTTP ${res.status}).`;

        const retryAfter =
          json && typeof (json as { retryAfterSeconds?: unknown }).retryAfterSeconds === "number"
            ? (json as { retryAfterSeconds: number }).retryAfterSeconds
            : null;

        setError(
          retryAfter !== null && retryAfter > 0
            ? `${msg} (Yaklaşık ${retryAfter} saniye sonra tekrar deneyin.)`
            : msg
        );
        setStatus("error");
        return;
      }

      const parsed = json as AnalyzeResponse | null;
      if (!parsed) {
        setError("Analizden geçersiz bir yanıt alındı.");
        setStatus("error");
        return;
      }

      setResult(parsed);
      if (!parsed.isBracelet) {
        setStatus("non-bracelet");
        return;
      }

      setStatus("success");
    } catch {
      setError("Beklenmeyen bir hata oluştu. Lütfen tekrar deneyin.");
      setStatus("error");
    }
  }

  async function copySearchTerms() {
    if (!safeSearchText) return;
    setCopyNotice(null);
    try {
      await navigator.clipboard.writeText(safeSearchText);
      setCopyNotice("Kopyalandı.");
      window.setTimeout(() => setCopyNotice(null), 2500);
    } catch {
      setError("Kopyalama başarısız. Tarayıcı izinlerini kontrol edin.");
    }
  }

  function resetAll() {
    setFile(null);
    setPickedMeta(null);
    setError(null);
    setResult(null);
    setStatus("idle");
    setCopyNotice(null);
    setDotCount(0);
  }

  return (
    <div className="flex min-h-screen flex-col items-center bg-neutral-50/80 p-6 font-sans dark:bg-zinc-950">
      <div className="w-full max-w-3xl">
        <header className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-700 dark:text-violet-100">
              BeadFinder AI
            </h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-violet-200/80">
              Bileklik fotoğrafını yükle, malzemeleri ve arama terimlerini al.
            </p>
          </div>

          {(status === "success" ||
            status === "non-bracelet" ||
            status === "error") && (
            <button
              type="button"
              onClick={resetAll}
              className="rounded-full border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-violet-100 dark:border-violet-700 dark:bg-violet-900/30 dark:text-violet-100"
            >
              Sıfırla
            </button>
          )}
        </header>

        <section className="rounded-2xl border border-neutral-200/90 bg-white/95 p-6 shadow-sm dark:border-violet-700 dark:bg-violet-900/20">
          <div
            className="relative flex flex-col items-center justify-center gap-4 rounded-xl border-2 border-dashed border-violet-100 bg-violet-50/60 px-6 py-10 text-center dark:border-violet-700 dark:bg-violet-950/40"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const f = e.dataTransfer.files?.[0];
              void onPickFile(f);
            }}
          >
            <input
              id="beadfinder-upload"
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={(e) => {
                const next = e.currentTarget.files?.[0];
                if (next) {
                  setPickedMeta({
                    name: next.name,
                    type: next.type || "unknown",
                    size: next.size,
                  });
                } else {
                  setPickedMeta(null);
                }
                // Aynı dosyayı tekrar seçince onChange tetiklenmesi için input'u sıfırlıyoruz.
                e.currentTarget.value = "";
                void onPickFile(next);
              }}
            />

            <label
              htmlFor="beadfinder-upload"
              role="button"
              className="rounded-full bg-violet-500 px-5 py-3 text-sm font-semibold text-white transition hover:bg-violet-600 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-violet-400 dark:text-zinc-950"
            >
              Fotoğraf Yükle
            </label>

            <p className="text-sm text-slate-500 dark:text-violet-200/80">
              Sürükle-bırak ile de yükleyebilirsin. (Maks. 10MB)
            </p>

            {previewUrl && (
              <div className="mt-2 w-full max-w-xs overflow-hidden rounded-xl border border-black/10 bg-white dark:border-white/10 dark:bg-zinc-900">
                <img
                  src={previewUrl}
                  alt="Yuklenen bileklik gorseli"
                  className="max-h-64 w-full object-contain"
                />
              </div>
            )}

            {pickedMeta && (
              <div className="mt-2 text-xs text-slate-500 dark:text-violet-200">
                Seçilen: <span className="font-medium">{pickedMeta.name}</span>
                <div className="mt-1 opacity-80">
                  {pickedMeta.type} · {(pickedMeta.size / 1024 / 1024).toFixed(2)} MB
                </div>
              </div>
            )}
          </div>

          {error && (
            <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/20 dark:text-red-200">
              {error}
            </div>
          )}

          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={analyze}
                disabled={!file || status === "loading"}
                className="rounded-full bg-violet-500 px-5 py-3 text-sm font-semibold text-white transition hover:bg-violet-600 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-violet-300 dark:text-zinc-950"
              >
                Analiz Et
              </button>

              {status === "loading" && (
                <div
                  className="text-sm text-slate-500 dark:text-violet-200"
                  aria-live="polite"
                >
                  Boncuklar sayılıyor{" "}
                  <span className="tabular-nums">
                    {".".repeat(dotCount)}
                  </span>
                </div>
              )}

              {(status === "success" || status === "non-bracelet") && (
                <div
                  className="text-sm text-emerald-700 dark:text-emerald-300"
                  aria-live="polite"
                >
                  Sonuçlar hazır.
                </div>
              )}
            </div>

            <div className="text-xs text-slate-400 dark:text-violet-300/80">
              Yakın plan bileklik görseli daha iyi sonuç verir.
            </div>
          </div>
        </section>

        {(status === "success" || status === "non-bracelet") &&
          result && (
            <section className="mt-6 rounded-2xl border border-neutral-200/90 bg-white/95 p-6 shadow-sm dark:border-violet-700 dark:bg-violet-900/20">
              {!result.isBracelet ? (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-200">
                  <div className="font-semibold">
                    Üzgünüm, bu bir bileklik görseline benzemiyor.
                  </div>
                  {result.reason ? (
                    <div className="mt-1 text-sm">{result.reason}</div>
                  ) : null}
                </div>
              ) : (
                <div className="mb-4 text-sm text-slate-500 dark:text-violet-200/80">
                  Sonuçlar (tahmin):
                </div>
              )}

              {result.materials?.length ? (
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {result.materials.map((m, idx) => (
                    <div
                      key={`${m.name}-${idx}`}
                      className="rounded-xl border border-violet-100 bg-violet-50/70 p-4 dark:border-violet-700 dark:bg-violet-950/40"
                    >
                      <div className="min-w-0">
                          <div className="text-sm font-semibold text-slate-700 dark:text-violet-100">
                          🔹 {m.name}
                        </div>
                        <div className="mt-1 flex items-center gap-2">
                          <span
                            className={`h-3 w-3 rounded-full border border-black/10 ${getColorToken(m.color)}`}
                          />
                          <span className="text-xs text-slate-500 dark:text-violet-200">
                            🎨 {m.color}
                          </span>
                        </div>
                      </div>
                      <div className="mt-2 text-sm text-slate-500 dark:text-violet-200">
                        <div>
                          📏 Boyut:{" "}
                          <span className="font-medium">{m.size}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}

              <div className="mt-6">
                <div className="flex items-center justify-between gap-4">
                  <h2 className="text-sm font-semibold text-slate-700 dark:text-violet-100">
                    🔎 Arama Terimleri
                  </h2>

                  <button
                    type="button"
                    onClick={copySearchTerms}
                    disabled={!safeSearchText}
                    className="rounded-full border border-violet-100 bg-white px-4 py-2 text-xs font-medium text-violet-700 transition hover:bg-violet-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-violet-700 dark:bg-violet-900/30 dark:text-violet-100"
                  >
                    📋 Kopyala
                  </button>
                </div>

                {copyNotice ? (
                  <div className="mt-2 text-xs text-emerald-700 dark:text-emerald-200">
                    {copyNotice}
                  </div>
                ) : null}

                {result.searchTerms?.length ? (
                  <div className="mt-3 rounded-xl border border-violet-100 bg-violet-50/80 p-4 font-mono text-xs text-slate-600 dark:border-violet-700 dark:bg-violet-950/40 dark:text-violet-100">
                    {result.searchTerms.map((t, i) => (
                      <div key={`${t}-${i}`}>{t}</div>
                    ))}
                  </div>
                ) : (
                  <div className="mt-3 text-sm text-slate-400 dark:text-violet-300/80">
                    Arama terimi üretilemedi.
                  </div>
                )}
              </div>
            </section>
          )}
      </div>

      {(status === "success" || status === "non-bracelet") && (
        <div className="fixed right-4 bottom-4 z-50 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-800 shadow-sm dark:border-emerald-800/60 dark:bg-emerald-950/50 dark:text-emerald-200">
          ✅ Sonuçlar hazır
        </div>
      )}
    </div>
  );
}
