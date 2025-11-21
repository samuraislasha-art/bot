import crypto from "crypto";
import querystring from "querystring";

export default async function handler(req, res) {
  const clientId = process.env.SPOTIFY_CLIENT_ID;

  if (!clientId) {
    return res.status(500).send("Missing SPOTIFY_CLIENT_ID");
  }

  // ===============================================================
  // 1. GENERATE STATE VALUE
  // ===============================================================
  const state = crypto.randomBytes(16).toString("hex");

  // Set cookie (must use SameSite=None for OAuth to work)
  res.setHeader("Set-Cookie", [
    `spotify_auth_state=${state}; Path=/; HttpOnly; Secure; SameSite=None; Max-Age=300`
  ]);

  // ===============================================================
  // 2. REDIRECT URI
  // ===============================================================
  const redirectUri = `${req.headers["x-forwarded-proto"] || "https"}://${req.headers.host}/api/callback`;

  // Spotify scopes you want
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
  // 3. BUILD AUTH URL
  // ===============================================================
  const params = querystring.stringify({
    client_id: clientId,
    response_type: "code",
    redirect_uri: redirectUri,
    scope,
    state
  });

  return res.redirect(`https://accounts.spotify.com/authorize?${params}`);
}
