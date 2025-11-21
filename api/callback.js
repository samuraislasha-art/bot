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
    const existing = req.query.c || null;

    // =========================================================================
    // 0. FIX FOR PROTOCOL + HOST (always safe)
    // =========================================================================
    const proto = req.headers["x-forwarded-proto"] ?? "https";
    const host = req.headers.host ?? process.env.PUBLIC_DOMAIN;
    const redirectUri = `${proto}://${host}/api/callback`;

    // =========================================================================
    // 1. REFRESHING PAGE WITH ?c=XXXXXX
    // =========================================================================
    if (existing) {
      const { data, error } = await supabase
        .from("spotify_tokens")
        .select("*")
        .eq("code", existing)
        .maybeSingle();

      // invalid, expired, or not found
      if (error || !data) {
        return res.send(`
          <html><body style="font-family:sans-serif;text-align:center;margin-top:60px">
            <h1>❌ Code Expired</h1>
            <p>Your code is no longer valid or has been removed.</p>
          </body></html>
        `);
      }

      // expiration check
      const age = Date.now() - new Date(data.created_at).getTime();
      if (age > 2 * 60 * 1000) {
        return res.send(`
          <html><body style="font-family:sans-serif;text-align:center;margin-top:60px">
            <h1>❌ Code Expired</h1>
            <p>This code expired after 2 minutes.</p>
          </body></html>
        `);
      }

      // still valid
      return res.send(`
        <html><body style="font-family:sans-serif;text-align:center;margin-top:60px">
          <h1>Spotify Code</h1>
          <h2>${existing}</h2>
          <p>This code will expire in 2 minutes.</p>
          <p>You may refresh this page.</p>
        </html></body>
      `);
    }

    // =========================================================================
    // 2. VISITING /api/callback WITHOUT ANY CODE
    // =========================================================================
    if (!code) {
      return res.send(`
        <html><body style="font-family:sans-serif;text-align:center;margin-top:60px">
          <h1>Invalid Access</h1>
          <p>This page must be opened through Spotify's login flow.</p>
        </body></html>
      `);
    }

    // =========================================================================
    // 3. FIRST-TIME SPOTIFY LOGIN: EXCHANGE AUTH CODE FOR TOKEN
    // =========================================================================
    const clientId = process.env.SPOTIFY_CLIENT_ID;
    const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

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

    // =========================================================================
    // 4. GENERATE 6-CHAR SHORT CODE
    // =========================================================================
    const shortCode = Array.from({ length: 6 }, () =>
      "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"[Math.floor(Math.random() * 36)]
    ).join("");

    // =========================================================================
    // 5. STORE CODE IN SUPABASE
    // =========================================================================
    const { error: insertError } = await supabase
      .from("spotify_tokens")
      .insert({
        code: shortCode,
        data: tokenData
      });

    if (insertError) {
      console.error("Supabase Insert Error:", insertError);
      return res.send(`
        <html><body style="font-family:sans-serif;text-align:center;margin-top:60px">
          <h1>Internal Error</h1>
          <p>Could not store your Spotify token. Please try again.</p>
        </body></html>
      `);
    }

    // =========================================================================
    // 6. RETURN HTML WITH SHORT CODE
    // =========================================================================
    return res.send(`
      <html><body style="font-family:sans-serif;text-align:center;margin-top:60px">
        <h1>Spotify Code</h1>
        <h2>${shortCode}</h2>
        <p>This code will expire in 2 minutes.</p>
        <p>You may refresh this page.</p>
      </body></html>
    `);

  } catch (error) {
    console.error("Callback Error:", error);
    return res.status(500).send(`
      <html><body style="font-family:sans-serif;text-align:center;margin-top:60px">
        <h1>Internal Server Error</h1>
        <p>Something went wrong during the Spotify callback.</p>
      </body></html>
    `);
  }
}
