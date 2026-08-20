import { supabase } from "./supabase";

export type ContentType = "noticia" | "mural" | "pesquisa";
export type ContentAction =
  | "view"
  | "click"
  | "like"
  | "dislike"
  | "ack"
  | "responded_yes"
  | "responded_no";

const EXCLUSIVE_GROUPS: ContentAction[][] = [
  ["like", "dislike"],
  ["responded_yes", "responded_no"],
];

async function currentUserId() {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

export async function recordContentAction(
  contentType: ContentType,
  contentId: string,
  action: ContentAction,
) {
  const actorAuthId = await currentUserId();
  if (!actorAuthId) return { ok: false as const, reason: "not_authenticated" as const };

  const { error } = await supabase.from("kt_content_interactions").upsert(
    {
      actor_auth_id: actorAuthId,
      content_type: contentType,
      content_id: contentId,
      action,
    },
    {
      onConflict: "actor_auth_id,content_type,content_id,action",
      ignoreDuplicates: true,
    },
  );

  if (error) {
    console.warn("[ken-taki] content interaction", error.message);
    return { ok: false as const, reason: error.message };
  }
  return { ok: true as const };
}

export async function setExclusiveContentAction(
  contentType: ContentType,
  contentId: string,
  action: ContentAction | null,
) {
  const actorAuthId = await currentUserId();
  if (!actorAuthId) return { ok: false as const, reason: "not_authenticated" as const };

  const group = action
    ? EXCLUSIVE_GROUPS.find((candidate) => candidate.includes(action))
    : undefined;
  if (!group) return { ok: false as const, reason: "invalid_exclusive_action" as const };

  const { error: deleteError } = await supabase
    .from("kt_content_interactions")
    .delete()
    .eq("actor_auth_id", actorAuthId)
    .eq("content_type", contentType)
    .eq("content_id", contentId)
    .in("action", group);

  if (deleteError) {
    console.warn("[ken-taki] reset content interaction", deleteError.message);
    return { ok: false as const, reason: deleteError.message };
  }

  if (!action) return { ok: true as const };

  const { error: insertError } = await supabase.from("kt_content_interactions").insert({
    actor_auth_id: actorAuthId,
    content_type: contentType,
    content_id: contentId,
    action,
  });

  if (insertError) {
    console.warn("[ken-taki] set content interaction", insertError.message);
    return { ok: false as const, reason: insertError.message };
  }
  return { ok: true as const };
}

export async function fetchOwnContentInteractions() {
  const actorAuthId = await currentUserId();
  if (!actorAuthId) return [] as Array<{
    content_type: ContentType;
    content_id: string;
    action: ContentAction;
  }>;

  const { data, error } = await supabase
    .from("kt_content_interactions")
    .select("content_type,content_id,action")
    .eq("actor_auth_id", actorAuthId);

  if (error) {
    console.warn("[ken-taki] load content interactions", error.message);
    return [];
  }

  return (data ?? []) as Array<{
    content_type: ContentType;
    content_id: string;
    action: ContentAction;
  }>;
}
