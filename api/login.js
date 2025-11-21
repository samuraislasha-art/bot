const querystring = require("querystring");

module.exports = async function handler(req, res) {
  const clientId = process.env.SPOTIFY_CLIENT_ID;

  if (!clientId) {
    return res.status(500).send("Missing SPOTIFY_CLIENT_ID");
  }

  const redirectUri = `${req.headers["x-forwarded-proto"] || "https"}://${req.headers.host}/api/callback`;

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
    scope
  });

  return res.redirect(`https://accounts.spotify.com/authorize?${params}`);
};
