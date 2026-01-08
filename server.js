import express from "express";
import fs from "fs";
import path from "path";

const app = express();
const PORT = process.env.PORT || 3000;

const MOCKS_DIR = path.resolve("./mocks");

function normalizeMsisdn(value) {
  return value?.toString().replace(/\D/g, "");
}

// Extrai msisdn de:
// 1) query param ?msisdn=...
// 2) header x-querystring: msisdn=119...
function extractMsisdn(req) {
  // Query param
  const q = normalizeMsisdn(req.query.msisdn);
  if (q) return q;

  // Header x-querystring
  const headerQS = req.headers["x-querystring"];
  if (typeof headerQS === "string") {
    // suporta: "msisdn=11959597475" ou "msisdn=119...&foo=bar"
    const match = headerQS.match(/msisdn\s*=\s*([0-9]+)/i);
    if (match?.[1]) return normalizeMsisdn(match[1]);
  }

  return null;
}

function loadMockFile(msisdn) {
  const specific = path.join(MOCKS_DIR, `${msisdn}.json`);
  const fallback = path.join(MOCKS_DIR, `default.json`);

  if (fs.existsSync(specific)) {
    return JSON.parse(fs.readFileSync(specific, "utf-8"));
  }
  return JSON.parse(fs.readFileSync(fallback, "utf-8"));
}

/**
 * Endpoint mockado igual ao real:
 * GET /mobile/v1/invoices?page=1&limit=50
 * msisdn pode vir na query (?msisdn=) OU no header x-querystring
 */
app.get("/mobile/v1/invoices", (req, res) => {
  try {
    const msisdn = extractMsisdn(req);

    if (!msisdn) {
      return res.status(400).json({
        code: "INVALID_REQUEST",
        message:
          "msisdn é obrigatório (via query ?msisdn=... ou header x-querystring: msisdn=...)"
      });
    }

    // você pode ler page/limit também, se quiser usar no mock
    const page = Number(req.query.page || 1);
    const limit = Number(req.query.limit || 50);

    const mock = loadMockFile(msisdn);

    // metadados opcionais no JSON:
    const status = mock.__status ?? 200;
    const headers = mock.__headers ?? {};

    Object.entries(headers).forEach(([k, v]) => res.setHeader(k, String(v)));

    // injeta coisas úteis se você quiser (opcional)
    mock.request = { msisdn, page, limit };

    // remove metadados antes de responder
    delete mock.__status;
    delete mock.__headers;

    return res.status(status).json(mock);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ code: "MOCK_ERROR", message: "Erro no mock" });
  }
});

// healthcheck (útil no Render)
app.get("/health", (req, res) => res.status(200).send("ok"));

app.listen(PORT, () => console.log(`Mock rodando na porta ${PORT}`));
