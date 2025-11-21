import { createClient } from "@supabase/supabase-js";

export default async function handler(req, res) {
  try {
    // support BOTH GET and POST
    const code =
      req.body?.code?.toUpperCase() ||
      req.query.code?.toUpperCase();

    const userId =
      req.body?.userId ||
      req.query.userId;

    if (!code || !userId) {
      return res.status(400).json({ error: "Missing code or userId" });
    }

    // supabase
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SECRET_KEY
    );

    // find the shortCode row
    const { data, error } = await supabase
      .from("spotify_tokens")
      .select("*")
      .eq("code", code)
      .single();

    if (error || !data) {
      return res.status(404).json({ error: "Invalid code" });
    }

    // save to your bot storage
    const tokenData = data.data;
    const fs = require("fs");
    const path = require("path");

    const file = path.join(process.cwd(), "data/spotify/users", `${userId}.json`);
    fs.mkdirSync(path.dirname(file), { recursive: true });

    fs.writeFileSync(
      file,
      JSON.stringify({
        ...tokenData,
        created: Date.now()
      }, null, 2)
    );

    // delete from supabase
    await supabase
      .from("spotify_tokens")
      .delete()
      .eq("code", code);

    return res.json({ ok: true });
  } catch (err) {
    console.error("Redeem Error:", err);
    return res.status(500).json({ error: "Server error" });
  }
}
