require("dotenv").config();
const express = require("express");
const multer  = require("multer");
const sharp   = require("sharp");
const { GoogleGenerativeAI } = require("@google/generative-ai");

const app = express();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

// Teal pixels are recolored RED before sending — model just reads red numbers, no color guessing.
const FLAME_PROMPT = `This MapleStory equipment tooltip has flame bonus values highlighted in RED.
Read each red number and match it to its stat.

Return ONLY this JSON (no markdown, no explanation):
{"STR":0,"DEX":0,"INT":0,"LUK":0,"HP":0,"ATT":0,"MATT":0,"AllStat":0}

Use 0 for any stat with no red number. AllStat = the "All Stat %" red value if present.
ATT = Attack Power. MATT = Magic ATT.`;

const SECONDARY = { STR: "DEX", DEX: "STR", INT: "LUK", LUK: "DEX", HP: "STR" };

function calcScore(flames) {
  const { STR = 0, DEX = 0, INT = 0, LUK = 0, HP = 0, ATT = 0, MATT = 0, AllStat = 0 } = flames;

  // Primary = highest teal main stat
  const mains = { STR, DEX, INT, LUK, HP };
  const [primaryStat, primaryVal] = Object.entries(mains).reduce((a, b) => b[1] > a[1] ? b : a);

  const secondaryStat = SECONDARY[primaryStat];
  const secondaryVal = flames[secondaryStat] || 0;

  const att = Math.max(ATT, MATT);
  const attLabel = MATT > ATT ? "MATT" : "ATT";

  const mainScore    = primaryVal;
  const attScore     = 3 * att;
  const allStatScore = 10 * AllStat;
  const secScore     = +(secondaryVal / 12).toFixed(2);
  const total        = +(mainScore + attScore + allStatScore + secScore).toFixed(2);

  return `Flame Score: ${total} ${primaryStat}\n\n` +
    `| Component  | Flame | ×    | Score  |\n` +
    `|------------|-------|------|--------|\n` +
    `| ${primaryStat.padEnd(10)} | ${String(primaryVal).padEnd(5)} | 1    | ${mainScore}  |\n` +
    `| ${attLabel.padEnd(10)} | ${String(att).padEnd(5)} | 3    | ${attScore}  |\n` +
    `| All Stat%  | ${String(AllStat).padEnd(4)}% | 10   | ${allStatScore}  |\n` +
    `| ${secondaryStat.padEnd(10)} | ${String(secondaryVal).padEnd(5)} | 1/12 | ${secScore}  |\n` +
    `| Total      |       |      | ${total}  |`;
}

// Pixel-level teal isolation:
// - Center-crop 70% width to remove side chrome
// - Scan every pixel: teal/cyan → vivid red, everything else → grayscale
// - Upscale 2× for readable digits
// Result: model only needs to read "which numbers are red" — no color guessing at all.
async function preprocessImage(buffer) {
  const meta  = await sharp(buffer).metadata();
  const cropW = Math.round(meta.width * 0.70);
  const left  = Math.floor((meta.width - cropW) / 2);

  const { data, info } = await sharp(buffer)
    .extract({ left, top: 0, width: cropW, height: meta.height })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width, height, channels } = info; // channels = 4 (RGBA)
  const out = Buffer.alloc(width * height * 3);

  for (let i = 0; i < width * height; i++) {
    const r = data[i * channels];
    const g = data[i * channels + 1];
    const b = data[i * channels + 2];

    // MapleStory flame color: bright cyan — high G and B, significantly lower R
    const isTeal = g > 150 && b > 150 && r < g - 40 && r < b - 40;

    if (isTeal) {
      out[i * 3]     = 255; // vivid red — model reads these as flame values
      out[i * 3 + 1] = 0;
      out[i * 3 + 2] = 0;
    } else {
      const gray = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
      out[i * 3]     = gray;
      out[i * 3 + 1] = gray;
      out[i * 3 + 2] = gray;
    }
  }

  const targetW = Math.min(width * 2, 1000);
  return sharp(out, { raw: { width, height, channels: 3 } })
    .resize(targetW, null, { kernel: "lanczos3" })
    .png()
    .toBuffer();
}

app.use(express.static("public"));

app.post("/calculate", upload.single("image"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No image provided." });

  const processed = await preprocessImage(req.file.buffer);

  const imagePart = {
    inlineData: {
      data: processed.toString("base64"),
      mimeType: "image/png",
    },
  };

  try {
    const result = await model.generateContent([FLAME_PROMPT, imagePart]);
    const raw = result.response.text().trim();

    // Strip markdown code fences if model wraps anyway
    const jsonStr = raw.replace(/^```[a-z]*\n?/i, "").replace(/```$/, "").trim();
    const flames = JSON.parse(jsonStr);

    res.json({ result: calcScore(flames) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to parse flame data: " + err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Flame Score running at http://localhost:${PORT}`));
