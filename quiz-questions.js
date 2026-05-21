import { useState, useRef, useEffect } from "react";

const STORAGE_KEY = "leduel-batch-v2";

const THEMES = [
  { id: "quizculture",    label: "Culture Générale", emoji: "🧩", color: "#6366f1", description: "Histoire, art, sciences, société, géographie mélangés" },
  { id: "quizhistoire",   label: "Histoire",          emoji: "🏛️", color: "#8b5cf6", description: "Événements, personnages et époques historiques" },
  { id: "quizgeographie", label: "Géographie",        emoji: "🌍", color: "#3b82f6", description: "Capitales, pays, fleuves, reliefs, continents" },
  { id: "quizsport",      label: "Sport",             emoji: "⚽", color: "#10b981", description: "Sports collectifs, individuels, JO, records établis" },
  { id: "quizsciences",   label: "Sciences",          emoji: "🔬", color: "#14b8a6", description: "Physique, chimie, biologie, mathématiques, astronomie" },
  { id: "quizcinema",     label: "Cinéma",            emoji: "🎬", color: "#e94560", description: "Films, réalisateurs, acteurs, studios, récompenses" },
];

const MIX = { easy: 40, medium: 40, hard: 20 };
const TOTAL_TARGET = THEMES.length * 100;
const ACCENT = "#e94560";

function buildPrompt(theme, difficulty, count, existingQuestions) {
  const diffMap = {
    easy:   { label: "FACILE",    desc: "Niveau collégien. Questions que n'importe quel enfant de 12 ans peut répondre. Ex : 'Combien de joueurs au foot ?' → 11." },
    medium: { label: "MOYEN",     desc: "Niveau adulte cultivé, type Trivial Pursuit. Ex : 'Qui a écrit Les Misérables ?' → Hugo, 'Capitale de l'Australie ?' → Canberra." },
    hard:   { label: "DIFFICILE", desc: "Niveau expert passionné du thème. Références pointues que seul un vrai fan connaît. Ex : 'Quel pays a inventé le curling ?' → Écosse." },
  };
  const d = diffMap[difficulty];
  const avoidBlock = existingQuestions.length > 0
    ? `\nQUESTIONS DÉJÀ GÉNÉRÉES — ne pas reproduire ni reformuler :\n${existingQuestions.map((q, i) => `${i + 1}. ${q}`).join("\n")}\n`
    : "";
  return `Tu génères des questions pour "Le Duel", un jeu de quiz multijoueur. Les joueurs TAPENT leur réponse au clavier — elle doit être COURTE et NON AMBIGUË.

THÈME : ${theme.emoji} ${theme.label} — ${theme.description}
DIFFICULTÉ : ${d.label} — ${d.desc}
${avoidBlock}
RÈGLES ABSOLUES :
1. Réponse : 1 à 3 mots max, jamais une phrase
2. Une seule réponse correcte possible — pas d'ambiguïté
3. acceptedAnswers : min 3 variantes (principale + sans accents + forme courte/abréviation)
4. INTERDITS : personnages problématiques/controversés, records actuels susceptibles de changer, réponses > 4 mots
5. Sous-catégories variées — évite la redondance
6. En FRANÇAIS, réponses en minuscules sans accents

Génère exactement ${count} questions. Réponds UNIQUEMENT avec un tableau JSON valide, sans backtick :
[{"text":"...","answer":"...","acceptedAnswers":["...","...","..."],"difficulty":"${difficulty}","theme":"${theme.id}"}]`;
}

async function callHaiku(prompt) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 6000,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  const text = (data.content || []).filter(b => b.type === "text").map(b => b.text).join("");
  const match = text.match(/\[[\s\S]*\]/);
  if (!match) throw new Error("JSON introuvable dans la réponse");
  return JSON.parse(match[0]);
}



export default function App() {
  const [status, setStatus]             = useState("idle");
  const [steps, setSteps]               = useState([]);
  const [allQuestions, setAllQuestions] = useState([]);
  const [copied, setCopied]             = useState(false);
  const [storageLoaded, setStorageLoaded] = useState(false);
  const abortRef = useRef(false);

  // ── Charger la banque sauvegardée au démarrage ──
  useEffect(() => {
    (async () => {
      try {
        const r = await window.storage.get(STORAGE_KEY);
        if (r?.value) {
          const saved = JSON.parse(r.value);
          if (Array.isArray(saved) && saved.length > 0) {
            setAllQuestions(saved);
            setStatus("done");
          }
        }
      } catch {}
      setStorageLoaded(true);
    })();
  }, []);

  // ── Sauvegarder automatiquement à chaque nouvelle question ──
  useEffect(() => {
    if (!storageLoaded || allQuestions.length === 0) return;
    (async () => {
      try { await window.storage.set(STORAGE_KEY, JSON.stringify(allQuestions)); } catch {}
    })();
  }, [allQuestions, storageLoaded]);

  const totalSteps = THEMES.length * 3;
  const doneSteps  = steps.filter(s => s.state === "done").length;
  const progress   = totalSteps > 0 ? Math.round((doneSteps / totalSteps) * 100) : 0;

  const generate = async () => {
    abortRef.current = false;
    setStatus("running");
    setSteps([]);
    setAllQuestions([]);

    const collected = [];
    const newSteps  = [];

    for (const theme of THEMES) {
      for (const [diff, count] of Object.entries(MIX)) {
        if (abortRef.current) break;

        const step = { id: `${theme.id}-${diff}`, theme, difficulty: diff, count, state: "running", error: null };
        newSteps.push(step);
        setSteps([...newSteps]);

        try {
          const existing  = collected.filter(q => q.theme === theme.id).map(q => q.text);
          const questions = await callHaiku(buildPrompt(theme, diff, count, existing));
          const existingSet = new Set(collected.map(q => q.text.trim().toLowerCase()));
          const deduped   = questions.filter(q => !existingSet.has(q.text.trim().toLowerCase()));
          collected.push(...deduped);
          step.state = "done";
          step.count = deduped.length;
        } catch (e) {
          step.state = "error";
          step.error = e.message;
        }

        setSteps([...newSteps]);
        setAllQuestions([...collected]);
        if (!abortRef.current) await new Promise(r => setTimeout(r, 800));
      }
      if (abortRef.current) break;
    }

    setStatus(abortRef.current ? "idle" : "done");
  };

  const abort = () => { abortRef.current = true; setStatus("idle"); };

  const buildGrouped = () => {
    const grouped = {};
    for (const theme of THEMES) {
      grouped[theme.id] = allQuestions
        .filter(q => q.theme === theme.id)
        .map(({ text, answer, acceptedAnswers, difficulty }) => ({ text, answer, acceptedAnswers, difficulty }));
    }
    return grouped;
  };

  const handleDownload = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(buildGrouped(), null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch (e) {
      alert("Erreur de copie : " + e.message);
    }
  };



  const handleReset = async () => {
    if (!confirm("Effacer toutes les questions et recommencer ?")) return;
    try { await window.storage.delete(STORAGE_KEY); } catch {}
    setStatus("idle");
    setSteps([]);
    setAllQuestions([]);
  };

  const statsByTheme = THEMES.map(t => ({
    ...t,
    total:  allQuestions.filter(q => q.theme === t.id).length,
    easy:   allQuestions.filter(q => q.theme === t.id && q.difficulty === "easy").length,
    medium: allQuestions.filter(q => q.theme === t.id && q.difficulty === "medium").length,
    hard:   allQuestions.filter(q => q.theme === t.id && q.difficulty === "hard").length,
  }));

  return (
    <div style={{ minHeight: "100vh", background: "#0f0f14", color: "#e2e8f0", fontFamily: "'DM Mono','Fira Code','Courier New',monospace", padding: "32px 24px" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=Syne:wght@700;800&display=swap');
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-thumb { background: #333; border-radius: 2px; }
        @keyframes pulse  { 0%,100%{opacity:1} 50%{opacity:0.4} }
        @keyframes spin   { to { transform: rotate(360deg); } }
        @keyframes slideIn{ from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:none} }
      `}</style>

      {/* ── Header ── */}
      <div style={{ marginBottom: "32px" }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: "12px", marginBottom: "6px" }}>
          <h1 style={{ fontFamily: "'Syne',sans-serif", fontSize: "26px", fontWeight: 800, margin: 0, color: "#fff", letterSpacing: "-0.5px" }}>
            QUIZ BATCH GENERATOR
          </h1>
          <span style={{ fontSize: "11px", color: ACCENT, border: `1px solid ${ACCENT}`, padding: "2px 8px", borderRadius: "4px", letterSpacing: "1px" }}>
            LE DUEL
          </span>
        </div>
        <p style={{ margin: 0, fontSize: "12px", color: "#4a5568", letterSpacing: "0.5px" }}>
          6 THÈMES · 100 QUESTIONS/THÈME · MIX 40 FACILE / 40 MOYEN / 20 DIFFICILE
        </p>

        {allQuestions.length > 0 && (
          <div style={{ marginTop: "14px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "5px" }}>
              <span style={{ fontSize: "10px", color: "#4a5568", letterSpacing: "1px" }}>
                BANQUE {status === "running" ? "EN COURS…" : "SAUVEGARDÉE ✓"}
              </span>
              <span style={{ fontSize: "11px", color: "#fff" }}>{allQuestions.length} / {TOTAL_TARGET}</span>
            </div>
            <div style={{ height: "3px", background: "#1e1e2e", borderRadius: "2px", overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${Math.min(100, (allQuestions.length / TOTAL_TARGET) * 100)}%`, background: `linear-gradient(90deg, ${ACCENT}, #f59e0b)`, transition: "width 0.5s" }} />
            </div>
          </div>
        )}
      </div>

      {/* ── Bouton Générer ── */}
      {status === "idle" && (
        <div style={{ marginBottom: "32px" }}>
          <button onClick={generate}
            style={{ background: ACCENT, color: "#fff", border: "none", padding: "15px 36px", fontSize: "13px", fontFamily: "inherit", fontWeight: 500, letterSpacing: "2px", cursor: "pointer", borderRadius: "6px" }}>
            ▶ {allQuestions.length > 0 ? "REGÉNÉRER 600 QUESTIONS" : "GÉNÉRER 600 QUESTIONS"}
          </button>
          <p style={{ margin: "10px 0 0", fontSize: "11px", color: "#4a5568" }}>~6 min · 18 appels Haiku · quelques centimes</p>
        </div>
      )}

      {/* ── Progress running ── */}
      {status === "running" && (
        <div style={{ marginBottom: "24px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
            <span style={{ fontSize: "11px", color: "#718096", letterSpacing: "1px" }}>PROGRESSION</span>
            <span style={{ fontSize: "11px", color: "#fff" }}>{doneSteps}/{totalSteps} · {allQuestions.length} q.</span>
          </div>
          <div style={{ height: "3px", background: "#1e1e2e", borderRadius: "2px", overflow: "hidden", marginBottom: "14px" }}>
            <div style={{ height: "100%", width: `${progress}%`, background: `linear-gradient(90deg, ${ACCENT}, #f59e0b)`, transition: "width 0.4s" }} />
          </div>
          <button onClick={abort}
            style={{ background: "transparent", color: "#718096", border: "1px solid #2d2d3e", padding: "8px 20px", fontSize: "11px", fontFamily: "inherit", letterSpacing: "1px", cursor: "pointer", borderRadius: "4px" }}>
            ■ ARRÊTER
          </button>
        </div>
      )}

      {/* ── Log ── */}
      {steps.length > 0 && (
        <div style={{ background: "#0a0a0f", border: "1px solid #1e1e2e", borderRadius: "8px", padding: "14px", marginBottom: "24px", maxHeight: "240px", overflowY: "auto" }}>
          <div style={{ fontSize: "10px", color: "#4a5568", letterSpacing: "1px", marginBottom: "10px" }}>LOG D'EXÉCUTION</div>
          {steps.map(s => (
            <div key={s.id} style={{ display: "flex", alignItems: "center", gap: "10px", padding: "5px 0", borderBottom: "1px solid #111", fontSize: "12px", animation: "slideIn 0.2s ease" }}>
              <span style={{ width: "14px", textAlign: "center", flexShrink: 0 }}>
                {s.state === "running" && <span style={{ display: "inline-block", width: "10px", height: "10px", border: `2px solid ${ACCENT}`, borderTop: "2px solid transparent", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />}
                {s.state === "done"    && <span style={{ color: "#10b981" }}>✓</span>}
                {s.state === "error"   && <span style={{ color: ACCENT }}>✗</span>}
              </span>
              <span style={{ color: s.theme.color }}>{s.theme.emoji}</span>
              <span style={{ color: "#a0aec0", flex: 1 }}>
                {s.theme.label}
                <span style={{ color: "#4a5568" }}> · </span>
                <span style={{ color: s.difficulty === "easy" ? "#10b981" : s.difficulty === "medium" ? "#f59e0b" : ACCENT }}>
                  {s.difficulty === "easy" ? "FACILE" : s.difficulty === "medium" ? "MOYEN" : "DIFFICILE"}
                </span>
              </span>
              {s.state === "done"    && <span style={{ color: "#4a5568", fontSize: "11px" }}>{s.count} q.</span>}
              {s.state === "error"   && <span style={{ color: ACCENT, fontSize: "10px" }}>{s.error?.slice(0, 50)}</span>}
              {s.state === "running" && <span style={{ color: "#4a5568", fontSize: "11px", animation: "pulse 1.2s infinite" }}>génération…</span>}
            </div>
          ))}
        </div>
      )}

      {/* ── Stats par thème ── */}
      {allQuestions.length > 0 && (
        <div style={{ marginBottom: "24px" }}>
          <div style={{ fontSize: "10px", color: "#4a5568", letterSpacing: "1px", marginBottom: "10px" }}>RÉPARTITION PAR THÈME</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "8px" }}>
            {statsByTheme.map(t => (
              <div key={t.id} style={{ background: "#0a0a0f", border: `1px solid ${t.total > 0 ? t.color + "40" : "#1e1e2e"}`, borderRadius: "8px", padding: "12px 14px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "6px" }}>
                  <span style={{ fontSize: "15px" }}>{t.emoji}</span>
                  <span style={{ fontSize: "10px", color: t.total > 0 ? t.color : "#4a5568" }}>{t.label}</span>
                </div>
                <div style={{ fontSize: "22px", fontWeight: 500, color: t.total > 0 ? "#fff" : "#2d2d3e", marginBottom: "5px" }}>
                  {t.total}<span style={{ fontSize: "10px", color: "#4a5568" }}>/100</span>
                </div>
                <div style={{ display: "flex", gap: "3px", marginBottom: "4px" }}>
                  {[["easy","#10b981",t.easy,40],["medium","#f59e0b",t.medium,40],["hard",ACCENT,t.hard,20]].map(([d,c,n,max]) => (
                    <div key={d} style={{ flex: max, height: "3px", background: "#1e1e2e", borderRadius: "2px", overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${Math.min(100,(n/max)*100)}%`, background: c, transition: "width 0.4s" }} />
                    </div>
                  ))}
                </div>
                <div style={{ fontSize: "9px", color: "#4a5568", display: "flex", gap: "8px" }}>
                  <span style={{ color: "#10b981" }}>{t.easy}/40 F</span>
                  <span style={{ color: "#f59e0b" }}>{t.medium}/40 M</span>
                  <span style={{ color: ACCENT }}>{t.hard}/20 D</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Export ── */}
      {allQuestions.length > 0 && (
        <div>
          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginBottom: "16px" }}>
            <button onClick={handleDownload}
              style={{ background: "#10b981", color: "#fff", border: "none", padding: "13px 28px", fontSize: "12px", fontFamily: "inherit", fontWeight: 500, letterSpacing: "1.5px", cursor: "pointer", borderRadius: "6px" }}>
              {copied ? "✓ JSON COPIÉ !" : "📋 COPIER LE JSON COMPLET"}
            </button>
            <button onClick={handleReset}
              style={{ background: "transparent", color: "#4a5568", border: "1px solid #1e1e2e", padding: "13px 18px", fontSize: "11px", fontFamily: "inherit", letterSpacing: "1px", cursor: "pointer", borderRadius: "6px" }}>
              ↺ TOUT EFFACER
            </button>
          </div>

          <div style={{ fontSize: "10px", color: "#4a5568", letterSpacing: "1px", marginBottom: "8px" }}>APERÇU JSON — 2 PREMIÈRES ENTRÉES ({THEMES[0].label})</div>
          <div style={{ background: "#050508", border: "1px solid #1e1e2e", borderRadius: "6px", padding: "14px", fontSize: "11px", color: "#a0aec0", overflowX: "auto", lineHeight: "1.7" }}>
            <pre style={{ margin: 0 }}>
              {JSON.stringify(
                { [THEMES[0].id]: allQuestions.filter(q => q.theme === THEMES[0].id).slice(0, 2).map(({ text, answer, acceptedAnswers, difficulty }) => ({ text, answer, acceptedAnswers, difficulty })) },
                null, 2
              )}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}