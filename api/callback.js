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

    const code = req.query.code;
    const state = req.query.state; // THIS IS DISCORD USER ID

    if (!code || !state) {
      return res.send("Missing code or Discord ID.");
    }

    // Validate state cookie
    const cookieState = (req.headers.cookie || "").match(/spotify_auth_state=([^;]+)/)?.[1];
    if (!cookieState || cookieState !== state) {
      return res.status(400).send("Invalid or missing state cookie.");
    }

    const redirectUri = `${req.headers["x-forwarded-proto"] || "https"}://${req.headers.host}/api/callback`;

    // Exchange for tokens
    const form = querystring.stringify({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri
    });

    const auth =
      "Basic " +
      Buffer.from(
        process.env.SPOTIFY_CLIENT_ID + ":" + process.env.SPOTIFY_CLIENT_SECRET
      ).toString("base64");

    const tokenRes = await axios.post(
      "https://accounts.spotify.com/api/token",
      form,
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization: auth
        }
      }
    );

    const tokenData = tokenRes.data;

    // Delete old row for this Discord user
    await supabase.from("spotify_tokens").delete().eq("discord_id", state);

    // Insert new tokens
    await supabase.from("spotify_tokens").insert({
      discord_id: state,
      data: tokenData
    });

    // 🔥 FINAL PAGE — NO CODE REQUIRED
    return res.send(`
      <html>
        <body style="background:black;color:white;text-align:center;margin-top:100px;font-family:Arial">
          <img src="https://upload.wikimedia.org/wikipedia/commons/1/19/Spotify_logo_without_text.svg" width="90"/>
          <h1 style="margin-top:30px;">Spotify Linked!</h1>
          <p>Your Discord account is now connected to Spotify.</p>
          <p>You can close this window.</p>
        </body>
      </html>
    `);

  } catch (err) {
    console.error(err);
    return res.status(500).send("Internal Server Error");
  }
}
