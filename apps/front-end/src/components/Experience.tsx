import { useEffect, useState, type ReactNode } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { ArrowUpRight, Menu, Moon, Sun, X } from "lucide-react";

function readLightTheme(): boolean {
  try {
    const stored = localStorage.getItem("vv-theme");
    if (stored === "light") return true;
    if (stored === "dark") return false;
  } catch {
    /* Storage can be blocked; the default still works. */
  }
  if (typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: light)").matches) {
    return true;
  }
  return false;
}

export function Experience({ children }: { children: ReactNode }) {
  const location = useLocation();
  const [light, setLight] = useState(readLightTheme);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    setMenuOpen(false);
    if (location.hash) {
      const id = location.hash.slice(1);
      const target = document.getElementById(id);
      if (target) {
        target.scrollIntoView();
        return;
      }
    }
    window.scrollTo(0, 0);
  }, [location.pathname, location.hash]);

  useEffect(() => {
    document.documentElement.dataset.theme = light ? "light" : "dark";
    try {
      localStorage.setItem("vv-theme", light ? "light" : "dark");
    } catch {
      /* Theme still works without storage. */
    }
  }, [light]);

  return (
    <div className="experience">
      <a className="skip-link" href="#experience-content">
        Skip to content
      </a>
      <header className="site-nav">
        <Link to="/" className="wordmark" aria-label="VenekoVox home">
          <span className="brand-symbol" aria-hidden="true">
            v<span>v</span>
          </span>
          veneko<span className="brand-accent">vox</span>
        </Link>
        <nav aria-label="Main">
          <NavLink to="/polls">Polls</NavLink>
          <NavLink to="/journal">Our journal</NavLink>
          <Link to="/journal#trust">How it works</Link>
        </nav>
        <div className="nav-actions">
          <button
            className="theme-toggle"
            type="button"
            aria-label={light ? "Use dark theme" : "Use light theme"}
            onClick={() => setLight(!light)}
          >
            {light ? <Moon size={18} /> : <Sun size={18} />}
          </button>
          <Link className="nav-start" to="/names">
            Get started <ArrowUpRight size={16} />
          </Link>
          <button
            className="menu-toggle"
            type="button"
            aria-expanded={menuOpen}
            aria-controls="mobile-nav"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            onClick={() => setMenuOpen((open) => !open)}
          >
            {menuOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </header>
      {menuOpen && (
        <div className="mobile-panel" id="mobile-nav">
          <NavLink to="/polls">Polls</NavLink>
          <NavLink to="/journal">Our journal</NavLink>
          <Link to="/journal#trust">How it works</Link>
          <Link className="action-primary" to="/names">
            Get started
          </Link>
        </div>
      )}
      <div id="experience-content">{children}</div>
      <footer className="site-footer">
        <div>
          <Link className="footer-brand" to="/">
            venekovox.
          </Link>
          <p>Different convictions. Common ground.</p>
        </div>
        <div>
          <Link to="/journal#trust">Privacy & trust</Link>
          {" · "}
          <a href="https://github.com/satojandro/venekovox">Open source</a>
          {" · "}
          <span>Built for real voices · Sepolia testnet</span>
        </div>
      </footer>
    </div>
  );
}

const stages = [
  { label: "Your name", path: "/names" },
  { label: "Eligibility", path: "/trust-ritual" },
  { label: "Your ballot", path: "/polls" },
];

/** Route guide only. Visiting a page is not a completed check. */
export function JourneySteps({ active }: { active: number }) {
  return (
    <nav className="journey-steps" aria-label="Participation steps">
      {stages.map((step, i) => (
        <Link key={step.path} to={step.path} aria-current={i === active ? "step" : undefined}>
          <span>0{i + 1}</span>
          {step.label}
        </Link>
      ))}
    </nav>
  );
}

export function FieldNote({ title, children }: { title: string; children: ReactNode }) {
  return (
    <details className="field-note">
      <summary>
        {title}
        <span aria-hidden="true">+</span>
      </summary>
      <div>{children}</div>
    </details>
  );
}
