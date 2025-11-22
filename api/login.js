import crypto from "crypto";
import querystring from "querystring";

export default async function handler(req, res) {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const discordId = req.query.uid; // USER ID passed from bot

  if (!discordId) {
    return res.status(400).send("Missing Discord user ID.");
  }

  if (!clientId) {
    return res.status(500).send("Missing SPOTIFY_CLIENT_ID");
  }

  // Set cookie (spotify_auth_state = Discord ID)
  res.setHeader("Set-Cookie", [
    `spotify_auth_state=${discordId}; Path=/; HttpOnly; Secure; SameSite=None; Max-Age=300`
  ]);

  const redirectUri =
    `${req.headers["x-forwarded-proto"] || "https"}://${req.headers.host}/api/callback`;

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
    state: discordId
  });

  return res.redirect(
    `https://accounts.spotify.com/authorize?${params}`
  );
}
