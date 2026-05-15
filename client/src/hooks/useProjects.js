import { useCallback, useEffect, useState } from "react";
import { api, getToken } from "../lib/api.js";

const KEY = "delt-projects";

function loadLocal() {
  try { return JSON.parse(localStorage.getItem(KEY) || "[]"); }
  catch { return []; }
}

export function useProjects() {
  const [projects, setProjects] = useState(loadLocal);
  const [loading, setLoading]   = useState(false);

  const refresh = useCallback(async () => {
    if (!getToken()) return;
    setLoading(true);
    try {
      const { projects: list } = await api.listProjects();
      setProjects(list || []);
      try { localStorage.setItem(KEY, JSON.stringify(list || [])); } catch {}
    } catch { /* */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const create = async (data) => {
    const p = await api.createProject(data);
    await refresh();
    return p;
  };

  const update = async (id, data) => {
    const p = await api.updateProject(id, data);
    await refresh();
    return p;
  };

  const remove = async (id) => {
    await api.deleteProject(id);
    setProjects((prev) => prev.filter((p) => p.id !== id));
  };

  return { projects, loading, refresh, create, update, remove };
}
