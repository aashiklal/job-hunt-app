import "server-only";
import type { GeneratedResume, GeneratedCoverLetter } from "@/lib/generated-documents";

export function escapeLatex(s: string): string {
  return s
    .replace(/\\/g, "\\textbackslash{}")
    .replace(/&/g, "\\&")
    .replace(/%/g, "\\%")
    .replace(/\$/g, "\\$")
    .replace(/#/g, "\\#")
    .replace(/_/g, "\\_")
    .replace(/\{/g, "\\{")
    .replace(/\}/g, "\\}")
    .replace(/~/g, "\\textasciitilde{}")
    .replace(/\^/g, "\\textasciicircum{}");
}

function escapeUrl(url: string): string {
  return url.replace(/%/g, "\\%").replace(/#/g, "\\#");
}

// Escapes LaTeX special chars in free-form text while preserving embedded URLs.
// Any http/https URL found in the string is wrapped in \href{url}{url} instead
// of being passed through escapeLatex (which would corrupt the URL).
function escapeLatexWithUrls(text: string): string {
  const urlRe = /(https?:\/\/[^\s,;)]+)/g;
  const parts = text.split(urlRe);
  return parts
    .map((part, i) => {
      if (i % 2 === 1) {
        // URL segment — pass raw into \href, escape only the display copy
        return `\\href{${part}}{${escapeLatex(part)}}`;
      }
      return escapeLatex(part);
    })
    .join("");
}

function normalizeUrl(raw: string, prefix: string): string {
  return raw.startsWith("http") ? raw : `${prefix}${raw}`;
}

// ============================================================
// Resume template
// ============================================================

export const RESUME_TEX_PREAMBLE = String.raw`\documentclass[10pt, a4paper]{article}

% ---- Page geometry ----
\usepackage[
  a4paper,
  top=0.5in,
  bottom=0.5in,
  left=0.5in,
  right=0.5in
]{geometry}

% ---- Font: Helvetica ----
\usepackage[T1]{fontenc}
\usepackage{helvet}
\renewcommand{\familydefault}{\sfdefault}

% ---- Core formatting packages ----
\usepackage{parskip}
\usepackage{titlesec}
\usepackage{enumitem}
\usepackage{tabularx}
\usepackage{array}
\usepackage{xcolor}
\usepackage{hyperref}
\usepackage{microtype}
\usepackage{ragged2e}

\pagestyle{empty}

\definecolor{headingblue}{HTML}{215E99}
\definecolor{linkblue}{HTML}{0563C1}

\hypersetup{
  colorlinks=true,
  urlcolor=linkblue,
  linkcolor=linkblue
}

% H1: Name -- 18pt bold centred blue
\titleformat{\section}
  {\fontsize{18}{20}\bfseries\color{headingblue}\centering}
  {}{0em}{}
\titlespacing*{\section}{0pt}{0pt}{3pt}

% H2: Section labels -- 11pt bold blue + full-width rule
\titleformat{\subsection}[block]
  {\fontsize{11}{13}\bfseries\color{headingblue}}
  {}{0em}
  {}
  [\vspace{1pt}\color{black}\hrule height 0.6pt\vspace{2pt}]
\titlespacing*{\subsection}{0pt}{14pt}{5pt}

% Tight bullet lists
\setlist[itemize]{
  leftmargin=1.2em,
  itemsep=1pt,
  parsep=0pt,
  topsep=2pt,
  partopsep=0pt
}

\setlength{\parskip}{3pt}
\setlength{\parindent}{0pt}

% Right-aligned date column for experience and education rows
\newcommand{\jobrow}[2]{%
  \noindent
  \begin{tabularx}{\linewidth}{@{}>{\raggedright\arraybackslash}X >{\raggedleft\arraybackslash}b{0.23\linewidth}@{}}
    #1 & #2
  \end{tabularx}%
}

% Bold label + normal text on same line (skills)
\newcommand{\skillrow}[2]{%
  \noindent{\textbf{#1}} #2\par\vspace{2pt}%
}`;

const RESUME_TEX_BODY_EXAMPLE = String.raw`\section*{JANE SMITH}

\begin{center}
  \fontsize{10}{12}\selectfont
  Melbourne, VIC, Australia | +61 400 000 001 | jane.smith@example.com
\end{center}

\vspace{-2pt}

\begin{center}
  \fontsize{10}{12}\selectfont
  \href{https://linkedin.com/in/janesmith}{linkedin.com/in/janesmith} | \href{https://github.com/janesmith}{github.com/janesmith} | \href{https://janesmith.dev}{janesmith.dev}
\end{center}

\vspace{-2pt}

\begin{center}
  \fontsize{10}{12}\selectfont
  Australian Permanent Resident | Full work rights
\end{center}

\subsection*{PROFESSIONAL SUMMARY}

\fontsize{10}{14}\selectfont
\justifying
Senior platform engineer with 6 years of experience building cloud-native systems and developer tooling on AWS. Deep expertise in Terraform, Kubernetes, and CI/CD automation, with a background in Python, TypeScript, and Go. Proven track record of reducing deployment toil and improving system reliability across large engineering organisations.

\subsection*{TECHNICAL SKILLS}

\fontsize{10}{14}\selectfont
\justifying

\skillrow{Cloud Platforms:}{AWS (Lambda, S3, API Gateway, ECS, CloudWatch, IAM, DynamoDB), Google Cloud Platform, Terraform, serverless architecture}

\skillrow{Containers \& Orchestration:}{Docker, Kubernetes, ECS Fargate, Helm}

\skillrow{CI/CD \& DevOps:}{GitHub Actions, Jenkins, automated testing, multi-environment release workflows}

\skillrow{Languages:}{Python, TypeScript, Go, SQL, Bash}

\skillrow{Databases:}{PostgreSQL, DynamoDB, Redis, MongoDB}

\skillrow{Web Stack:}{React, Next.js, Node.js, REST APIs, GraphQL}

\skillrow{Delivery \& Collaboration:}{Agile Scrum, Kanban, Git, code review, incident management}

\subsection*{PROFESSIONAL EXPERIENCE}

\fontsize{10}{14}\selectfont

\jobrow{\textbf{Senior Platform Engineer} | \textbf{Acme Technologies}}{\textbf{Mar 2022 - Present}}

\noindent Core platform team of 8, owning developer tooling and CI/CD infrastructure

\begin{itemize}
  \item Reduced average deployment time by 65\% by redesigning the CI/CD pipeline with GitHub Actions and parallel test execution across 12 microservices.
  \item Migrated 40 AWS Lambda functions from monolithic deployments to per-function Terraform modules, cutting cold-start latency by 30\%.
  \item Built a self-service developer portal adopted by 80 engineers within 3 months, eliminating 200 monthly on-call tickets.
  \item Mentored 4 junior engineers through onboarding and bi-weekly code reviews, resulting in two promotions within the year.
\end{itemize}

\jobrow{\textbf{Software Engineer} | \textbf{Beta Systems}}{\textbf{Jan 2020 - Feb 2022}}

\begin{itemize}
  \item Built Python data ingestion pipelines processing 2M events per day on AWS Kinesis and Lambda, replacing a weekly batch job with near-real-time delivery.
  \item Designed and implemented a REST API serving 500K daily requests with 99.95\% uptime using API Gateway, Lambda, and DynamoDB.
  \item Reduced AWS monthly spend by 22\% through right-sizing EC2 instances and migrating batch workloads to spot fleets.
\end{itemize}

\jobrow{\textbf{Graduate Developer} | \textbf{Gamma Corp}}{\textbf{Feb 2019 - Dec 2019}}

\begin{itemize}
  \item Developed Python and Bash automation scripts that reduced manual reporting effort by 4 hours per week across the operations team.
  \item Contributed to a React dashboard displaying real-time infrastructure metrics for on-call engineers.
\end{itemize}

\subsection*{PROJECTS}

\fontsize{10}{14}\selectfont

\noindent\textbf{DataFlow | Serverless Event Processing Platform}

\noindent\textbf{Tech Stack:} Python, AWS Lambda, Kinesis, DynamoDB, Terraform, GitHub Actions

\begin{itemize}
  \item Processes 500K events per day through a fan-out Lambda architecture with sub-200ms end-to-end latency.
  \item Automated infrastructure provisioning and blue/green deployments via Terraform and GitHub Actions OIDC workflows.
\end{itemize}

\noindent\textbf{OpenMetrics | Developer Observability Tool}

\noindent\textbf{Tech Stack:} Go, PostgreSQL, React, Docker, Kubernetes

\begin{itemize}
  \item Lightweight metrics aggregation service handling 10K writes per second with P99 latency under 5ms.
\end{itemize}

\subsection*{EDUCATION}

\fontsize{10}{14}\selectfont

\jobrow{\textbf{Bachelor of Computer Science (Honours)} | \textbf{University of Melbourne}}{\textbf{Mar 2015 - Nov 2018}}

\noindent\textit{Relevant Coursework:} Distributed Systems, Operating Systems, Database Systems, Algorithms

\vspace{3pt}

\jobrow{\textbf{Bachelor of Engineering (Computer Science)} | \textbf{City University of Technology}}{\textbf{Jul 2011 - Jun 2015}}

\noindent\textit{Published IEEE Paper:} \href{https://ieeexplore.ieee.org/document/7654321}{\textit{Fault-Tolerant Scheduling Algorithms for Distributed Cloud Workloads}} - optimised task placement across heterogeneous clusters.

\subsection*{CERTIFICATIONS}

\fontsize{10}{14}\selectfont
\begin{itemize}
  \item \textbf{AWS Certified Solutions Architect - Associate} - Amazon Web Services, 2023
  \item \textbf{HashiCorp Certified: Terraform Associate} - HashiCorp, 2022
\end{itemize}

\vspace{3pt}

\noindent
\fontsize{10}{12}\selectfont
\begin{center}
References available on request.
\end{center}`;

export const RESUME_TEX_FULL_EXAMPLE =
  `${RESUME_TEX_PREAMBLE}\n\\begin{document}\n${RESUME_TEX_BODY_EXAMPLE}\n\\end{document}`;

// ============================================================
// Cover letter template
// ============================================================

export const COVER_LETTER_TEX_PREAMBLE = String.raw`\documentclass[10pt, a4paper]{article}

% ---- Page geometry ----
\usepackage[
  a4paper,
  top=0.55in,
  bottom=0.55in,
  left=0.7in,
  right=0.7in
]{geometry}

% ---- Font: Helvetica ----
\usepackage[T1]{fontenc}
\usepackage{helvet}
\renewcommand{\familydefault}{\sfdefault}

% ---- Packages ----
\usepackage{parskip}
\usepackage{xcolor}
\usepackage{hyperref}
\usepackage{microtype}
\usepackage{ragged2e}
\usepackage{tikz}
\usepackage{eso-pic}
\usepackage{mdframed}

% ---- Colour palette ----
\definecolor{headingblue}{HTML}{215E99}
\definecolor{contactbg}{HTML}{EDF2F8}
\definecolor{ruleblue}{HTML}{215E99}
\definecolor{linkblue}{HTML}{0563C1}

\hypersetup{
  colorlinks=true,
  urlcolor=linkblue,
  linkcolor=linkblue
}

\setlength{\parskip}{9pt}
\setlength{\parindent}{0pt}

% Left accent bar: 5pt wide blue strip, full page height
\AddToShipoutPictureBG{%
  \begin{tikzpicture}[remember picture, overlay]
    \fill[headingblue]
      (current page.north west)
      rectangle
      ([xshift=5pt]current page.south west);
  \end{tikzpicture}%
}`;

const COVER_LETTER_TEX_BODY_EXAMPLE = String.raw`\pagestyle{empty}
\justifying

{\fontsize{18}{26}\bfseries\color{headingblue}\selectfont
JANE SMITH}

\vspace{6pt}

\begin{mdframed}[
  backgroundcolor=contactbg,
  linecolor=contactbg,
  innertopmargin=5pt,
  innerbottommargin=5pt,
  innerleftmargin=6pt,
  innerrightmargin=6pt,
  skipabove=0pt,
  skipbelow=0pt
]
\centering\fontsize{9}{11}\selectfont
+61 400 000 001
\enspace|\enspace
\href{mailto:jane.smith@example.com}{jane.smith@example.com}
\enspace|\enspace
Melbourne, VIC, Australia
\enspace|\enspace
\href{https://linkedin.com/in/janesmith}{linkedin.com/in/janesmith}
\enspace|\enspace
\href{https://janesmith.dev}{janesmith.dev}
\end{mdframed}

{\color{ruleblue}\hrule height 1.2pt}

{\fontsize{10}{12}\selectfont 15 March 2025}

\vspace{8pt}

{\fontsize{10}{14}\selectfont\setlength{\parskip}{0pt}
Hiring Manager\par
Acme Technologies\par
}

\vspace{10pt}

{\color{ruleblue!35}\hrule height 0.5pt}

\vspace{10pt}

{\fontsize{10}{12}\bfseries\selectfont
Dear Hiring Manager,}

\vspace{2pt}

{\fontsize{10}{15}\selectfont

Acme Technologies' investment in developer tooling caught my attention because it maps directly to the platform engineering work I have spent the past three years doing. As a senior platform engineer, I have built the kind of self-service internal infrastructure your team is hiring for.

At Beta Systems I redesigned the CI/CD pipeline for 12 microservices, cutting average deployment time by 65\% and eliminating a class of deployment incidents that had been creating toil for on-call engineers every quarter. I did this alongside a team of eight while continuing to ship product features, which required clear prioritisation and strong stakeholder communication.

I would welcome the chance to bring that experience to Acme Technologies. Please feel free to reach out at any time.

}

\vspace{8pt}

{\color{ruleblue!35}\hrule height 0.5pt}

\vspace{10pt}

{\fontsize{10}{14}\selectfont\setlength{\parskip}{3pt}
Sincerely,

Jane Smith

}`;

export const COVER_LETTER_TEX_FULL_EXAMPLE =
  `${COVER_LETTER_TEX_PREAMBLE}\n\\begin{document}\n${COVER_LETTER_TEX_BODY_EXAMPLE}\n\\end{document}`;

// ============================================================
// Fallback builders (TypeScript only, no AI call)
// Used when the haiku render call is unavailable.
// ============================================================

export function buildDefaultLatexDoc(resume: GeneratedResume): string {
  const e = escapeLatex;
  const lines: string[] = [];

  lines.push(`\\section*{${e(resume.name.toUpperCase())}}`);

  const line1Parts: string[] = [];
  if (resume.contact.location) line1Parts.push(e(resume.contact.location));
  if (resume.contact.phone) line1Parts.push(e(resume.contact.phone));
  if (resume.contact.email) {
    line1Parts.push(
      `\\href{mailto:${escapeUrl(resume.contact.email)}}{${e(resume.contact.email)}}`
    );
  }
  if (line1Parts.length > 0) {
    lines.push(`\\begin{center}\\fontsize{10}{12}\\selectfont ${line1Parts.join(" | ")}\\end{center}`);
  }

  const line2Parts: string[] = [];
  if (resume.contact.linkedin) {
    const url = normalizeUrl(resume.contact.linkedin, "https://");
    line2Parts.push(`\\href{${escapeUrl(url)}}{${e(resume.contact.linkedin)}}`);
  }
  if (resume.contact.github) {
    const url = normalizeUrl(resume.contact.github, "https://github.com/");
    line2Parts.push(`\\href{${escapeUrl(url)}}{${e(resume.contact.github)}}`);
  }
  if (resume.contact.website) {
    const url = normalizeUrl(resume.contact.website, "https://");
    line2Parts.push(`\\href{${escapeUrl(url)}}{${e(resume.contact.website)}}`);
  }
  if (line2Parts.length > 0) {
    lines.push(`\\begin{center}\\fontsize{10}{12}\\selectfont ${line2Parts.join(" | ")}\\end{center}`);
  }

  if (resume.contact.workRights) {
    lines.push(`\\begin{center}\\fontsize{10}{12}\\selectfont ${e(resume.contact.workRights)}\\end{center}`);
  }
  lines.push("");

  if (resume.summary) {
    lines.push("\\subsection*{PROFESSIONAL SUMMARY}");
    lines.push(`\\fontsize{10}{14}\\selectfont\\justifying`);
    lines.push(e(resume.summary));
    lines.push("");
  }

  if (resume.skills.length > 0) {
    lines.push("\\subsection*{TECHNICAL SKILLS}");
    lines.push(`\\fontsize{10}{14}\\selectfont\\justifying`);
    for (const skill of resume.skills) {
      lines.push(`\\skillrow{${e(skill.category)}:}{${skill.items.map(e).join(", ")}}`);
    }
    lines.push("");
  }

  if (resume.experience.length > 0) {
    lines.push("\\subsection*{PROFESSIONAL EXPERIENCE}");
    lines.push(`\\fontsize{10}{14}\\selectfont`);
    for (const exp of resume.experience) {
      lines.push(
        `\\jobrow{\\textbf{${e(exp.jobTitle)}} | \\textbf{${e(exp.company)}}}{\\textbf{${e(exp.dateRange)}}}`
      );
      if (exp.subtitle) lines.push(`\\noindent ${e(exp.subtitle)}`);
      if (exp.bullets.length > 0) {
        lines.push("\\begin{itemize}");
        for (const bullet of exp.bullets) lines.push(`  \\item ${e(bullet)}`);
        lines.push("\\end{itemize}");
      }
      lines.push("");
    }
  }

  if (resume.projects.length > 0) {
    lines.push("\\subsection*{PROJECTS}");
    lines.push(`\\fontsize{10}{14}\\selectfont`);
    for (const proj of resume.projects) {
      lines.push(`\\noindent\\textbf{${e(proj.name)}}`);
      if (proj.techStack) lines.push(`\\noindent\\textbf{Tech Stack:} ${e(proj.techStack)}`);
      if (proj.bullets.length > 0) {
        lines.push("\\begin{itemize}");
        for (const bullet of proj.bullets) lines.push(`  \\item ${e(bullet)}`);
        lines.push("\\end{itemize}");
      }
      lines.push("");
    }
  }

  if (resume.education.length > 0) {
    lines.push("\\subsection*{EDUCATION}");
    lines.push(`\\fontsize{10}{14}\\selectfont`);
    for (const edu of resume.education) {
      const right = edu.gradDate ? `\\textbf{${e(edu.gradDate)}}` : "";
      lines.push(
        `\\jobrow{\\textbf{${e(edu.degree)}} | \\textbf{${e(edu.school)}}}{${right}}`
      );
      if (edu.notes) lines.push(`\\noindent ${escapeLatexWithUrls(edu.notes)}`);
      lines.push("");
    }
  }

  if (resume.certifications.length > 0) {
    lines.push("\\subsection*{CERTIFICATIONS}");
    lines.push(`\\fontsize{10}{14}\\selectfont`);
    lines.push("\\begin{itemize}");
    for (const cert of resume.certifications) lines.push(`  \\item ${e(cert)}`);
    lines.push("\\end{itemize}");
    lines.push("");
  }

  if (resume.footer) {
    lines.push(`\\vspace{4pt}`);
    lines.push(`\\begin{center}\\fontsize{10}{12}\\selectfont ${e(resume.footer)}\\end{center}`);
  }

  return `${RESUME_TEX_PREAMBLE}\n\\begin{document}\n${lines.join("\n")}\n\\end{document}`;
}

export function buildDefaultCoverLetterLatexDoc(doc: GeneratedCoverLetter): string {
  const e = escapeLatex;
  const lines: string[] = [];

  lines.push("\\pagestyle{empty}");
  lines.push("\\justifying");
  lines.push("");

  lines.push(`{\\fontsize{18}{26}\\bfseries\\color{headingblue}\\selectfont`);
  lines.push(`${e(doc.name.toUpperCase())}}`);
  lines.push("");
  lines.push("\\vspace{6pt}");
  lines.push("");

  const contactItems: string[] = [];
  if (doc.contact.phone) contactItems.push(e(doc.contact.phone));
  if (doc.contact.email) {
    contactItems.push(
      `\\href{mailto:${escapeUrl(doc.contact.email)}}{${e(doc.contact.email)}}`
    );
  }
  if (doc.contact.location) contactItems.push(e(doc.contact.location));
  if (doc.contact.linkedin) {
    const url = normalizeUrl(doc.contact.linkedin, "https://");
    contactItems.push(`\\href{${escapeUrl(url)}}{${e(doc.contact.linkedin)}}`);
  }
  if (doc.contact.website) {
    const url = normalizeUrl(doc.contact.website, "https://");
    contactItems.push(`\\href{${escapeUrl(url)}}{${e(doc.contact.website)}}`);
  }
  if (contactItems.length > 0) {
    lines.push("\\begin{mdframed}[");
    lines.push("  backgroundcolor=contactbg,");
    lines.push("  linecolor=contactbg,");
    lines.push("  innertopmargin=5pt,");
    lines.push("  innerbottommargin=5pt,");
    lines.push("  innerleftmargin=6pt,");
    lines.push("  innerrightmargin=6pt,");
    lines.push("  skipabove=0pt,");
    lines.push("  skipbelow=0pt");
    lines.push("]");
    lines.push("\\centering\\fontsize{9}{11}\\selectfont");
    lines.push(contactItems.join("\n\\enspace|\\enspace\n"));
    lines.push("\\end{mdframed}");
    lines.push("");
  }

  lines.push("{\\color{ruleblue}\\hrule height 1.2pt}");
  lines.push("");
  lines.push(`{\\fontsize{10}{12}\\selectfont ${e(doc.date)}}`);
  lines.push("");
  lines.push("\\vspace{8pt}");
  lines.push("");

  const recipient = doc.recipient ? e(doc.recipient) : "Hiring Manager";
  lines.push("{\\fontsize{10}{14}\\selectfont\\setlength{\\parskip}{0pt}");
  lines.push(`${recipient}\\par`);
  lines.push(`${e(doc.company)}\\par`);
  lines.push("}");
  lines.push("");
  lines.push("\\vspace{10pt}");
  lines.push("");
  lines.push("{\\color{ruleblue!35}\\hrule height 0.5pt}");
  lines.push("");
  lines.push("\\vspace{10pt}");
  lines.push("");

  lines.push("{\\fontsize{10}{12}\\bfseries\\selectfont");
  lines.push(`Dear ${recipient},}`);
  lines.push("");
  lines.push("\\vspace{2pt}");
  lines.push("");

  lines.push("{\\fontsize{10}{15}\\selectfont");
  lines.push("");
  for (const para of doc.bodyParagraphs) {
    lines.push(e(para));
    lines.push("");
  }
  lines.push("}");
  lines.push("");
  lines.push("\\vspace{8pt}");
  lines.push("");
  lines.push("{\\color{ruleblue!35}\\hrule height 0.5pt}");
  lines.push("");
  lines.push("\\vspace{10pt}");
  lines.push("");

  lines.push("{\\fontsize{10}{14}\\selectfont\\setlength{\\parskip}{3pt}");
  if (doc.closing) {
    lines.push(e(doc.closing));
    lines.push("");
  }
  lines.push(e(doc.signoff));
  lines.push("");
  lines.push(e(doc.name));
  lines.push("");
  lines.push("}");

  return `${COVER_LETTER_TEX_PREAMBLE}\n\\begin{document}\n${lines.join("\n")}\n\\end{document}`;
}
