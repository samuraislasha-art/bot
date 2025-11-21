import { createClient } from "@supabase/supabase-js";

export default async function handler(req, res) {
  try {
    // Read ?code=####
    const code = req.query.code?.toUpperCase();

    if (!code) {
      return res.status(400).json({ error: "Missing code" });
    }

    // Supabase client
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SECRET_KEY
    );

    // Find token entry
    const { data, error } = await supabase
      .from("spotify_tokens")
      .select("*")
      .eq("code", code)
      .single();

    if (error || !data) {
      return res.status(404).json({ error: "Invalid code" });
    }

    // Delete token after use
    await supabase
      .from("spotify_tokens")
      .delete()
      .eq("code", code);

    // Return token data ONLY
    return res.json(data.data);

  } catch (err) {
    console.error("Redeem Error:", err);
    return res.status(500).json({ error: "Server error" });
  }
}
