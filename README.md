# BeadFinder AI ✨

BeadFinder AI = bileklik fotoğrafını yükle 📸, yapay zeka malzemeleri tahmin etsin 🤖, sen de arama terimlerini kapıp direkt alışverişe geç 🛍️.  
Kısaca: **“foto -> analiz -> arama”** akışı, gereksiz drama yok 😌

## Ne işe yarıyor? 🎯

- Bileklik görselini alır.
- Görselin gerçekten bileklik olup olmadığını kontrol eder.
- Olası malzemeleri listeler.
- Satın alma için işe yarar arama terimleri üretir.

## Tech Stack 🧩

- Next.js
- TypeScript
- OpenRouter API

## Gereksinimler ⚙️

- Node.js `20+` (öneri: `22`)
- OpenRouter API key

API key sunucu tarafında okunur: `OPENROUTER_API_KEY`

## Kurulum 🚀

```bash
npm install
copy .env.example .env.local
```

Sonra `.env.local` içine kendi key’ini ekle:

```env
OPENROUTER_API_KEY=your_key_here
```

## Local'de çalıştırma 💻

```bash
npm run dev
```

Tarayıcı: `http://localhost:3000`

## API 🔌

### `POST /api/analyze`

- İstek tipi: `multipart/form-data`
- Zorunlu alan: `image`
- Beklenen çıktı:
  - `isBracelet`
  - `materials`
  - `searchTerms`

## Mini Test Checklist

1. **Doğru bileklik görseli** ✅ -> `isBracelet=true`, `materials` dolu, `searchTerms` dolu.
2. **Bileklik olmayan görsel** ❌ -> `isBracelet=false`, UI sebebi göstermeli.
3. **Kalitesiz/uzak görsel** 🫠 -> uygulama crash olmamalı, kontrollü çıktı vermeli.
4. **Büyük dosya (>10MB)** 📦 -> kullanıcıya net hata mesajı dönmeli.
5. **Yanlış dosya türü** 🧱 -> sadece `image/*` kabul edilmeli.
6. **API key yok** 🔑 -> backend `OPENROUTER_API_KEY tanımlı değil` hatası dönmeli.
7. **Bozuk AI JSON** 🧪 -> UI kontrollü hata mesajı göstermeli.

## Not 💬

Bu proje hızlı prototip hissinde tasarlandı: sade, net, işe odaklı.  
Katkı vermek istersen PR’lar her zaman welcome 🤝
