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
    const state = req.query.state || null; // DISCORD USER ID
    const existing = req.query.c || null;

    const proto = req.headers["x-forwarded-proto"] ?? "https";
    const host = req.headers.host ?? process.env.PUBLIC_DOMAIN;
    const redirectUri = `${proto}://${host}/api/callback`;

    // Read state cookie
    const cookies = req.headers.cookie || "";
    const match = cookies.match(/spotify_auth_state=([^;]+)/);
    const storedState = match ? match[1] : null;

    // --------------------------------------------
    // STATE CHECK (security)
    // --------------------------------------------
    if (code && (!state || state !== storedState)) {
      return res.send(`
      <html><body style="font-family:sans-serif;text-align:center;margin-top:60px">
        <h1>❌ State Mismatch</h1>
        <p>Your Spotify login attempt was rejected.</p>
      </body></html>`);
    }

    // --------------------------------------------
    // SAFE PAGE REFRESH MODE (?c=XXXXXX)
    // --------------------------------------------
    if (existing) {
      const { data } = await supabase
        .from("spotify_tokens")
        .select("*")
        .eq("code", existing)
        .maybeSingle();

      if (!data) {
        return res.send(`
        <html><body style="font-family:sans-serif;text-align:center;margin-top:100px;color:white;background:#000">
          <img src="https://upload.wikimedia.org/wikipedia/commons/1/19/Spotify_logo_without_text.svg" width="80" />
          <h1 style="margin-top:30px;">❌ Code Expired</h1>
          <p>Your code is no longer valid.</p>
        </body></html>`);
      }

      return res.send(`
      <html><body style="font-family:sans-serif;text-align:center;margin-top:100px;color:white;background:#000">
        <img src="https://upload.wikimedia.org/wikipedia/commons/1/19/Spotify_logo_without_text.svg" width="80" />
        <h1 style="margin-top:30px;">Your Spotify Login Code</h1>
        <h2 style="font-size:48px;letter-spacing:8px;">${existing}</h2>
        <p>This code will expire soon. Do not share it.</p>
      </body></html>`);
    }

    // --------------------------------------------
    // NO SPOTIFY CODE?
    // --------------------------------------------
    if (!code) {
      return res.send(`
      <html><body style="font-family:sans-serif;text-align:center;margin-top:60px">
        <h1>Invalid Access</h1>
        <p>You must login from Discord.</p>
      </body></html>`);
    }

    // --------------------------------------------
    // SPOTIFY TOKEN EXCHANGE
    // --------------------------------------------
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

    // --------------------------------------------
    // GENERATE 6-DIGIT SHORT CODE
    // --------------------------------------------
    const shortCode = Array.from({ length: 6 }, () =>
      "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"[Math.floor(Math.random() * 36)]
    ).join("");

    // --------------------------------------------
    // DELETE OLD LOGIN FOR THIS DISCORD USER
    // --------------------------------------------
    await supabase
      .from("spotify_tokens")
      .delete()
      .eq("discord_id", state);

    // --------------------------------------------
    // INSERT NEW LOGIN
    // --------------------------------------------
    await supabase.from("spotify_tokens").insert({
      code: shortCode,
      data: tokenData,
      discord_id: state
    });

    // --------------------------------------------
    // REDIRECT TO SELF WITH ?c=XXXXXX
    // --------------------------------------------
    return res.redirect(`/api/callback?c=${shortCode}`);

  } catch (err) {
    console.error("Callback Error:", err?.response?.data || err);
    return res.status(500).send(`
    <html><body style="font-family:sans-serif;text-align:center;margin-top:60px">
      <h1>Server Error</h1>
      <p>Something went wrong during Spotify authentication.</p>
    </body></html>`);
  }
}
