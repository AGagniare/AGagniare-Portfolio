"use client";

const HEADING_FONT = "var(--font-michroma), 'Eurostile', 'Bank Gothic', sans-serif";

/* ─── Tokens ───────────────────────────────────────────────────── */
const T = {
  bg: "#0f1117",
  card: "#161820",
  section: "#13151c",
  border: "rgba(255,255,255,0.07)",
  purple: "#6c56ff",
  purpleHover: "#5a47e0",
  purpleDim: "rgba(108,86,255,0.12)",
  heading: "#edf0f8",
  body: "#7d8799",
  label: "#a0aab8",
  success: "#22c55e",
  successBg: "rgba(34,197,94,0.1)",
  successBorder: "rgba(34,197,94,0.25)",
};

const shadow =
  "rgba(0,0,0,0.4) 0px 20px 40px -20px, rgba(108,86,255,0.08) 0px 8px 24px -8px";

export default function Home() {
  return (
    <div style={{ background: T.bg, color: T.heading, minHeight: "100vh" }}>
      {/* Nav */}
      <nav
        style={{
          position: "sticky",
          top: 0,
          zIndex: 50,
          borderBottom: `1px solid ${T.border}`,
          backgroundColor: "rgba(15,17,23,0.8)",
          backdropFilter: "blur(16px)",
        }}
      >
        <div
          style={{
            maxWidth: 1080,
            margin: "0 auto",
            padding: "0 24px",
            height: 60,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <span
            style={{
              fontSize: 14,
              fontWeight: 400,
              color: T.heading,
              letterSpacing: "-0.2px",
            }}
          >
            Arthur Gagniare
          </span>
          <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
            {["About", "Projects", "Experience"].map((item) => (
              <a
                key={item}
                href={`#${item.toLowerCase()}`}
                style={{
                  fontSize: 13,
                  fontWeight: 400,
                  color: T.body,
                  textDecoration: "none",
                  transition: "color 0.15s",
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.color = T.heading)
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.color = T.body)
                }
              >
                {item}
              </a>
            ))}
            <a
              href="mailto:arthur.gagniare@efrei.net"
              style={{
                fontSize: 13,
                fontWeight: 400,
                color: "#fff",
                textDecoration: "none",
                background: T.purple,
                padding: "7px 14px",
                borderRadius: 4,
                transition: "background 0.15s",
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.background = T.purpleHover)
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.background = T.purple)
              }
            >
              Contact
            </a>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section
        style={{ maxWidth: 1080, margin: "0 auto", padding: "96px 24px 80px" }}
      >
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            marginBottom: 24,
            fontSize: 11,
            fontWeight: 400,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: T.purple,
          }}
        >
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: T.success,
              boxShadow: `0 0 6px ${T.success}`,
              display: "inline-block",
            }}
          />
          Open to full-time opportunities
        </div>

        <h1
          style={{
            fontFamily: HEADING_FONT,
            fontSize: "clamp(2rem, 5vw, 3.2rem)",
            fontWeight: 400,
            letterSpacing: "0.05em",
            color: T.heading,
            lineHeight: 1.1,
            marginBottom: 24,
            maxWidth: 640,
          }}
        >
          Data Analyst
          <br />
          <span style={{ color: T.purple }}>&amp; Engineer</span>
        </h1>

        <p
          style={{
            fontSize: 17,
            fontWeight: 300,
            color: T.body,
            lineHeight: 1.7,
            maxWidth: 500,
            marginBottom: 40,
          }}
        >
          Master&apos;s student at EFREI Paris, specializing in Data Analysis.
          Background in financial data systems at BNP Paribas and NLP/ops
          engineering in Tokyo. Seeking a junior role at the intersection of
          data and quantitative analysis.
        </p>

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <a
            href="#projects"
            style={{
              background: T.purple,
              color: "#fff",
              padding: "10px 20px",
              borderRadius: 4,
              fontSize: 14,
              fontWeight: 400,
              textDecoration: "none",
              transition: "background 0.15s",
            }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.background = T.purpleHover)
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.background = T.purple)
            }
          >
            View projects
          </a>
          <a
            href="mailto:arthur.gagniare@efrei.net"
            style={{
              background: "transparent",
              color: T.label,
              padding: "10px 20px",
              borderRadius: 4,
              fontSize: 14,
              fontWeight: 400,
              textDecoration: "none",
              border: `1px solid ${T.border}`,
              transition: "border-color 0.15s, color 0.15s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = "rgba(255,255,255,0.2)";
              e.currentTarget.style.color = T.heading;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = T.border;
              e.currentTarget.style.color = T.label;
            }}
          >
            arthur.gagniare@efrei.net
          </a>
        </div>
      </section>

      <Divider />

      {/* About */}
      <section
        id="about"
        style={{ maxWidth: 1080, margin: "0 auto", padding: "72px 24px" }}
      >
        <Label>About</Label>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: 48,
            marginTop: 32,
          }}
        >
          <div>
            <h2
              style={{
                fontFamily: HEADING_FONT,
                fontSize: 22,
                fontWeight: 400,
                letterSpacing: "0.04em",
                color: T.heading,
                lineHeight: 1.2,
                marginBottom: 16,
              }}
            >
              Data, strategy, and
              <br />
              a love for Tokyo
            </h2>
            <p
              style={{
                fontSize: 15,
                color: T.body,
                lineHeight: 1.75,
                marginBottom: 16,
              }}
            >
              I hold a Master&apos;s in Computer Engineering from EFREI Paris
              and am currently studying Japanese &amp; Business at ISI Language
              School in Tokyo while working at Kenja K.K. on projects at the
              intersection of AI, machine learning, and business operations.
            </p>
            <p
              style={{
                fontSize: 15,
                color: T.body,
                lineHeight: 1.75,
              }}
            >
              Previously at BNP Paribas in Paris, I built financial data
              pipelines and dashboards covering Asian &amp; Chinese markets.
              That background lets me bridge business needs and technical
              solutions — particularly in data-driven, cross-cultural
              environments like Tokyo&apos;s tech ecosystem.
            </p>
          </div>
          <div>
            <p
              style={{ fontSize: 11, fontWeight: 400, color: T.purple, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 16 }}
            >
              Stack
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {[
                "Python", "pandas", "NumPy", "scikit-learn",
                "matplotlib", "seaborn", "SQL", "Power BI",
                "Machine Learning", "NLP", "API Integration",
                "Database Management", "Data Automation", "VBA",
              ].map((skill) => (
                <span
                  key={skill}
                  style={{
                    fontSize: 12,
                    fontWeight: 400,
                    color: T.label,
                    background: T.card,
                    border: `1px solid ${T.border}`,
                    padding: "4px 10px",
                    borderRadius: 4,
                  }}
                >
                  {skill}
                </span>
              ))}
            </div>

            <p
              style={{ fontSize: 11, fontWeight: 400, color: T.purple, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 16, marginTop: 28 }}
            >
              Languages
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {[
                "French — Native",
                "English — C1 (935 TOEIC)",
                "Polish — Proficient",
                "Japanese — Beginner",
              ].map((lang) => (
                <span
                  key={lang}
                  style={{
                    fontSize: 12,
                    fontWeight: 400,
                    color: T.label,
                    background: T.card,
                    border: `1px solid ${T.border}`,
                    padding: "4px 10px",
                    borderRadius: 4,
                  }}
                >
                  {lang}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      <Divider />

      {/* Projects */}
      <section id="projects" style={{ background: T.section, padding: "72px 0" }}>
        <div style={{ maxWidth: 1080, margin: "0 auto", padding: "0 24px" }}>
          <Label>Projects</Label>
          <h2
            style={{
              fontFamily: HEADING_FONT,
              fontSize: 22,
              fontWeight: 400,
              letterSpacing: "0.05em",
              color: T.heading,
              marginTop: 12,
              marginBottom: 36,
            }}
          >
            Showcase work
          </h2>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
              gap: 16,
            }}
          >
            {projects.map((p) => (
              <ProjectCard key={p.title} {...p} />
            ))}
          </div>
        </div>
      </section>

      <Divider />

      {/* Experience */}
      <section
        id="experience"
        style={{ maxWidth: 1080, margin: "0 auto", padding: "72px 24px" }}
      >
        <Label>Experience</Label>
        <div style={{ marginTop: 32 }}>
          {experience.map((r, i) => (
            <ExperienceRow
              key={i}
              {...r}
              last={i === experience.length - 1}
            />
          ))}
        </div>

        <div style={{ marginTop: 48 }}>
          <Label>Education</Label>
          <div style={{ marginTop: 24, display: "flex", flexDirection: "column", gap: 28 }}>
            {[
              {
                period: "Apr 2026 — Present",
                school: "ISI Language School",
                location: "Tokyo, Japan",
                degree: "Japanese Language & Business",
                description:
                  "Intensive Japanese language program with a focus on business communication and cross-cultural professional practice.",
              },
              {
                period: "2020 — 2025",
                school: "EFREI Paris",
                location: "France",
                degree: "Master's in Computer Engineering",
                description:
                  "Specialization in Data Analysis. Coursework covering machine learning, big data architectures, statistical modeling, and data visualization.",
              },
            ].map((edu) => (
              <div
                key={edu.school}
                style={{
                  display: "grid",
                  gridTemplateColumns: "180px 1fr",
                  gap: 16,
                }}
              >
                <div>
                  <p style={{ fontSize: 12, color: T.body, fontFeatureSettings: '"tnum"' }}>
                    {edu.period}
                  </p>
                  <p style={{ fontSize: 13, color: T.label, marginTop: 4 }}>
                    {edu.school}
                  </p>
                  <p style={{ fontSize: 12, color: T.body, marginTop: 2 }}>
                    {edu.location}
                  </p>
                </div>
                <div>
                  <p
                    style={{
                      fontSize: 17,
                      fontWeight: 300,
                      letterSpacing: "-0.22px",
                      color: T.heading,
                    }}
                  >
                    {edu.degree}
                  </p>
                  <p style={{ fontSize: 14, color: T.body, marginTop: 6, lineHeight: 1.6 }}>
                    {edu.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Contact */}
      <section
        id="contact"
        style={{
          background: T.section,
          borderTop: `1px solid ${T.border}`,
          padding: "80px 24px",
          textAlign: "center",
        }}
      >
        <h2
          style={{
            fontFamily: HEADING_FONT,
            fontSize: "clamp(1.4rem, 3.5vw, 2.2rem)",
            fontWeight: 400,
            letterSpacing: "0.05em",
            color: T.heading,
            marginBottom: 16,
          }}
        >
          Let&apos;s work together
        </h2>
        <p
          style={{
            fontSize: 15,
            color: T.body,
            lineHeight: 1.65,
            maxWidth: 380,
            margin: "0 auto 36px",
          }}
        >
          Open to junior data analyst and data engineer roles in Tokyo
          and internationally. Currently based in Japan.
        </p>
        <div
          style={{
            display: "flex",
            gap: 12,
            justifyContent: "center",
            flexWrap: "wrap",
          }}
        >
          <a
            href="mailto:arthur.gagniare@efrei.net"
            style={{
              background: T.purple,
              color: "#fff",
              padding: "10px 22px",
              borderRadius: 4,
              fontSize: 14,
              fontWeight: 400,
              textDecoration: "none",
              transition: "background 0.15s",
            }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.background = T.purpleHover)
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.background = T.purple)
            }
          >
            Send an email
          </a>
          <a
            href="https://www.linkedin.com/in/arthur-gagniare-6799761b6/"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              background: "transparent",
              color: T.label,
              padding: "10px 22px",
              borderRadius: 4,
              fontSize: 14,
              fontWeight: 400,
              textDecoration: "none",
              border: `1px solid ${T.border}`,
              transition: "border-color 0.15s, color 0.15s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = "rgba(255,255,255,0.2)";
              e.currentTarget.style.color = T.heading;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = T.border;
              e.currentTarget.style.color = T.label;
            }}
          >
            LinkedIn
          </a>
        </div>
      </section>

      <footer
        style={{
          borderTop: `1px solid ${T.border}`,
          padding: "24px",
          textAlign: "center",
        }}
      >
        <p style={{ fontSize: 12, color: T.body }}>
          © {new Date().getFullYear()} Arthur Gagniare — Paris / Tokyo
        </p>
      </footer>
    </div>
  );
}

/* ─── Sub-components ──────────────────────────────────────────── */

function Divider() {
  return (
    <div
      style={{
        maxWidth: 1080,
        margin: "0 auto",
        padding: "0 24px",
      }}
    >
      <div style={{ borderTop: `1px solid ${T.border}` }} />
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <p
      style={{
        fontSize: 11,
        fontWeight: 400,
        letterSpacing: "0.1em",
        textTransform: "uppercase",
        color: T.purple,
      }}
    >
      {children}
    </p>
  );
}

function ProjectCard({
  title,
  description,
  tags,
  highlight,
  link,
  linkLabel = "Live demo ↗",
}: {
  title: string;
  description: string;
  tags: string[];
  highlight?: string;
  link?: string;
  linkLabel?: string;
}) {
  return (
    <div
      style={{
        background: T.card,
        border: `1px solid ${T.border}`,
        borderRadius: 6,
        padding: 24,
        display: "flex",
        flexDirection: "column",
        gap: 14,
        boxShadow: shadow,
      }}
    >
      {highlight && (
        <span
          style={{
            fontSize: 10,
            fontWeight: 400,
            color: T.success,
            background: T.successBg,
            border: `1px solid ${T.successBorder}`,
            padding: "2px 8px",
            borderRadius: 4,
            alignSelf: "flex-start",
            letterSpacing: "0.05em",
            textTransform: "uppercase",
          }}
        >
          {highlight}
        </span>
      )}
      <h3
        style={{
          fontFamily: HEADING_FONT,
          fontSize: 14,
          fontWeight: 400,
          letterSpacing: "0.04em",
          color: T.heading,
          lineHeight: 1.3,
        }}
      >
        {title}
      </h3>
      <p
        style={{
          fontSize: 13,
          color: T.body,
          lineHeight: 1.7,
          flexGrow: 1,
        }}
      >
        {description}
      </p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
        {tags.map((tag) => (
          <span
            key={tag}
            style={{
              fontSize: 11,
              fontWeight: 400,
              color: T.purple,
              background: T.purpleDim,
              padding: "3px 8px",
              borderRadius: 4,
            }}
          >
            {tag}
          </span>
        ))}
        {link && (
          <a
            href={link}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              marginLeft: "auto",
              fontSize: 11,
              fontWeight: 400,
              color: T.label,
              textDecoration: "none",
              border: `1px solid ${T.border}`,
              padding: "3px 10px",
              borderRadius: 4,
              transition: "color 0.15s, border-color 0.15s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = T.heading;
              e.currentTarget.style.borderColor = "rgba(255,255,255,0.2)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = T.label;
              e.currentTarget.style.borderColor = T.border;
            }}
          >
            {linkLabel}
          </a>
        )}
      </div>
    </div>
  );
}

function ExperienceRow({
  role,
  company,
  period,
  location,
  bullets,
  last,
}: {
  role: string;
  company: string;
  period: string;
  location: string;
  bullets: string[];
  last: boolean;
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "180px 1fr",
        gap: 16,
        paddingBottom: last ? 0 : 36,
        marginBottom: last ? 0 : 36,
        borderBottom: last ? "none" : `1px solid ${T.border}`,
      }}
    >
      <div>
        <p
          style={{
            fontSize: 12,
            color: T.body,
            fontFeatureSettings: '"tnum"',
            letterSpacing: "-0.2px",
          }}
        >
          {period}
        </p>
        <p style={{ fontSize: 13, color: T.label, marginTop: 4 }}>
          {company}
        </p>
        <p style={{ fontSize: 12, color: T.body, marginTop: 2 }}>
          {location}
        </p>
      </div>
      <div>
        <h3
          style={{
            fontSize: 17,
            fontWeight: 300,
            letterSpacing: "-0.22px",
            color: T.heading,
            marginBottom: 12,
          }}
        >
          {role}
        </h3>
        <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 8 }}>
          {bullets.map((b, i) => (
            <li
              key={i}
              style={{ display: "flex", gap: 10, alignItems: "flex-start" }}
            >
              <span
                style={{
                  color: T.purple,
                  fontSize: 14,
                  lineHeight: 1.6,
                  flexShrink: 0,
                  marginTop: 1,
                }}
              >
                ›
              </span>
              <span
                style={{ fontSize: 13, color: T.body, lineHeight: 1.65 }}
              >
                {b}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/* ─── Data ───────────────────────────────────────────────────── */

const projects = [
  {
    title: "Cross-Sectional Momentum Backtester",
    highlight: "Quant",
    description:
      "Python backtesting engine for equity momentum strategies on S&P 500 constituents. Implements monthly rebalancing, transaction cost modeling, and full performance attribution — Sharpe, Sortino, max drawdown, and rolling beta vs. benchmark.",
    tags: ["Python", "pandas", "NumPy", "matplotlib", "yfinance"],
    link: "https://github.com/AGagniare/momentum-backtester",
    linkLabel: "GitHub ↗",
  },
  {
    title: "Credit Default Prediction Model",
    highlight: "ML · Finance",
    description:
      "Gradient boosting classifier (XGBoost + SHAP explainability) trained on the UCI credit dataset. Includes feature engineering on payment history, SMOTE oversampling for class imbalance, and an interactive Streamlit dashboard.",
    tags: ["Python", "XGBoost", "SHAP", "scikit-learn", "Streamlit"],
    link: "https://credit-risk-model-agagniare.streamlit.app/",
  },
  {
    title: "Multilingual VoC NLP Pipeline",
    highlight: "Real work · Kenja K.K.",
    description:
      "Production NLP pipeline to detect and classify misrouted customer calls from 5,000+ monthly transcripts in French, English, and Japanese. Rule-based routing logic with zero LLM dependency — fully auditable and traceable for compliance.",
    tags: ["Python", "NLP", "spaCy", "pandas", "API Integration"],
  },
];

const experience = [
  {
    role: "Data Analyst Intern",
    company: "BNP Paribas",
    period: "2023 — 2024",
    location: "Paris, France",
    bullets: [
      "Designed and managed complete SQL database architectures, optimizing data integration and cleansing for business operations across Asian and Chinese financial markets.",
      "Built real-time interactive Power BI dashboards to monitor analyst activities and support data-driven decision-making.",
      "Developed a VBA automation tool for analyst data entry, eliminating significant manual workload.",
      "Created API test cases and user scenarios to improve program reliability.",
    ],
  },
  {
    role: "Project Manager & Business Analyst Intern",
    company: "Kenja K.K.",
    period: "2025",
    location: "Tokyo, Japan",
    bullets: [
      "Built a custom resource planning tool with automated conflict detection and dynamic dashboards for leadership visibility.",
      "Developed a multilingual NLP pipeline (FR/EN/JP) to detect misrouted calls, delivering Voice-of-Customer insights from 5,000+ monthly transcripts.",
      "Delivered clean, auditable reporting logic without LLMs to ensure traceability and future AI scalability.",
      "Aligned business, sales, and technical stakeholders by translating operational needs into structured systems.",
    ],
  },
];
