import querystring from "querystring";
import axios from "axios";
import { supabase } from "../../utils/supabaseClient";
import { saveUserTokens } from "../../utils/spotify";

export default async function handler(req, res) {
  const code = req.query.code;
  const discordId = req.query.state;

  if (!code || !discordId) return res.status(400).send("Missing parameters.");

  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

  const redirectUri = `${req.headers["x-forwarded-proto"] || "https"}://${req.headers.host}/api/callback`;

  const tokenRes = await axios({
    url: "https://accounts.spotify.com/api/token",
    method: "post",
    data: querystring.stringify({
      code,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
    headers: {
      Authorization:
        "Basic " +
        Buffer.from(`${clientId}:${clientSecret}`).toString("base64"),
      "Content-Type": "application/x-www-form-urlencoded",
    },
  }).catch(() => null);

  if (!tokenRes) return res.status(500).send("Token exchange failed.");

  const tokens = {
    ...tokenRes.data,
    created: Date.now()
  };

  await saveUserTokens(discordId, tokens);

  return res.send(`
  <html>
  <body style="background:#000;color:#fff;text-align:center;padding-top:150px;font-family:Arial">
    <img src="https://i.imgur.com/2t6rk6c.png" width="80">
    <h1>Spotify Linked!</h1>
    <p>You may now close this window.</p>
  </body>
  </html>
  `);
}
