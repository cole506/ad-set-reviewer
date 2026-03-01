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
- "good" → subject fully visible, clear space/margin on all 4 sides between subject and frame edge (0pts)
- "face_warn" → face is partially out of frame BUT both eyes AND mouth are clearly visible (1pt issue, do NOT deny the creative)
- "dead_space" → large areas of wasted/empty space that should be cropped out (1pt issue)
- "cut_off" → face is cropped so that eyes OR mouth are hidden, OR a non-face subject is significantly cut off at the edge (2pt issue)
- "too_tight" → subject fills the frame with little or no margin between the subject and the frame edges (2pt issue). Use these two rules based on whether a person is in the photo:
  - IF A PERSON IS IN THE FRAME: Judge the crop by the person. If the person has breathing room around them and is not pushed against the edges, the crop is fine — even if the roof or house fills the rest of the frame. Only flag if the person themselves is cramped against the edges.
  - IF NO PERSON IS IN THE FRAME: You must be strict. Look at all 4 edges of the photo. If the house, roof, or main subject touches or nearly touches the frame edge on 3 or more sides — flag it as too_tight, even if nothing is technically cut off. A correctly cropped house photo should have visible sky above, lawn or driveway below, and open space on the sides. An aerial drone shot where the house fills the entire frame with no lawn or surroundings visible is a clear too_tight example and must be flagged.

Brightness:
- "perfect" → well-balanced, details are clear
- "too_dark" → under-exposed, hard to see details (1pt issue)
- "too_bright" → over-exposed or washed out (1pt issue)

## STEP 4 — AI IMAGE CHECK
Does this image appear AI-generated? If so, check each of the following:

- distorted_logo: Company logo is AI-distorted — letters are warped, morphed, or illegible in a way typical of AI generation (NOT just pixelated/low-res — pixelation is fine). true = BAD, 3pt issue, auto-deny creative.
- jumbled_text: Any text in the image garbled, unreadable, or nonsensical in an AI-artifact way? true = BAD, 3pt issue, auto-deny creative.
- duplicate_people: Same face appears more than once in the image? true = BAD, 3pt issue, auto-deny creative.
- logo_spammed: Logo appears more than twice within a single photo/panel? true = BAD, 3pt issue, auto-deny creative. Note: evaluate each panel individually — a logo appearing once per panel across multiple panels is fine.
- generic_ai_face: AI-generated generic/stock-looking faces used when real company reps exist (owners, salespeople). true = BAD, 3pt issue, auto-deny creative. Note: generic faces are fine for background laborers only.

## STEP 5 — FORMAT RULE CHECK
- Single: MUST include at least Trust or Service. Brand elements are ALLOWED in a Single as long as Trust is ALSO present (e.g., a branded vehicle with a happy rep = OK). A Single that contains ONLY Brand with NO Trust and NO Service is a violation (1pt issue).
- Two-fold: The two photos SHOULD be different types. If both photos are the same type, write the violation as plain English like: "Both photos are Service photos. A Two-Fold should mix two different types — for example, one Service photo and one Trust photo." Adjust the type name based on what you actually see.
- Tri-fold: Ideally includes a mix of Trust, Service, and Brand — but Brand is NOT required. Missing Brand is NOT a violation. Only flag if Trust AND Service are both missing.

## IMPORTANT — HOW TO WRITE VIOLATIONS
Write ALL format_rule_violations as short, plain English sentences. Do NOT use code-style keys like "same_type_pairing" or "missing_brand_in_trifold". Write it like you're explaining it to someone learning English — simple, direct, and specific about what the problem is and what to fix. Example: "Both photos are Service photos. Use one Service and one Trust photo instead."

- 3pt issues (auto-deny the individual creative): distorted_logo, jumbled_text, duplicate_people, logo_spammed, generic_ai_face
- 2pt issues (flag the creative): cut_off crop, too_tight crop
- 1pt issues (flag the creative): face_warn crop, dead_space crop, bad brightness, any format rule violation

## SCORING INSTRUCTIONS
Calculate issue_points for this creative by summing all issues found:
- Each 3pt AI issue found = 3 points each
- Each 1pt editing/format issue found = 1 point each
- A creative with 0 points = approved (green)
- A creative with 1-2 points = flagged (yellow) — set approved:true, flagged:true
- A creative with 3+ points = denied (red) — set approved:false, flagged:false

## OUTPUT
Return ONLY raw JSON — no markdown, no backticks, no explanation:
{
  "format": "single" | "two_fold" | "tri_fold",
  "photo_types": ["trust","service","brand"],
  "cropping": "good" | "face_warn" | "cut_off" | "too_tight" | "dead_space",
  "brightness": "perfect" | "too_dark" | "too_bright",
  "appears_ai_generated": true | false,
  "ai_issues": {
    "distorted_logo": false,
    "jumbled_text": false,
    "duplicate_people": false,
    "logo_spammed": false,
    "generic_ai_face": false
  },
  "format_rule_violations": [],
  "issue_points": 0,
  "approved": true | false,
  "flagged": false,
  "rejection_reasons": [],
  "notes": "1-2 sentence overall assessment"
}`;

module.exports = async function handler(req, res) {
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

    // Server-side safety: recalculate issue_points and approved/flagged
    // to ensure consistency regardless of what the model returns
    let points = 0;
    const ai = result.ai_issues || {};
    const THREE_PT_ISSUES = ["distorted_logo", "jumbled_text", "duplicate_people", "logo_spammed", "generic_ai_face"];
    THREE_PT_ISSUES.forEach(k => { if (ai[k]) points += 3; });

    if (result.cropping && result.cropping !== 'good') {
      if (result.cropping === 'cut_off' || result.cropping === 'too_tight') {
        points += 2;
      } else {
        points += 1; // face_warn, dead_space
      }
    }
    if (result.brightness && result.brightness !== "perfect") points += 1;
    if (result.format_rule_violations && result.format_rule_violations.length > 0) {
      points += result.format_rule_violations.length;
    }

    result.issue_points = points;
    result.approved = points < 3;
    result.flagged  = points >= 1 && points < 3;

    return res.status(200).json(result);

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
