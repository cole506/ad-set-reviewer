// Vercel Serverless Function — Ad Set 101 Analyzer
// Proxies image analysis requests to the Anthropic API.
// Set ANTHROPIC_API_KEY in your Vercel project environment variables.

const ANALYSIS_PROMPT = `You are a quality control specialist for digital ad creatives for roofing and HVAC companies.

Analyze this ad creative image strictly against the Creative Mastery Ad Set 101 SOP.

## STEP 1 — AD FORMAT
Identify the layout of this creative:
- "single": One full-frame photo fills the entire creative
- "two_fold": Two photos side by side or stacked in one creative
- "tri_fold": Three photos in a tiled/grid layout in one creative

## STEP 2 — PHOTO TYPES PRESENT
For each panel, identify the types used (list all that apply):
- "trust": Happy person(s) — conveys positivity and trust (solo, team, roofer+homeowner, happy homeowners)
- "service": Roofing or HVAC work — completed (ideal) or in progress, OR any photo of a house exterior where the roof is clearly visible (even without workers present)
- "brand": Company branding — vehicle, branded clothing, or lawn signs

## STEP 3 — EDITING QUALITY
Cropping:
- "good" → subject fully visible, space on all 4 sides, no wasted space
- "face_warn" → face is partially out of frame BUT both eyes AND mouth are clearly visible (issue a warning, do NOT deny)
- "cut_off" → face is cropped so that eyes OR mouth are hidden, OR a non-face subject is significantly cut off (deny)
- "too_tight" → crop is so close there is zero breathing room
- "dead_space" → large areas of wasted/empty space that should be cropped

Brightness:
- "perfect" → well-balanced, details are clear
- "too_dark" → under-exposed, hard to see details
- "too_bright" → over-exposed or washed out

## STEP 4 — AI IMAGE CHECK
Does this image appear AI-generated? If so, check:
- blurred_logo: Company logo blurry, distorted, or has garbled text? (true = BAD)
- jumbled_text: Any text in the image garbled, unreadable, or nonsensical? (true = BAD)
- duplicate_people: Same face appears more than once in the image? (true = BAD)
- logo_spammed: Logo appears excessively/unnecessarily throughout? (true = BAD)
- inconsistent_likeness: AI versions do NOT look like the real reference person? (true = BAD)

## STEP 5 — FORMAT RULE CHECK
- Single: MUST include at least Trust or Service. Brand elements are ALLOWED in a Single as long as Trust is ALSO present (e.g., a branded vehicle with a happy rep = OK). A Single that contains ONLY Brand with NO Trust and NO Service is a violation.
- Two-fold: SHOULD pair different photo types
- Tri-fold: SHOULD include a mix of Trust, Service, and Brand

## OUTPUT
Return ONLY raw JSON — no markdown, no backticks, no explanation:
{
  "format": "single" | "two_fold" | "tri_fold",
  "photo_types": ["trust","service","brand"],
  "cropping": "good" | "face_warn" | "cut_off" | "too_tight" | "dead_space",
  "brightness": "perfect" | "too_dark" | "too_bright",
  "appears_ai_generated": true | false,
  "ai_issues": {
    "blurred_logo": false,
    "jumbled_text": false,
    "duplicate_people": false,
    "logo_spammed": false,
    "inconsistent_likeness": false
  },
  "format_rule_violations": [],
  "approved": true | false,
  "rejection_reasons": [],
  "notes": "1-2 sentence overall assessment"
}`;

module.exports = async function handler(req, res) {
  // CORS headers so the frontend can call this from any origin
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "ANTHROPIC_API_KEY not configured on server." });
  }

  const { image_b64, media_type } = req.body;
  if (!image_b64 || !media_type) {
    return res.status(400).json({ error: "Missing image_b64 or media_type." });
  }

  try {
    const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-opus-4-5-20251101",
        max_tokens: 1000,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image",
                source: { type: "base64", media_type, data: image_b64 },
              },
              { type: "text", text: ANALYSIS_PROMPT },
            ],
          },
        ],
      }),
    });

    if (!anthropicRes.ok) {
      const errText = await anthropicRes.text();
      return res.status(anthropicRes.status).json({ error: errText });
    }

    const data = await anthropicRes.json();
    let text = data.content[0].text.trim();

    // Strip any markdown code fences the model might add
    if (text.includes("```")) {
      const parts = text.split("```");
      text = parts[1] || parts[0];
      if (text.startsWith("json")) text = text.slice(4);
    }

    const result = JSON.parse(text.trim());
    return res.status(200).json(result);

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
