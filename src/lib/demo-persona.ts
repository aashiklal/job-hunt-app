import type { GeneratedResume } from "@/lib/generated-documents";

/**
 * The fictional person behind every piece of demo content.
 *
 * The seeded resumes, the generated resume and cover letter, the outreach
 * fixtures, and interview prep all read from here, so they describe
 * the same person and cannot drift apart. Everything in this file is invented:
 * the person, the employers and the numbers. Keep it that way. Do not base
 * the persona on a real resume, and do not borrow stories from this app's own
 * history, because a demo visitor reads it as the developer's own CV.
 */

type PersonaRole = {
  jobTitle: string;
  company: string;
  dateRange: string;
  location: string;
  /** Bullets for the primary (full stack) resume. */
  bullets: string[];
  /** Bullets for the backend-leaning variant. Falls back to `bullets`. */
  backendBullets?: string[];
};

export const DEMO_PERSONA = {
  name: "Jordan Avery",
  firstName: "Jordan",
  contact: {
    location: "Chicago, IL",
    phone: "+1 (555) 010-4821",
    email: "jordan.avery@example.com",
    linkedin: "linkedin.com/in/example",
    github: "github.com/example",
    website: null,
    workRights: null,
  } satisfies GeneratedResume["contact"],
  yearsExperience: 7,
  summary:
    "Full stack engineer with 7 years building customer-facing web products. Depth in TypeScript, React and Node, with a habit of measuring before changing anything and owning features from the database through to the interface.",
  backendSummary:
    "Backend-leaning engineer with 7 years of experience in API design, data modelling and search. Comfortable owning a service end to end or going deep on a performance problem.",
  experience: [
    {
      jobTitle: "Senior Software Engineer",
      company: "Brightwater Commerce",
      dateRange: "2021 - Present",
      location: "Chicago, IL",
      bullets: [
        "Led the checkout rebuild for a storefront platform serving around 3,000 merchants, cutting checkout load time from 3.8s to 1.2s and lifting completed orders by 9%.",
        "Rebuilt product search relevance with synonym handling and typo tolerance, raising search-to-cart conversion by 14%.",
        "Introduced a shared component library adopted by four product teams, removing roughly 30% of duplicated UI code.",
        "Mentored three engineers and ran the team's interview loop for two years.",
      ],
      backendBullets: [
        "Designed the order and inventory APIs behind the checkout rebuild, handling roughly 60,000 orders on peak days without a missed reservation.",
        "Moved product search to a dedicated search service, bringing p95 query latency from 900ms to 160ms.",
        "Owned the service's observability: structured logging, tracing and alerts tied to customer-facing outcomes.",
      ],
    },
    {
      jobTitle: "Software Engineer",
      company: "Harbor Health",
      dateRange: "2018 - 2021",
      location: "Remote",
      bullets: [
        "Built the patient appointment booking flow used by around 40 clinics, replacing a phone-only process.",
        "Made the booking app usable offline in low-signal clinics, cutting abandoned bookings by a third.",
        "Improved on-call runbooks and alerts for the scheduling service, halving out-of-hours pages.",
      ],
      backendBullets: [
        "Designed the scheduling service's data model for recurring appointments across time zones.",
        "Replaced a nightly availability export with an event-driven sync, so clinics saw openings within a minute.",
      ],
    },
    {
      jobTitle: "Junior Developer",
      company: "Lumen Labs",
      dateRange: "2017 - 2018",
      location: "Chicago, IL",
      bullets: [
        "Shipped features across a Django backend and a React frontend for agency clients.",
      ],
    },
  ] satisfies PersonaRole[],
  skills: [
    { category: "Languages", items: ["TypeScript", "JavaScript", "Python", "SQL"] },
    { category: "Frontend", items: ["React", "Next.js", "Tailwind CSS", "Accessibility"] },
    { category: "Backend", items: ["Node.js", "PostgreSQL", "Redis", "Elasticsearch", "REST APIs"] },
    { category: "Infrastructure", items: ["AWS", "Docker", "CI/CD", "Observability"] },
  ] satisfies GeneratedResume["skills"],
  education: [
    {
      degree: "BSc Computer Science",
      school: "University of Illinois Chicago",
      gradDate: "2017",
      notes: null,
    },
  ] satisfies GeneratedResume["education"],
  projects: [
    {
      name: "Trailhead",
      techStack: "React Native, TypeScript, Supabase",
      bullets: [
        "Open source hiking trail planner with offline maps, used by around 2,000 people.",
      ],
    },
  ] satisfies GeneratedResume["projects"],
} as const;

/**
 * The one story the outreach and prep fixtures lean on, so the messages sound
 * like the same person wrote them.
 */
export const DEMO_SIGNATURE_STORY = {
  short: "rebuilding a checkout flow that cut load time from 3.8s to 1.2s and lifted completed orders by 9%",
  interviewHint:
    "Use the checkout rebuild: it has clear scope, a measured before and after, and evidence that you brought product and design along rather than working alone.",
} as const;

/** The structured resume body, before it is tailored to a job. */
export function personaResume(): GeneratedResume {
  return {
    kind: "resume",
    name: DEMO_PERSONA.name,
    contact: { ...DEMO_PERSONA.contact },
    summary: DEMO_PERSONA.summary,
    skills: DEMO_PERSONA.skills.map((s) => ({ category: s.category, items: [...s.items] })),
    experience: DEMO_PERSONA.experience.map((role) => ({
      jobTitle: role.jobTitle,
      company: role.company,
      dateRange: role.dateRange,
      subtitle: role.location,
      bullets: [...role.bullets],
    })),
    projects: DEMO_PERSONA.projects.map((p) => ({ ...p, bullets: [...p.bullets] })),
    education: DEMO_PERSONA.education.map((e) => ({ ...e })),
    certifications: [],
    footer: null,
  };
}

/** Markdown for the resumes seeded into the demo's Resume list. */
export function personaResumeMarkdown(variant: "primary" | "backend"): string {
  const { name, contact } = DEMO_PERSONA;
  const backend = variant === "backend";

  const header =
    variant === "primary"
      ? `${contact.email} | ${contact.location} | ${contact.github} | ${contact.linkedin}`
      : `${contact.email} | ${contact.location}`;

  const experience = DEMO_PERSONA.experience
    .map((role) => {
      const bullets = (backend ? role.backendBullets : undefined) ?? role.bullets;
      return [
        `### ${role.jobTitle}, ${role.company}`,
        `${role.dateRange} | ${role.location}`,
        ...bullets.map((b) => `- ${b}`),
      ].join("\n");
    })
    .join("\n\n");

  const skills = DEMO_PERSONA.skills.flatMap((s) => s.items).join(", ");
  const education = DEMO_PERSONA.education
    .map((e) => `${e.degree}, ${e.school}, ${e.gradDate}`)
    .join("\n");

  return [
    `# ${name}`,
    header,
    "",
    "## Summary",
    backend ? DEMO_PERSONA.backendSummary : DEMO_PERSONA.summary,
    "",
    "## Experience",
    "",
    experience,
    "",
    "## Skills",
    skills,
    "",
    "## Education",
    education,
  ].join("\n");
}
