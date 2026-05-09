// Anti-abus : 20 msg / 10 min, puis 1 msg / 3s
// Stockage en mémoire (reset au redémarrage — suffisant pour commencer)
const WINDOW_MS  = 10 * 60 * 1000; // 10 min
const MSG_LIMIT  = 20;
const SLOW_DELAY = 3000; // ms entre messages si throttled

const userLog = new Map(); // userId → [{ts}]

export function checkThrottle(userId) {
  const now = Date.now();
  const cutoff = now - WINDOW_MS;
  const log = (userLog.get(userId) || []).filter((ts) => ts > cutoff);
  log.push(now);
  userLog.set(userId, log);

  if (log.length > MSG_LIMIT) {
    // Calcule le délai à attendre
    const oldest = log[log.length - MSG_LIMIT - 1] ?? log[0];
    const elapsed = now - oldest;
    const wait = Math.max(0, SLOW_DELAY - (now - log[log.length - 2]));
    return { throttled: true, waitMs: wait };
  }
  return { throttled: false, waitMs: 0 };
}

// Nettoyage périodique pour éviter les fuites mémoire
setInterval(() => {
  const cutoff = Date.now() - WINDOW_MS;
  for (const [uid, log] of userLog) {
    const filtered = log.filter((ts) => ts > cutoff);
    if (filtered.length === 0) userLog.delete(uid);
    else userLog.set(uid, filtered);
  }
}, 5 * 60 * 1000);
