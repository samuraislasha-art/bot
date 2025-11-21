// /api/redeem.js
import { createClient } from "@supabase/supabase-js";

export default async function handler(req, res) {
  try {
    const code = req.body?.code || req.query?.code;
    const discordId = req.body?.discord_id || req.query?.discord_id;

    if (!code || !discordId) {
      return res.status(400).json({ error: "Missing code or discord_id" });
    }

    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SECRET_KEY
    );

    // FIND MATCHING ROW
    const { data, error } = await supabase
      .from("spotify_tokens")
      .select("*")
      .eq("code", code.toUpperCase())
      .eq("discord_id", discordId)
      .single();

    if (error || !data) {
      return res.status(404).json({ error: "Invalid or unauthorized code" });
    }

    // DELETE AFTER USE
    await supabase
      .from("spotify_tokens")
      .delete()
      .eq("code", code.toUpperCase());

    return res.json(data.data);

  } catch (err) {
    console.error("Redeem Error:", err);
    return res.status(500).json({ error: "Server error" });
  }
}
