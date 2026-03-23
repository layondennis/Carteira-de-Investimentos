import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import axios from "axios";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Mock financial data for B3 assets
  // In a real app, you'd use Yahoo Finance or Alpha Vantage
  const mockAssets: Record<string, any> = {
    "PETR4": { price: 38.50, min: 35.20, max: 42.10, type: "Ação", sector: "Energia", segment: "Petróleo e Gás", dividends: [{ value: 1.20, dateCom: "2026-03-15", datePay: "2026-04-20" }] },
    "VALE3": { price: 65.80, min: 60.10, max: 72.50, type: "Ação", sector: "Mineração", segment: "Minério de Ferro", dividends: [{ value: 2.50, dateCom: "2026-03-10", datePay: "2026-04-15" }] },
    "GARE11": { price: 9.25, min: 8.90, max: 10.50, type: "FII", sector: "Logística", segment: "Galpões Logísticos", dividends: [{ value: 0.08, dateCom: "2026-03-31", datePay: "2026-04-10" }] },
    "KNRI11": { price: 162.40, min: 155.00, max: 170.00, type: "FII", sector: "Híbrido", segment: "Lajes e Logística", dividends: [{ value: 1.00, dateCom: "2026-03-31", datePay: "2026-04-15" }] },
    "IVVB11": { price: 285.50, min: 250.00, max: 300.00, type: "ETF", sector: "Internacional", segment: "S&P 500", dividends: [] },
    "AAPL34": { price: 52.10, min: 48.00, max: 55.00, type: "BDR", sector: "Tecnologia", segment: "Hardware", dividends: [{ value: 0.15, dateCom: "2026-02-10", datePay: "2026-03-25" }] },
    "ITUB4": { price: 34.20, min: 30.00, max: 36.00, type: "Ação", sector: "Financeiro", segment: "Bancos", dividends: [{ value: 0.17, dateCom: "2026-03-01", datePay: "2026-04-01" }] },
    "XPML11": { price: 118.50, min: 110.00, max: 125.00, type: "FII", sector: "Shoppings", segment: "Shoppings", dividends: [{ value: 0.90, dateCom: "2026-03-15", datePay: "2026-03-25" }] },
  };

  // API Routes
  app.get("/api/assets/:symbol", (req, res) => {
    const symbol = req.params.symbol.toUpperCase();
    const asset = mockAssets[symbol];
    if (asset) {
      // Simulate real-time price fluctuation
      const fluctuation = (Math.random() - 0.5) * 0.5;
      const currentPrice = asset.price + fluctuation;
      res.json({
        symbol,
        price: currentPrice.toFixed(2),
        min: asset.min,
        max: asset.max,
        type: asset.type,
        sector: asset.sector,
        segment: asset.segment,
        dividends: asset.dividends
      });
    } else {
      res.status(404).json({ error: "Asset not found" });
    }
  });

  app.get("/api/market-summary", (req, res) => {
    const summary = Object.keys(mockAssets).map(symbol => {
      const asset = mockAssets[symbol];
      const fluctuation = (Math.random() - 0.5) * 0.5;
      return {
        symbol,
        price: (asset.price + fluctuation).toFixed(2),
        type: asset.type,
        sector: asset.sector
      };
    });
    res.json(summary);
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
