import { supabase } from "../../utils/supabaseClient";

export default async function handler(req, res) {
  const discordId =
    req.body?.discord_id ||
    req.query?.discord_id;

  if (!discordId) {
    return res
      .status(400)
      .json({ error: "Missing discord_id" });
  }

  // ======================================================
  // PULL TOKENS FOR THIS DISCORD USER
  // ======================================================
  const { data, error } = await supabase
    .from("spotify_tokens")
    .select("*")
    .eq("discord_id", discordId)
    .maybeSingle();

  if (error || !data) {
    return res
      .status(404)
      .json({ error: "No Spotify account linked." });
  }

  // ======================================================
  // Return token bundle (your bot handles refresh)
  // ======================================================
  return res.json(data.data);
}
