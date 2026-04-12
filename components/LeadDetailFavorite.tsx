"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { LeadFavoriteStar } from "@/components/LeadFavoriteStar";

type LeadDetailFavoriteProps = {
  leadId: string;
  initialFavorite: boolean;
};

export function LeadDetailFavorite({ leadId, initialFavorite }: LeadDetailFavoriteProps) {
  const router = useRouter();
  const [favorite, setFavorite] = useState(initialFavorite);

  async function handleToggle(e: React.MouseEvent<HTMLButtonElement>) {
    e.preventDefault();
    const current = favorite;
    const next = !current;

    setFavorite(next);

    const { error } = await supabase.from("leads").update({ is_favorite: next }).eq("id", leadId);

    if (error) {
      console.error(error);
      setFavorite(current);
      return;
    }

    await router.refresh();
  }

  return (
    <LeadFavoriteStar favorite={favorite} size={24} onClick={handleToggle} />
  );
}
