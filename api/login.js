const crypto = require("crypto");
const querystring = require("querystring");

module.exports = async function handler(req, res) {
  const clientId = process.env.SPOTIFY_CLIENT_ID;

  if (!clientId) {
    return res.status(500).send("Missing SPOTIFY_CLIENT_ID");
  }

  // ===============================================================
  // 1. GENERATE STATE (security against CSRF)
  // ===============================================================
  const state = crypto.randomBytes(16).toString("hex");

  // Set secure httpOnly cookie for state
  res.setHeader("Set-Cookie", [
    `spotify_auth_state=${state}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=300`
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
    state // IMPORTANT
  });

  return res.redirect(`https://accounts.spotify.com/authorize?${params}`);
};
