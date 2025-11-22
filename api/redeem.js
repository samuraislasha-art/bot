import { supabase } from "../../utils/supabaseClient.js";

export default async function handler(req, res) {
  const code =
    req.body?.code ||
    req.query?.code;

  const discordId =
    req.body?.discord_id ||
    req.query?.discord_id;

  if (!code || !discordId) {
    return res.status(400).json({ error: "Missing code or discord_id" });
  }

  const { data, error } = await supabase
    .from("spotify_tokens")
    .select("*")
    .eq("code", code.toUpperCase())
    .eq("discord_id", discordId)
    .maybeSingle();

  if (error || !data) {
    return res.status(404).json({ error: "Invalid or unauthorized code." });
  }

  // Delete after use
  await supabase.from("spotify_tokens").delete().eq("code", code.toUpperCase());

  return res.json(data.data);
}
