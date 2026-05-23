import { useEffect, useState } from "react";
import { api, getToken } from "../lib/api.js";

const KEY_META     = "delt-conversations";       // métadonnées (liste)
const KEY_MSGS     = "delt-conv-msgs:";          // messages, préfixé par id
const MAX_CACHE_MS = 250; // ne pas spammer localStorage pendant le streaming

function loadMeta() {
  try { return JSON.parse(localStorage.getItem(KEY_META) || "[]"); }
  catch { return []; }
}
function saveMsgsLocal(id, messages) {
  try { localStorage.setItem(KEY_MSGS + id, JSON.stringify(messages)); }
  catch { /* quota plein, on ignore */ }
}
function loadMsgsLocal(id) {
  try { return JSON.parse(localStorage.getItem(KEY_MSGS + id) || "null"); }
  catch { return null; }
}
function dropMsgsLocal(id) {
  try { localStorage.removeItem(KEY_MSGS + id); } catch { /* */ }
}

export function useHistory() {
  const [conversations, setConversations] = useState(loadMeta);
  const [activeId, setActiveId] = useState(null);

  // Persiste les métadonnées (sans messages — trop volumineux ici)
  useEffect(() => {
    const metadataOnly = conversations.map(({ messages, ...c }) => ({
      ...c,
      messageCount: c.messageCount ?? messages?.length ?? 0
    }));
    try { localStorage.setItem(KEY_META, JSON.stringify(metadataOnly)); } catch {}
  }, [conversations]);

  // Refresh liste depuis le serveur au chargement
  useEffect(() => {
    if (!getToken()) return;
    api.listConversations()
      .then(({ conversations: serverConvs }) => {
        if (!serverConvs) return;
        // Merge : on garde les messages locaux si la conv existe encore côté serveur
        setConversations((local) => {
          const localById = new Map(local.map((c) => [c.id, c]));
          return serverConvs.map((s) => {
            const cached = localById.get(s.id);
            return { ...s, messages: cached?.messages || [] };
          });
        });
      })
      .catch(() => {});
  }, []);

  const newConversation = () => {
    const id = crypto.randomUUID();
    setActiveId(id);
    return id;
  };

  // Throttle des écritures localStorage pendant streaming (évite freeze)
  const lastSavedAt = {};
  const saveMessagesLocalThrottled = (id, messages) => {
    const now = Date.now();
    if (now - (lastSavedAt[id] || 0) < MAX_CACHE_MS) return;
    lastSavedAt[id] = now;
    saveMsgsLocal(id, messages);
  };

  // Appelé à chaque message ajouté ; projectId optionnel pour attacher la conv
  const saveMessages = (id, messages, projectId) => {
    if (!id || messages.length === 0) return;
    const firstUser = messages.find((m) => m.role === "user");
    const title = firstUser
      ? firstUser.content.slice(0, 48).replace(/\n/g, " ") + (firstUser.content.length > 48 ? "…" : "")
      : "Nouvelle conversation";

    // 1) cache local immédiat (ultra rapide)
    saveMessagesLocalThrottled(id, messages);

    // 2) update state en mémoire
    setConversations((prev) => {
      const exists = prev.find((c) => c.id === id);
      const projectPatch = projectId !== undefined ? { projectId } : {};
      if (exists) {
        return prev.map((c) =>
          c.id === id ? { ...c, ...projectPatch, messages, title, updatedAt: Date.now() } : c
        );
      }
      return [{ id, title, ...projectPatch, messages, createdAt: Date.now(), updatedAt: Date.now() }, ...prev];
    });

    // 3) envoi serveur — SEULEMENT si aucun message n'est en streaming.
    // Sinon les saves en rafale créent une race condition (un save "en retard"
    // écrasait le contenu complet de l'IA après streaming).
    const stillStreaming = messages.some((m) => m.streaming);
    if (!stillStreaming) {
      api.saveConversation(id, messages, projectId).catch((e) => {
        console.error("[conversations/save]", e);
      });
    }
  };

  const deleteConversation = (id) => {
    dropMsgsLocal(id);
    setConversations((prev) => prev.filter((c) => c.id !== id));
    if (activeId === id) setActiveId(null);
    api.deleteConversation(id).catch((e) => {
      console.error("[conversations/delete]", e);
    });
  };

  // Renvoie d'abord le cache local, rafraîchit depuis le serveur en arrière-plan
  const getMessages = async (id) => {
    const cachedLocal = loadMsgsLocal(id);
    const cachedMem = conversations.find((c) => c.id === id)?.messages ?? [];
    const initial = (cachedLocal && cachedLocal.length > 0) ? cachedLocal : cachedMem;

    // Refresh depuis le serveur en arrière-plan (ne bloque pas)
    api.getConversation(id)
      .then((conversation) => {
        if (conversation?.messages) {
          saveMsgsLocal(id, conversation.messages);
          setConversations((prev) => prev.map((c) => c.id === id ? { ...c, ...conversation } : c));
        }
      })
      .catch(() => {});

    return initial;
  };

  return { conversations, activeId, setActiveId, newConversation, saveMessages, deleteConversation, getMessages };
}
