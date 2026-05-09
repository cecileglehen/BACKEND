import { useEffect, useState } from "react";

const KEY = "delt-conversations";

function load() {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "[]");
  } catch {
    return [];
  }
}

export function useHistory() {
  const [conversations, setConversations] = useState(load);
  const [activeId, setActiveId] = useState(null);

  useEffect(() => {
    localStorage.setItem(KEY, JSON.stringify(conversations));
  }, [conversations]);

  const newConversation = () => {
    const id = crypto.randomUUID();
    setActiveId(id);
    return id;
  };

  // Appelé à chaque message ajouté
  const saveMessages = (id, messages) => {
    if (!id || messages.length === 0) return;
    const firstUser = messages.find((m) => m.role === "user");
    const title = firstUser
      ? firstUser.content.slice(0, 48).replace(/\n/g, " ") + (firstUser.content.length > 48 ? "…" : "")
      : "Nouvelle conversation";

    setConversations((prev) => {
      const exists = prev.find((c) => c.id === id);
      if (exists) {
        return prev.map((c) =>
          c.id === id ? { ...c, messages, title, updatedAt: Date.now() } : c
        );
      }
      return [{ id, title, messages, createdAt: Date.now(), updatedAt: Date.now() }, ...prev];
    });
  };

  const deleteConversation = (id) => {
    setConversations((prev) => prev.filter((c) => c.id !== id));
    if (activeId === id) setActiveId(null);
  };

  const getMessages = (id) =>
    conversations.find((c) => c.id === id)?.messages ?? [];

  return { conversations, activeId, setActiveId, newConversation, saveMessages, deleteConversation, getMessages };
}
