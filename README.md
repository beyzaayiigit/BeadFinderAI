# BeadFinder AI

BeadFinder AI, bileklik fotoğraflarından malzeme tahmini ve alışveriş için arama terimleri üretmeye yardımcı olan tek sayfalık bir Next.js uygulamasıdır.

## Gereksinimler

- Node.js v22 (20+ da olur)
- OpenRouter API key

Bu projede API key sunucu tarafında okunur: `OPENROUTER_API_KEY`

## Kurulum

```bash
npm install
```

`.env.example` dosyasını temel alarak `.env.local` oluştur:

```bash
copy .env.example .env.local
```

`OPENROUTER_API_KEY` değerini kendi key’inle doldur.

## Geliştirme

```bash
npm run dev
```

Tarayıcıda: `http://localhost:3000`

## API

Görsel analiz endpoint’i:

- `POST /api/analyze`
- `multipart/form-data` içerisinde `image` alanı beklenir

## Test Planı (QA)

1. **Doğru bileklik görseli**: `isBracelet=true`, `materials` en az 1 öğe ve `searchTerms` 3 öğe dönmeli.
2. **Bileklik olmayan görsel** (kolye/halka/et/başka takı): `isBracelet=false` ve UI’da gerekçe mesajı görünmeli.
3. **Düşük kaliteli/çok uzak görsel**: UI hata vermemeli; `materials`/`searchTerms` boş ya da az gelebilir (kontrollü gösterim).
4. **Büyük dosya** (>10MB): UI uygun hata mesajı göstermeli (10MB altı uyarısı).
5. **Yanlış dosya türü** (ör. PDF/ZIP): UI sadece `image/*` uyarısı göstermeli.
6. **API key yok**: Sunucudan `OPENROUTER_API_KEY tanımlı değil` hatası dönmeli.
7. **AI JSON bozulması**: UI `AI yanıtı beklenen JSON formatında değil` üzerinden kontrollü hata göstermeli.
