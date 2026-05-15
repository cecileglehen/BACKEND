import { useEffect, useState } from "react";

/**
 * Garde un composant monté pendant la durée de l'animation de sortie.
 * @param {boolean} open    état logique (visible ou non)
 * @param {number}  duration durée (ms) — doit matcher l'anim CSS
 * @returns { mounted, closing }
 *   - mounted : faut-il rendre le composant ?
 *   - closing : true pendant la phase de sortie (pour appliquer l'anim out)
 */
export function useAnimatedMount(open, duration = 320) {
  const [mounted, setMounted] = useState(open);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    if (open) {
      setMounted(true);
      setClosing(false);
    } else if (mounted) {
      setClosing(true);
      const t = setTimeout(() => {
        setMounted(false);
        setClosing(false);
      }, duration);
      return () => clearTimeout(t);
    }
  }, [open, mounted, duration]);

  return { mounted, closing };
}
