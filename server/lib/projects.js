import { getDb } from "./db.js";

export async function listProjects(userId) {
  const db = getDb();
  const { rows } = await db.query(
    `SELECT p.id, p.name, p.description, p.color, p.icon, p.system_prompt, p.default_model, p.memory,
            p.created_at, p.updated_at,
            COALESCE((SELECT COUNT(*) FROM conversations c WHERE c.project_id = p.id), 0) AS conversation_count
     FROM projects p
     WHERE p.user_id = $1
     ORDER BY p.updated_at DESC`,
    [userId]
  );
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    description: r.description,
    color: r.color,
    icon: r.icon,
    systemPrompt: r.system_prompt,
    defaultModel: r.default_model,
    memory: r.memory || {},
    createdAt: new Date(r.created_at).getTime(),
    updatedAt: new Date(r.updated_at).getTime(),
    conversationCount: Number(r.conversation_count) || 0
  }));
}

export async function getProject(userId, projectId) {
  const db = getDb();
  const { rows } = await db.query(
    `SELECT * FROM projects WHERE id=$1 AND user_id=$2`, [projectId, userId]
  );
  const r = rows[0];
  if (!r) return null;
  return {
    id: r.id,
    name: r.name,
    description: r.description,
    color: r.color,
    icon: r.icon,
    systemPrompt: r.system_prompt,
    defaultModel: r.default_model,
    memory: r.memory || {},
    createdAt: new Date(r.created_at).getTime(),
    updatedAt: new Date(r.updated_at).getTime()
  };
}

export async function createProject(userId, data) {
  const db = getDb();
  const { rows } = await db.query(
    `INSERT INTO projects (user_id, name, description, color, icon, system_prompt, default_model, memory)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING id, name, description, color, icon, system_prompt, default_model, memory, created_at, updated_at`,
    [
      userId,
      String(data.name || "Nouveau projet").slice(0, 80),
      data.description ? String(data.description).slice(0, 500) : null,
      data.color || "#6366f1",
      data.icon || "📁",
      data.systemPrompt ? String(data.systemPrompt).slice(0, 4000) : null,
      data.defaultModel || null,
      JSON.stringify(data.memory || {})
    ]
  );
  return rows[0];
}

export async function updateProject(userId, projectId, data) {
  const db = getDb();
  const sets = [];
  const params = [projectId, userId];
  let i = 3;
  const apply = (col, val) => { sets.push(`${col} = $${i}`); params.push(val); i++; };

  if (data.name !== undefined) apply("name", String(data.name).slice(0, 80));
  if (data.description !== undefined) apply("description", data.description ? String(data.description).slice(0, 500) : null);
  if (data.color !== undefined) apply("color", data.color);
  if (data.icon !== undefined) apply("icon", data.icon);
  if (data.systemPrompt !== undefined) apply("system_prompt", data.systemPrompt ? String(data.systemPrompt).slice(0, 4000) : null);
  if (data.defaultModel !== undefined) apply("default_model", data.defaultModel);
  if (data.memory !== undefined) apply("memory", JSON.stringify(data.memory || {}));

  sets.push(`updated_at = NOW()`);
  if (sets.length === 1) return getProject(userId, projectId);

  const { rows } = await db.query(
    `UPDATE projects SET ${sets.join(", ")} WHERE id=$1 AND user_id=$2 RETURNING *`,
    params
  );
  return rows[0] || null;
}

export async function deleteProject(userId, projectId) {
  const db = getDb();
  const { rowCount } = await db.query(
    `DELETE FROM projects WHERE id=$1 AND user_id=$2`, [projectId, userId]
  );
  return rowCount > 0;
}

export async function attachConversationToProject(userId, conversationId, projectId) {
  const db = getDb();
  // Vérifie que la conv appartient bien à l'user, et que le projet aussi
  const { rowCount } = await db.query(
    `UPDATE conversations SET project_id = $3
     WHERE id = $1 AND user_id = $2
       AND ($3 IS NULL OR EXISTS (SELECT 1 FROM projects WHERE id = $3 AND user_id = $2))`,
    [conversationId, userId, projectId]
  );
  return rowCount > 0;
}
