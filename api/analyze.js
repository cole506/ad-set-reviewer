// Vercel Serverless Function — Ad Set 101 Analyzer
// Set ANTHROPIC_API_KEY in your Vercel project environment variables.

const ANALYSIS_PROMPT = `You are a quality control specialist for digital ad creatives for roofing and HVAC companies.

Analyze this ad creative image strictly against the Creative Mastery Ad Set 101 SOP.

STEP 1 - AD FORMAT
Identify the layout of this creative:
- "single": One full-frame photo fills the entire creative
- "two_fold": Two photos side by side or stacked in one creative
- "tri_fold": Three photos in a tiled/grid layout in one creative

STEP 2 - PHOTO TYPES PRESENT
For each panel, identify the types used (list all that apply):
- "trust": Happy person(s) conveying positivity and trust
- "service": Roofing or HVAC work, completed or in progress
- "brand": Company vehicle, branded clothing, or lawn signs

STEP 3 - EDITING QUALITY
Cropping: "good", "cut_off", "too_tight", or "dead_space"
Brightness: "perfect", "too_dark", or "too_bright"

STEP 4 - AI IMAGE CHECK (if AI-generated)
- blurred_logo: logo blurry or garbled? (true=BAD)
- jumbled_text: text unreadable? (true=BAD)
- duplicate_people: same face more than once? (true=BAD)
- logo_spammed: logo used excessively? (true=BAD)
- inconsistent_likeness: AI doesn't look like real rep? (true=BAD)

STEP 5 - FORMAT RULES
- Single: Trust or Service only (no brand-alone)
- Two-fold: pair different photo types
- Tri-fold: mix Trust, Service, and Brand

Return ONLY raw JSON, no markdown:
{"format":"single","photo_types":["trust"],"cropping":"good","brightness":"perfect","appears_ai_generated":false,"ai_issues":{"blurred_logo":false,"jumbled_text":false,"duplicate_people":false,"logo_spammed":false,"inconsistent_likeness":false},"format_rule_violations":[],"approved":true,"rejection_reasons":[],"notes":"assessment here"}`;

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "ANTHROPIC_API_KEY not configured." });
  const { image_b64, media_type } = req.body;
  if (!image_b64 || !media_type) return res.status(400).json({ error: "Missing image_b64 or media_type." });
  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({
        model: "claude-opus-4-5-20251101",
        max_tokens: 1000,
        messages: [{ role: "user", content: [
          { type: "image", source: { type: "base64", media_type, data: image_b64 } },
          { type: "text", text: ANALYSIS_PROMPT }
        ]}]
      })
    });
    if (!r.ok) return res.status(r.status).json({ error: await r.text() });
    const data = await r.json();
    let text = data.content[0].text.trim();
    const match = text.match(/{[sS]*}/);
    return res.status(200).json(JSON.parse(match ? match[0] : text));
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
