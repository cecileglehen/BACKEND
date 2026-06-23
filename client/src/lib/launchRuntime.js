// Runtime WebContainer pour Launch IDE — boot unique + helpers de montage.
import { WebContainer } from "@webcontainer/api";

let wcInstance = null;
let booting = null;

export function isIsolated() {
  return typeof window !== "undefined" && window.crossOriginIsolated === true;
}

export async function bootWebContainer() {
  if (wcInstance) return wcInstance;
  if (!isIsolated()) {
    throw new Error(
      "Contexte non isolé (cross-origin). Les headers COOP/COEP sont requis pour la preview live."
    );
  }
  if (!booting) booting = WebContainer.boot({ coep: "credentialless" });
  wcInstance = await booting;
  return wcInstance;
}

// base64 → Uint8Array (pour les fichiers binaires montés dans WebContainer)
export function b64ToBytes(b64) {
  const bin = atob(String(b64 || ""));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

// [{ path, content, encoding }] → FileSystemTree imbriqué attendu par mount()
export function filesToTree(files) {
  const tree = {};
  for (const { path, content, encoding } of files) {
    const parts = String(path).split("/").filter(Boolean);
    let node = tree;
    for (let i = 0; i < parts.length - 1; i++) {
      const dir = parts[i];
      if (!node[dir]) node[dir] = { directory: {} };
      node = node[dir].directory;
    }
    const contents = encoding === "base64" ? b64ToBytes(content) : (content ?? "");
    node[parts[parts.length - 1]] = { file: { contents } };
  }
  return tree;
}

// Uint8Array → base64 (par morceaux pour éviter les dépassements d'argument)
export function bytesToB64(bytes) {
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  return btoa(bin);
}

const BINARY_EXT = /\.(png|jpe?g|gif|webp|ico|bmp|avif|woff2?|ttf|otf|eot|mp[34]|wav|ogg|pdf|zip)$/i;

// Lit récursivement un dossier du WebContainer → [{ path, content, encoding }]
// (les fichiers binaires sont encodés en base64 pour ne pas se corrompre).
export async function readDirFlat(wc, dir, base = dir) {
  const out = [];
  const entries = await wc.fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = `${dir}/${entry.name}`;
    if (entry.isDirectory()) {
      out.push(...await readDirFlat(wc, full, base));
    } else {
      const path = full.slice(base.length + 1);
      if (BINARY_EXT.test(entry.name)) {
        const bytes = await wc.fs.readFile(full).catch(() => null);
        if (bytes) out.push({ path, content: bytesToB64(bytes), encoding: "base64" });
      } else {
        const content = await wc.fs.readFile(full, "utf-8").catch(() => "");
        out.push({ path, content, encoding: "utf8" });
      }
    }
  }
  return out;
}

// ─── Visual Edits : script sélecteur injecté dans la preview (pas dans le build) ──
export const VISUAL_SCRIPT = `<script data-launch-visual>
(function(){
  if (window.__lv) return; window.__lv = true;
  var active=false, sel=null;
  var ov=document.createElement('div');
  ov.style.cssText='position:fixed;pointer-events:none;border:2px solid #6366f1;background:rgba(99,102,241,.12);z-index:2147483647;display:none;border-radius:4px';
  function mount(){ (document.body||document.documentElement).appendChild(ov); }
  if(document.body) mount(); else addEventListener('DOMContentLoaded', mount);
  function box(el){ if(!el) return; var r=el.getBoundingClientRect(); ov.style.display='block'; ov.style.left=r.left+'px'; ov.style.top=r.top+'px'; ov.style.width=r.width+'px'; ov.style.height=r.height+'px'; }
  function send(t,p){ try{ parent.postMessage(Object.assign({source:'launch-visual',type:t},p||{}),'*'); }catch(e){} }
  function st(el){ var c=getComputedStyle(el); return { color:c.color, background:c.backgroundColor, fontSize:c.fontSize, fontWeight:c.fontWeight }; }
  addEventListener('message', function(e){
    var d=e.data||{}; if(d.source!=='launch-ide') return;
    if(d.type==='MODE'){ active=d.active; ov.style.display='none'; if(document.body) document.body.style.cursor=active?'crosshair':''; if(!active) sel=null; }
    if(d.type==='APPLY'&&sel){ if(d.text!=null) sel.textContent=d.text; if(d.style) for(var k in d.style) sel.style[k]=d.style[k]; box(sel); }
  });
  addEventListener('mouseover', function(e){ if(active) box(e.target); }, true);
  addEventListener('click', function(e){ if(!active) return; e.preventDefault(); e.stopPropagation(); sel=e.target; box(sel); send('SELECTED',{ tag:sel.tagName.toLowerCase(), text:(sel.textContent||'').trim().slice(0,300), styles:st(sel) }); }, true);
  addEventListener('scroll', function(){ if(sel) box(sel); }, true);
})();
</script>`;

export function injectVisual(html) {
  if (!html || html.includes("data-launch-visual")) return html;
  return html.includes("</body>") ? html.replace("</body>", VISUAL_SCRIPT + "\n</body>") : html + VISUAL_SCRIPT;
}

// Réinjecte le script dans l'index.html du WebContainer (preview only).
export async function ensureVisualScript(wc) {
  try {
    const html = await wc.fs.readFile("index.html", "utf-8");
    if (!html.includes("data-launch-visual")) await wc.fs.writeFile("index.html", injectVisual(html));
  } catch { /* noop */ }
}

// Lit un flux de process et pousse chaque chunk vers onData.
export function pipeOutput(stream, onData) {
  stream.pipeTo(
    new WritableStream({
      write(chunk) { onData(chunk); }
    })
  ).catch(() => {});
}
