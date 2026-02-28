# Ad Set 101 Reviewer — Vercel Deployment Guide

Deploy in ~5 minutes. Your team gets a permanent URL like `your-app.vercel.app`.

---

## Prerequisites
- A [GitHub](https://github.com) account (free)
- A [Vercel](https://vercel.com) account (free)
- An [Anthropic API key](https://console.anthropic.com) (costs ~$0.01–0.05 per full set review)

---

## Step 1 — Push to GitHub

1. Create a new repository on GitHub (name it `ad-set-reviewer`)
2. Upload these 3 files:
   - `index.html`
   - `api/analyze.js`
   - `vercel.json`

---

## Step 2 — Deploy on Vercel

1. Go to [vercel.com](https://vercel.com) → **New Project**
2. Import your `ad-set-reviewer` GitHub repo
3. Leave all settings at defaults — click **Deploy**

---

## Step 3 — Add Your API Key

1. In Vercel, go to your project → **Settings** → **Environment Variables**
2. Add a new variable:
   - **Key:** `ANTHROPIC_API_KEY`
   - **Value:** `sk-ant-...` (your key from console.anthropic.com)
3. Click **Save** — Vercel will auto-redeploy

---

## Done!

Your app is live at `https://ad-set-reviewer.vercel.app` (or whatever Vercel assigns).

Share the URL with your team. No login required — just open and upload.

---

## Updating the App

Any changes pushed to your GitHub repo will auto-deploy on Vercel within ~30 seconds.

---

## Cost Estimate

Using `claude-opus-4-5`: ~$0.015 per image analyzed.
A full 15-creative set costs roughly **$0.15–$0.25** per review.
