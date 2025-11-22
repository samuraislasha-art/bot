import crypto from "crypto";
import querystring from "querystring";

export default async function handler(req, res) {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const discordId = req.query.uid; // The user ID passed from the bot

  if (!discordId) {
    return res.status(400).send("Missing Discord user ID.");
  }

  if (!clientId) {
    return res.status(500).send("Missing SPOTIFY_CLIENT_ID");
  }

  // ===========================================================
  // 1. SET STATE = DISCORD USER ID
  // ===========================================================
  res.setHeader("Set-Cookie", [
    `spotify_auth_state=${discordId}; Path=/; HttpOnly; Secure; SameSite=None; Max-Age=300`
  ]);

  // ===========================================================
  // 2. REDIRECT URI
  // ===========================================================
  const redirectUri = `${req.headers["x-forwarded-proto"] || "https"}://${req.headers.host}/api/callback`;

  // ===========================================================
  // 3. SCOPES
  // ===========================================================
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

  const params = querystring.stringify({
    client_id: clientId,
    response_type: "code",
    redirect_uri: redirectUri,
    scope,
    state: discordId // <-- Spotify will return this back in /callback
  });

  // ===========================================================
  // 4. REDIRECT TO SPOTIFY
  // ===========================================================
  return res.redirect(`https://accounts.spotify.com/authorize?${params}`);
}
