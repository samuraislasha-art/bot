import axios from "axios";
import querystring from "querystring";
import { createClient } from "@supabase/supabase-js";

export default async function handler(req, res) {
  try {
    console.log("SUPABASE_URL =", process.env.SUPABASE_URL);
    console.log("SUPABASE_SECRET_KEY =", process.env.SUPABASE_SECRET_KEY ? "loaded" : "missing");

    const code = req.query.code;

    if (!code) return res.status(400).send("Missing spotify code");

    const clientId = process.env.SPOTIFY_CLIENT_ID;
    const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

    const redirectUri = `${req.headers["x-forwarded-proto"] || "https"}://${req.headers.host}/api/callback`;

    const formData = querystring.stringify({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
      client_id: clientId,
      client_secret: clientSecret
    });

    const response = await axios.post(
      "https://accounts.spotify.com/api/token",
      formData,
      { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
    );

    const tokenData = response.data;

    const shortCode = [...Array(6)]
      .map(() => "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"[Math.floor(Math.random() * 36)])
      .join("");

    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SECRET_KEY
    );

    await supabase.from("spotify_tokens").insert({
      code: shortCode,
      data: tokenData
    });

    // 🚀 Prevent refresh error
    return res.redirect(`/success?c=${shortCode}`);

  } catch (error) {
    console.error("Callback Error:", error?.response?.data || error);
    return res.status(500).send("Internal Server Error");
  }
}
