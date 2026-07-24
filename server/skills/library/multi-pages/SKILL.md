---
name: multi-pages
description: Créer un site ou une app avec plusieurs pages et de vraies URLs (/ /about /contact) — React Router ou HTML multi-fichiers
triggers: plusieurs pages, multi-page, multipage, multi page, react-router, routing, navigation, navbar, barre de nav, menu, onglets, page contact, page à propos, page a propos, sous-page, sitemap, /\broutes?\b/
---

# Sites multi-pages avec vraies URLs

L'hébergement DELT (aperçu Launch ET site déployé `nomduprojet.deltai.fr`) gère
nativement les URLs profondes : un visiteur qui arrive directement sur
`nomduprojet.deltai.fr/contact` reçoit la bonne page. Tu peux donc faire de
vraies routes propres — **jamais** de HashRouter (`/#/contact` : moche, mauvais
pour le SEO).

## Mode React (défaut) — react-router-dom

`react-router-dom` est **déjà dans les dépendances du projet** : importe-le
directement. (Sur un ANCIEN projet, vérifie le package.json : s'il n'y a pas
`react-router-dom`, ajoute `"react-router-dom": "^6.28.0"` via `edit_file` —
l'environnement l'installera automatiquement.)

### src/main.jsx — BrowserRouter à la racine
```jsx
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.jsx";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
```

### src/App.jsx — layout partagé + routes
```jsx
import { Routes, Route } from "react-router-dom";
import Navbar from "./components/Navbar.jsx";
import Footer from "./components/Footer.jsx";
import Home from "./pages/Home.jsx";
import About from "./pages/About.jsx";
import Contact from "./pages/Contact.jsx";
import NotFound from "./pages/NotFound.jsx";

export default function App() {
  return (
    <>
      <Navbar />
      <main>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/a-propos" element={<About />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
      <Footer />
    </>
  );
}
```

### Règles impératives
1. **Un fichier par page** dans `src/pages/` (Home.jsx, About.jsx…). Le layout
   commun (Navbar, Footer) reste dans `src/components/` et HORS des `<Routes>`.
2. **Navigation interne : `<Link to="/contact">` ou `<NavLink>`** — jamais
   `<a href>` (rechargement complet), jamais `window.location`.
   `<NavLink>` reçoit `isActive` pour styler l'onglet courant :
   ```jsx
   <NavLink to="/contact" className={({ isActive }) => isActive ? "nav-link active" : "nav-link"}>Contact</NavLink>
   ```
3. **Toujours une route 404** (`path="*"`) avec un lien retour à l'accueil.
4. **Slugs en minuscules, sans accents, tirets** : `/a-propos`, `/nos-produits`.
5. **Scroll en haut à chaque changement de page** — ajoute ce petit composant
   dans main.jsx (sinon on arrive en bas de la nouvelle page) :
   ```jsx
   import { useLocation } from "react-router-dom";
   import { useEffect } from "react";
   function ScrollToTop() {
     const { pathname } = useLocation();
     useEffect(() => window.scrollTo(0, 0), [pathname]);
     return null;
   }
   // dans <BrowserRouter> : <ScrollToTop /> juste avant <App />
   ```
6. Pages dynamiques : `<Route path="/produits/:id" element={<Produit />} />`
   puis `const { id } = useParams()` dans le composant.
7. Quand tu AJOUTES une page à un projet existant : `edit_file` sur App.jsx
   (nouvelle Route + import) et sur Navbar (nouveau Link) + `write_file` de la
   nouvelle page seulement. Ne réécris pas tout.

## Mode HTML statique — plusieurs fichiers .html

Un fichier par page : `index.html`, `about.html`, `contact.html`. Liens
relatifs entre eux : `<a href="about.html">`. Le CSS/JS partagé dans
`style.css` / `script.js` référencés par chaque page. L'hébergement résout
aussi `/about` → `about.html` automatiquement (URLs propres dans la barre).
Répète le `<header>`/`<footer>` sur chaque page à l'identique.

## SEO multi-pages

Chaque page a son propre `<title>` : en React, mets `document.title = "…"` dans
un `useEffect` de chaque page (ou un composant `<PageTitle title="…">` partagé).
