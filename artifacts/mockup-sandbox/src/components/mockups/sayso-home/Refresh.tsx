import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  AudioLines,
  Check,
  ChevronLeft,
  Lightbulb,
  MessageCircle,
  Mic2,
  Presentation,
  Sparkles,
  X,
} from "lucide-react";
import "./_refresh.css";

type Stage = "Idea" | "Pre-seed" | "Seed" | "Series A";
type Mode = "coach" | "pitch";
type Phase = "closed" | "stage" | "mode" | "ready";

const stages: Stage[] = ["Idea", "Pre-seed", "Seed", "Series A"];

export function Refresh() {
  const [phase, setPhase] = useState<Phase>("closed");
  const [stage, setStage] = useState<Stage>("Idea");
  const [mode, setMode] = useState<Mode>("coach");
  const [language, setLanguage] = useState("English");
  const flowHeading = useRef<HTMLHeadingElement>(null);
  const startButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (phase === "closed") return;
    const frame = requestAnimationFrame(() => {
      flowHeading.current?.focus({ preventScroll: true });
      flowHeading.current?.scrollIntoView({
        block: "center",
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
      });
    });
    return () => cancelAnimationFrame(frame);
  }, [phase]);

  const closeFlow = () => {
    setPhase("closed");
    requestAnimationFrame(() => startButton.current?.focus());
  };

  const reset = () => {
    closeFlow();
    setStage("Idea");
    setMode("coach");
  };

  return (
    <main className="clarity-refresh">
      <div className="cr-shell">
        <header className="cr-header">
          <a className="cr-brand" href="#top" aria-label="Clarity AI home">
            <span className="cr-mark" aria-hidden="true">
              <AudioLines size={20} strokeWidth={2.1} />
            </span>
            <span>Clarity AI</span>
          </a>
          <div className="cr-header-note">
            <MessageCircle size={17} strokeWidth={1.8} aria-hidden="true" />
            <span>A little practice. A lot more you.</span>
          </div>
        </header>

        <section className="cr-hero" id="top" aria-labelledby="cr-main-title">
          <div className="cr-hero-copy">
            <p className="cr-overline">A place to find your voice</p>
            <h1 className="cr-title" id="cr-main-title">
              Speak confidently.<br /><em>Be understood.</em>
            </h1>
            <p className="cr-hero-text">
              Get comfortable saying what you mean, to anyone. Rehearse out loud
              in a space that helps you find your words and your confidence.
              <strong> Feedback is about your idea and delivery</strong> — never
              your grammar or accent.
            </p>
            <div className="cr-hero-action">
              <button
                className="cr-primary-start"
                type="button"
                ref={startButton}
                aria-controls="cr-setup"
                aria-expanded={phase !== "closed"}
                onClick={() => setPhase("stage")}
              >
                Practise a startup pitch <ArrowRight size={18} aria-hidden="true" />
              </button>
              <span>Our first practice scenario · Coach or 2-minute pitch</span>
            </div>
            <div className="cr-language-row" aria-label="Choose a practice language">
              <span className="cr-language-label">Speak in the way that feels like you</span>
              {["English", "हिंदी", "Hinglish"].map((choice) => (
                <button
                  className="cr-lang"
                  type="button"
                  key={choice}
                  aria-pressed={language === choice}
                  onClick={() => setLanguage(choice)}
                >
                  {choice}
                </button>
              ))}
            </div>
          </div>

          <div className="cr-visual" aria-label="A visual reminder to let your ideas be heard">
            <div className="cr-orbit" aria-hidden="true">
              <span className="cr-orbit-dot" />
            </div>
            <Sparkles className="cr-small-star" size={25} strokeWidth={1.4} aria-hidden="true" />
            <div className="cr-quote-card">
              <div className="cr-quote-top">
                <span className="cr-quote-label">The idea, in your words</span>
                <Sparkles className="cr-quote-spark" size={17} aria-hidden="true" />
              </div>
              <p className="cr-quote">
                “I know what I want to say. I’m just finding <span>my way into it.</span>”
              </p>
              <div className="cr-quote-footer">
                <span className="cr-wave" aria-hidden="true"><i /><i /><i /><i /><i /><i /></span>
                <span>Practice at your own pace</span>
              </div>
            </div>
            <div className="cr-note-float">
              <Check size={15} strokeWidth={2.6} aria-hidden="true" />
              <span>Your point of view comes first</span>
            </div>
          </div>
        </section>

        <section className="cr-practice" aria-labelledby="cr-practice-title">
          <div className="cr-practice-intro">
            <div>
              <p className="cr-section-kicker">Start with one real moment</p>
              <h2 className="cr-section-title" id="cr-practice-title">What would you like to say?</h2>
            </div>
            <p>Choose a starting point. You can take it one step at a time.</p>
          </div>

          <div className="cr-pitch-card">
            <div className="cr-pitch-left">
              <span className="cr-pitch-icon" aria-hidden="true"><Lightbulb size={23} /></span>
              <div>
                <span className="cr-live-tag">Available to try now</span>
                <h3 className="cr-pitch-title">Share a startup idea</h3>
                <p className="cr-pitch-copy">
                  Practice explaining your idea to an investor. Start with your stage, then choose a guided rehearsal or a two-minute pitch.
                </p>
              </div>
            </div>
            <button className="cr-start" type="button" onClick={() => setPhase("stage")}>
              Start here <ArrowRight size={17} aria-hidden="true" />
            </button>
          </div>

          {phase !== "closed" && (
            <div className="cr-flow" id="cr-setup" aria-live="polite">
              <div className="cr-flow-head">
                <div className="cr-flow-progress">
                  <span>{phase === "stage" ? "1" : phase === "mode" ? "2" : <Check size={13} />}</span>
                  {phase === "stage" ? "Step 1 of 2 · Your starting point" : phase === "mode" ? "Step 2 of 2 · Your practice style" : "Setup complete"}
                </div>
                <button className="cr-flow-close" type="button" onClick={closeFlow} aria-label="Close practice setup">
                  <X size={16} /> Close
                </button>
              </div>
              <div className="cr-flow-body">
                {phase === "stage" && (
                  <>
                    <h3 className="cr-flow-title" ref={flowHeading} tabIndex={-1}>Where are you with your idea?</h3>
                    <p className="cr-flow-desc">This helps shape the investor conversation. There’s no wrong place to begin.</p>
                    <div className="cr-options" role="group" aria-label="Choose your startup stage">
                      {stages.map((item, index) => (
                        <button
                          className="cr-option"
                          type="button"
                          key={item}
                          aria-pressed={stage === item}
                          onClick={() => setStage(item)}
                        >
                          <strong>{item}</strong>
                          <small>{["Still exploring", "Getting started", "Finding momentum", "Growing further"][index]}</small>
                        </button>
                      ))}
                    </div>
                    <div className="cr-flow-actions">
                      <span />
                      <button className="cr-step-continue" type="button" onClick={() => setPhase("mode")}>Choose how to practice <ArrowRight size={14} /></button>
                    </div>
                  </>
                )}
                {phase === "mode" && (
                  <>
                    <h3 className="cr-flow-title" ref={flowHeading} tabIndex={-1}>How would you like to rehearse?</h3>
                    <p className="cr-flow-desc">For your {stage} idea, choose the kind of practice that feels right today.</p>
                    <div className="cr-modes" role="group" aria-label="Choose a practice mode">
                      <button className="cr-mode" type="button" aria-pressed={mode === "coach"} onClick={() => setMode("coach")}>
                        <span className="cr-mode-icon"><MessageCircle size={18} /></span>
                        <strong>Rehearse with a coach</strong>
                        <small>A guided, back-and-forth practice to help you shape how you explain the idea.</small>
                      </button>
                      <button className="cr-mode" type="button" aria-pressed={mode === "pitch"} onClick={() => setMode("pitch")}>
                        <span className="cr-mode-icon"><Presentation size={18} /></span>
                        <strong>2-minute investor pitch</strong>
                        <small>Practice delivering your idea in a focused, two-minute pitch.</small>
                      </button>
                    </div>
                    <div className="cr-flow-actions">
                      <button className="cr-flow-back" type="button" onClick={() => setPhase("stage")}><ChevronLeft size={14} /> Back to stage</button>
                      <button className="cr-step-continue" type="button" onClick={() => setPhase("ready")}>Confirm practice setup <ArrowRight size={14} /></button>
                    </div>
                  </>
                )}
                {phase === "ready" && (
                  <>
                    <div className="cr-ready" role="status">
                      <span className="cr-ready-icon"><Check size={23} strokeWidth={2.5} /></span>
                      <div>
                        <h3 ref={flowHeading} tabIndex={-1}>You’re ready to practice.</h3>
                        <p>
                          {mode === "coach" ? "A guided rehearsal" : "A two-minute investor pitch"} for your {stage} idea, in {language}.
                          Take a breath. This is a place to try things out.
                        </p>
                      </div>
                      <p className="cr-ready-note">This preview stops at setup. It won’t access your microphone, record audio, or generate feedback.</p>
                    </div>
                    <div className="cr-ready-actions">
                      <button type="button" onClick={() => setPhase("stage")}>Change choices</button>
                      <button type="button" onClick={reset}>Finish preview</button>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </section>

        <section className="cr-future" aria-labelledby="cr-future-title">
          <div>
            <p className="cr-section-kicker">The same confidence, everywhere</p>
            <h2 className="cr-future-title" id="cr-future-title">More moments, in time.</h2>
            <p className="cr-future-copy">Startup pitching is just the first place to practice. These are future possibilities, not available yet.</p>
          </div>
          <div className="cr-future-list" aria-label="Future practice situations">
            <span className="cr-future-item"><MessageCircle size={15} /> Salary conversation <small>Coming later</small></span>
            <span className="cr-future-item"><Presentation size={15} /> A presentation <small>Coming later</small></span>
            <span className="cr-future-item"><Mic2 size={15} /> Any big conversation <small>Coming later</small></span>
          </div>
        </section>

        <footer className="cr-footer">
          <span className="cr-footer-brand"><AudioLines size={15} /> Clarity AI</span>
          <span className="cr-footer-principle"><strong>Your ideas first.</strong> Speak in English, हिंदी, or Hinglish.</span>
        </footer>
      </div>
    </main>
  );
}
