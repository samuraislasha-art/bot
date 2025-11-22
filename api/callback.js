import querystring from "querystring";
import axios from "axios";
import { supabase } from "../../utils/supabaseClient"; // Adjust path if needed

export default async function handler(req, res) {
  const code = req.query.code || null;
  const discordId = req.query.state || null; // IMPORTANT: Discord user ID

  if (!code || !discordId) {
    return res.status(400).send("Missing code or Discord ID.");
  }

  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

  const redirectUri = `${req.headers["x-forwarded-proto"] || "https"}://${req.headers.host}/api/callback`;

  // =============================================================
  // 1. EXCHANGE CODE FOR TOKENS
  // =============================================================
  let tokenResponse;
  try {
    tokenResponse = await axios({
      url: "https://accounts.spotify.com/api/token",
      method: "post",
      data: querystring.stringify({
        code: code,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization:
          "Basic " +
          Buffer.from(`${clientId}:${clientSecret}`).toString("base64"),
      },
    });
  } catch (err) {
    console.error("Token error:", err.response?.data || err);
    return res.status(500).send("Failed to obtain Spotify tokens");
  }

  const tokens = tokenResponse.data;

  // =============================================================
  // 2. SAVE TO SUPABASE (one user = one row)
  // =============================================================
  await supabase.from("spotify_tokens").upsert({
    code: discordId,       // code = discord user id (primary key)
    discord_id: discordId, // ensure stored properly
    data: tokens,
    created_at: new Date().toISOString(),
  });

  // =============================================================
  // 3. BEAUTIFUL SPOTIFY SUCCESS PAGE
  // =============================================================
  res.setHeader("Content-Type", "text/html");
  return res.send(`
  <!DOCTYPE html>
  <html lang="en" class="encore-dark-theme">
  <head>
    <meta charset="UTF-8" />
    <title>Spotify Linked</title>

    <style>
      .encore-dark-theme, .encore-dark-theme .encore-base-set {
        --background-base: #121212;
        --background-highlight: #1f1f1f;
        --background-press: #000;
        --background-elevated-base: #1f1f1f;
        --background-elevated-highlight: #2a2a2a;
        --background-elevated-press: #191919;
        --background-tinted-base: #ffffff1a;
        --background-tinted-highlight: #ffffff24;
        --background-tinted-press: #ffffff36;
        --text-base: #fff;
        --text-subdued: #b3b3b3;
        --text-bright-accent: #1ed760;
        --text-negative: #f3727f;
        --text-warning: #ffa42b;
        --text-positive: #1ed760;
        --text-announcement: #4cb3ff;
        --essential-base: #fff;
        --essential-subdued: #7c7c7c;
        --essential-bright-accent: #1ed760;
        --essential-negative: #ed2c3f;
        --essential-warning: #ffa42b;
        --essential-positive: #1ed760;
        --essential-announcement: #4cb3ff;
        --decorative-base: #fff;
        --decorative-subdued: #292929;
      }

      body {
        background: var(--background-base);
        font-family: Arial, Helvetica, sans-serif;
        color: var(--text-base);
        text-align: center;
        padding-top: 120px;
      }

      .spotify-logo {
        width: 120px;
        margin-bottom: 30px;
      }

      .title {
        font-size: 42px;
        font-weight: bold;
        margin-bottom: 20px;
      }

      .desc {
        font-size: 18px;
        color: var(--text-subdued);
        margin-top: 10px;
      }
    </style>
  </head>

  <body>
      <img class="spotify-logo" src="https://upload.wikimedia.org/wikipedia/commons/1/19/Spotify_logo_without_text.svg"/>

      <div class="title">Spotify Linked!</div>

      <div class="desc">
        Your Discord account is now connected to Spotify.<br>
        You may close this window.
      </div>
  </body>
  </html>
  `);
}
