// /api/callback.js
import axios from "axios";
import querystring from "querystring";
import { createClient } from "@supabase/supabase-js";

export default async function handler(req, res) {
  try {
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SECRET_KEY
    );

    const code = req.query.code || null;
    const state = req.query.state || null; // includes DISCORD ID
    const existing = req.query.c || null;

    // ===============================================================
    // REBUILD REDIRECT URI (required for Vercel)
    // ===============================================================
    const proto = req.headers["x-forwarded-proto"] || "https";
    const host = req.headers.host || process.env.PUBLIC_DOMAIN;
    const redirectUri = `${proto}://${host}/api/callback`;

    // ===============================================================
    // READ STATE COOKIE (contains same Discord ID + salt)
    // ===============================================================
    const cookies = req.headers.cookie || "";
    const match = cookies.match(/spotify_auth_state=([^;]+)/);
    const storedState = match ? match[1] : null;

    // ===============================================================
    // ❌ INVALID — NO STATE / MISMATCH
    // ===============================================================
    if (code && (!state || state !== storedState)) {
      return res.send(`
        <html><body style="background:black;color:white;text-align:center;margin-top:120px;font-family:sans-serif">
          <img src="https://upload.wikimedia.org/wikipedia/commons/1/19/Spotify_logo_without_text.svg" width="90"/>
          <h1 style="margin-top:30px;">❌ State Mismatch</h1>
          <p>Your login attempt was rejected for security reasons.</p>
        </body></html>
      `);
    }

    // ===============================================================
    // SAFE REFRESH MODE (?c=XXXXXX)
    // ===============================================================
    if (existing) {
      const { data } = await supabase
        .from("spotify_tokens")
        .select("*")
        .eq("code", existing)
        .maybeSingle();

      if (!data) {
        return res.send(`
          <html><body style="background:black;color:white;text-align:center;margin-top:120px;font-family:sans-serif">
            <img src="https://upload.wikimedia.org/wikipedia/commons/1/19/Spotify_logo_without_text.svg" width="90"/>
            <h1 style="margin-top:30px;">❌ Code Expired</h1>
            <p>This login code no longer exists.</p>
          </body></html>
        `);
      }

      return res.send(`
        <html><body style="background:black;color:white;text-align:center;margin-top:120px;font-family:sans-serif">
          <img src="https://upload.wikimedia.org/wikipedia/commons/1/19/Spotify_logo_without_text.svg" width="90"/>
          <h1 style="margin-top:30px;">Your Spotify Login Code</h1>
          <h2 style="font-size:48px;letter-spacing:8px;margin:20px 0;">${existing}</h2>
          <p>Enter this in Discord to complete login.</p>
          <p style="opacity:0.7;">Do not share this code.</p>
        </body></html>
      `);
    }

    // ===============================================================
    // INVALID — no Spotify code
    // ===============================================================
    if (!code) {
      return res.send(`
        <html><body style="background:black;color:white;text-align:center;margin-top:120px;font-family:sans-serif">
          <h1>Invalid Access</h1>
          <p>You must start login from Discord.</p>
        </body></html>
      `);
    }

    // ===============================================================
    // PARSE DISCORD ID OUT OF STATE
    // ===============================================================
    const discordId = state.split("_")[0];
    if (!discordId) {
      return res.send(`
        <html><body style="background:black;color:white;text-align:center;margin-top:120px;font-family:sans-serif">
          <h1>Missing Discord User</h1>
          <p>Your login attempt was missing a Discord account link.</p>
        </body></html>
      `);
    }

    // ===============================================================
    // EXCHANGE SPOTIFY CODE FOR TOKENS
    // ===============================================================
    const formData = querystring.stringify({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri
    });

    const authHeader =
      "Basic " +
      Buffer.from(
        process.env.SPOTIFY_CLIENT_ID + ":" + process.env.SPOTIFY_CLIENT_SECRET
      ).toString("base64");

    const tokenResponse = await axios.post(
      "https://accounts.spotify.com/api/token",
      formData,
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization: authHeader
        }
      }
    );

    const tokenData = tokenResponse.data;

    // ===============================================================
    // GENERATE 6-digit LOGIN CODE
    // ===============================================================
    const shortCode = Array.from({ length: 6 }, () =>
      "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"[Math.floor(Math.random() * 36)]
    ).join("");

    // ===============================================================
    // DELETE OLD LOGIN FOR THIS DISCORD USER
    // (ONLY 1 Spotify link per user)
    // ===============================================================
    await supabase
      .from("spotify_tokens")
      .delete()
      .eq("discord_id", discordId);

    // ===============================================================
    // INSERT NEW TOKEN ROW
    // ===============================================================
    await supabase.from("spotify_tokens").insert({
      code: shortCode,
      data: tokenData,
      discord_id: discordId
    });

    // ===============================================================
    // REDIRECT BACK TO SELF TO SHOW PRETTY PAGE
    // ===============================================================
    return res.redirect(`/api/callback?c=${shortCode}`);

  } catch (error) {
    console.error("Callback Error:", error?.response?.data || error);

    return res.status(500).send(`
      <html><body style="background:black;color:white;text-align:center;margin-top:100px;font-family:sans-serif">
        <img src="https://upload.wikimedia.org/wikipedia/commons/1/19/Spotify_logo_without_text.svg" width="90" />
        <h1 style="margin-top:30px;">Internal Error</h1>
        <p>Something went wrong during the callback.</p>
      </body></html>
    `);
  }
}
