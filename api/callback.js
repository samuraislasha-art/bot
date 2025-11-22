import querystring from "querystring";
import axios from "axios";
import { supabase } from "../utils/supabaseClient.js"; // correct path

export default async function handler(req, res) {
  const code = req.query.code;
  const state = req.query.state; // Discord ID from auth URL

  if (!code || !state) {
    return res.status(400).send("Missing code or state.");
  }

  // Read cookie
  const cookies = req.headers.cookie || "";
  const match = cookies.match(/spotify_auth_state=([^;]+)/);
  const storedState = match ? match[1] : null;

  if (!storedState || storedState !== state) {
    return res.status(400).send("State mismatch.");
  }

  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

  const redirectUri =
    `${req.headers["x-forwarded-proto"] || "https"}://${req.headers.host}/api/callback`;

  // Exchange code for token
  let tokenResponse;
  try {
    tokenResponse = await axios({
      url: "https://accounts.spotify.com/api/token",
      method: "post",
      data: querystring.stringify({
        code,
        redirect_uri: redirectUri,
        grant_type: "authorization_code"
      }),
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization:
          "Basic " +
          Buffer.from(`${clientId}:${clientSecret}`).toString("base64")
      }
    });
  } catch (err) {
    console.error(err.response?.data);
    return res.status(500).send("Failed to get Spotify tokens");
  }

  const tokens = tokenResponse.data;

  // Store tokens
  await supabase
    .from("spotify_tokens")
    .upsert({
      discord_id: state,
      data: tokens,
      created_at: new Date().toISOString()
    });

  // UI page (Spotify dark theme)
  return res.send(`
  <html>
  <head>
    <style>
    body {
      margin: 0;
      background: #121212;
      color: #fff;
      font-family: Arial;
      text-align: center;
      padding-top: 120px;
    }
    img { width: 90px; margin-bottom: 30px; }
    </style>
  </head>
  <body>
    <img src="https://i.imgur.com/2t6rk6c.png" />
    <h1>Spotify Linked!</h1>
    <p>Your Discord account is now connected.</p>
    <p>You may close this window.</p>
  </body>
  </html>
  `);
}
