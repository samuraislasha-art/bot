import axios from "axios";
import querystring from "querystring";
import { createClient } from "@supabase/supabase-js";

export default async function handler(req, res) {
  try {
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SECRET_KEY
    );

    const code = req.query.code;

    // ========================================================
    // 1. RETURN EXISTING CODE IF REFRESHED WITH ?c=XXXXXX
    // ========================================================
    const existing = req.query.c;
    if (existing) {
      const { data } = await supabase
        .from("spotify_tokens")
        .select("*")
        .eq("code", existing)
        .single();

      // code not found
      if (!data) {
        return res.send(`
          <html><body style="font-family:sans-serif;text-align:center;margin-top:60px">
            <h1>❌ Code Expired</h1>
            <p>Your code is no longer valid.</p>
          </body></html>
        `);
      }

      // check expiration
      const age = Date.now() - new Date(data.created_at).getTime();
      if (age > 2 * 60 * 1000) {
        return res.send(`
          <html><body style="font-family:sans-serif;text-align:center;margin-top:60px">
            <h1>❌ Code Expired</h1>
            <p>This code expired after 2 minutes.</p>
          </body></html>
        `);
      }

      // still valid → show code again
      return res.send(`
        <html><body style="font-family:sans-serif;text-align:center;margin-top:60px">
          <h1>Spotify Code</h1>
          <h2>${existing}</h2>
          <p>This code will expire in 2 minutes.</p>
        </body></html>
      `);
    }

    // ========================================================
    // 2. NORMAL SPOTIFY HANDSHAKE (FIRST TIME)
    // ========================================================
    if (!code) return res.status(400).send("Missing spotify code");

    const clientId = process.env.SPOTIFY_CLIENT_ID;
    const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

    const redirectUri = `${req.headers["x-forwarded-proto"] || "https"}://${req.headers.host}/api/callback`;

    const formData = querystring.stringify({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
      client_id: clientId,
      client_secret: clientSecret
    });

    const response = await axios.post(
      "https://accounts.spotify.com/api/token",
      formData,
      { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
    );

    const tokenData = response.data;

    // generate code
    const shortCode = [...Array(6)]
      .map(() => "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"[Math.floor(Math.random() * 36)])
      .join("");

    // store code + timestamp
    await supabase.from("spotify_tokens").insert({
      code: shortCode,
      data: tokenData
    });

    // ========================================================
    // 3. SHOW HTML INSTEAD OF REDIRECT
    // ========================================================
    return res.send(`
      <html><body style="font-family:sans-serif;text-align:center;margin-top:60px">
        <h1>Spotify Code</h1>
        <h2>${shortCode}</h2>
        <p>This code will expire in 2 minutes.</p>
        <p>You may refresh this page.</p>
      </body></html>
    `);

  } catch (error) {
    console.error("Callback Error:", error?.response?.data || error);
    return res.status(500).send("Internal Server Error");
  }
}
