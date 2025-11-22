// /api/login.js
import crypto from "crypto";
import querystring from "querystring";

export default async function handler(req, res) {
  try {
    const clientId = process.env.SPOTIFY_CLIENT_ID;

    if (!clientId) {
      return res.status(500).send("Missing SPOTIFY_CLIENT_ID");
    }

    // ===============================================================
    // REQUIRED: Discord ID passed as ?uid=123
    // ===============================================================
    const discordId = req.query.uid;
    if (!discordId) {
      return res.status(400).send(`
        <html><body style="background:black;color:white;text-align:center;margin-top:120px;font-family:sans-serif">
          <img src="https://upload.wikimedia.org/wikipedia/commons/1/19/Spotify_logo_without_text.svg" width="90" />
          <h1 style="margin-top:30px;">Missing Discord ID</h1>
          <p>You must start login from Discord.</p>
        </body></html>
      `);
    }

    // ===============================================================
    // 1. GENERATE STATE (this time: Discord ID + random salt)
    // ===============================================================
    const state = `${discordId}_${crypto.randomBytes(12).toString("hex")}`;

    // Save cookie securely
    res.setHeader("Set-Cookie", [
      `spotify_auth_state=${state}; Path=/; HttpOnly; Secure; SameSite=None; Max-Age=300`
    ]);

    // ===============================================================
    // 2. REDIRECT URI
    // ===============================================================
    const redirectUri = `${req.headers["x-forwarded-proto"] || "https"}://${req.headers.host}/api/callback`;

    // Spotify scopes
    const scope = [
      "user-read-playback-state",
      "user-modify-playback-state",
      "user-read-currently-playing",
      "user-read-private",
      "user-read-email",
      "user-library-read",
      "user-library-modify",
      "user-top-read"
    ].join(" ");

    // ===============================================================
    // 3. AUTH URL
    // ===============================================================
    const params = querystring.stringify({
      client_id: clientId,
      response_type: "code",
      redirect_uri: redirectUri,
      scope,
      state
    });

    // Redirect to Spotify
    return res.redirect(`https://accounts.spotify.com/authorize?${params}`);

  } catch (err) {
    console.error("Login Error:", err);
    return res.status(500).send(`
      <html><body style="background:black;color:white;text-align:center;margin-top:120px;font-family:sans-serif">
        <img src="https://upload.wikimedia.org/wikipedia/commons/1/19/Spotify_logo_without_text.svg" width="90" />
        <h1 style="margin-top:30px;">Internal Error</h1>
        <p>Failed creating login session.</p>
      </body></html>
    `);
  }
}
