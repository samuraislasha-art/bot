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
    const state = req.query.state || null;
    const existing = req.query.c || null;

    // ===============================================================
    // SAFE HOST + PROTOCOL
    // ===============================================================
    const proto = req.headers["x-forwarded-proto"] ?? "https";
    const host = req.headers.host ?? process.env.PUBLIC_DOMAIN;
    const redirectUri = `${proto}://${host}/api/callback`;

    // ===============================================================
    // READ STATE COOKIE
    // ===============================================================
    const cookies = req.headers.cookie || "";
    const match = cookies.match(/spotify_auth_state=([^;]+)/);
    const storedState = match ? match[1] : null;

    // ===============================================================
    // 1. CHECK ❌ STATE MISMATCH
    // ===============================================================
    if (code && (!state || state !== storedState)) {
      return res.send(`
        <html><body style="font-family:sans-serif;text-align:center;margin-top:60px">
          <h1>State Mismatch</h1>
          <p>Your login attempt may be unsafe. Please try again.</p>
        </body></html>
      `);
    }

    // ===============================================================
    // 2. SAFE REFRESH WITH ?c=XXXXXX
    // ===============================================================
    if (existing) {
      const { data, error } = await supabase
        .from("spotify_tokens")
        .select("*")
        .eq("code", existing)
        .maybeSingle();

      if (error || !data) {
        return res.send(`
          <html><body style="font-family:sans-serif;text-align:center;margin-top:60px">
            <h1>❌ Code Expired</h1>
            <p>Your code is no longer valid.</p>
          </body></html>
        `);
      }

      const age = Date.now() - new Date(data.created_at).getTime();
      if (age > 2 * 60 * 1000) {
        return res.send(`
          <html><body style="font-family:sans-serif;text-align:center;margin-top:60px">
            <h1>❌ Code Expired</h1>
            <p>This code expired after 2 minutes.</p>
          </body></html>
        `);
      }

      return res.send(`
        <html><body style="font-family:sans-serif;text-align:center;margin-top:60px">
          <h1>Spotify Code</h1>
          <h2>${existing}</h2>
          <p>This code will expire in 2 minutes.</p>
          <p>You can refresh this page safely.</p>
        </body></html>
      `);
    }

    // ===============================================================
    // 3. INVALID ACCESS (No Spotify code)
    // ===============================================================
    if (!code) {
      return res.send(`
        <html><body style="font-family:sans-serif;text-align:center;margin-top:60px">
          <h1>Invalid Access</h1>
          <p>This URL must be opened from the Spotify login flow.</p>
        </body></html>
      `);
    }

    // ===============================================================
    // 4. SPOTIFY TOKEN EXCHANGE
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

    const response = await axios.post(
      "https://accounts.spotify.com/api/token",
      formData,
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization: authHeader
        }
      }
    );

    const tokenData = response.data;

    // ===============================================================
    // 5. GENERATE SHORTCODE
    // ===============================================================
    const shortCode = Array.from({ length: 6 }, () =>
      "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"[Math.floor(Math.random() * 36)]
    ).join("");

    // ===============================================================
    // 6. SAVE TO SUPABASE
    // ===============================================================
    await supabase.from("spotify_tokens").insert({
      code: shortCode,
      data: tokenData
    });

    // ===============================================================
    // 7. REDIRECT TO SAFE URL (prevents code re-use)
    // ===============================================================
    return res.redirect(`/api/callback?c=${shortCode}`);

  } catch (error) {
    console.error("Callback Error:", error?.response?.data || error);

    return res.status(500).send(`
      <html><body style="font-family:sans-serif;text-align:center;margin-top:60px">
        <h1>Internal Server Error</h1>
        <p>Something went wrong during the Spotify callback.</p>
      </body></html>
    `);
  }
}
