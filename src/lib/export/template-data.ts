export type ResumeTemplateData = {
  name: string;
  location: string | null;
  phone: string | null;
  email: string | null;
  linkedin: string | null;
  github: string | null;
  website: string | null;
  workRights: string | null;
  summary: string | null;
  skills: Array<{ category: string; items: string }>;
  experience: Array<{
    jobTitle: string;
    company: string;
    dateRange: string;
    subtitle: string | null;
    bullets: string[];
  }>;
  projects: Array<{
    name: string;
    techStack: string | null;
    bullets: string[];
  }>;
  education: Array<{
    degree: string;
    school: string;
    gradDate: string | null;
    notes: string | null;
  }>;
  certifications: string[];
  footer: string | null;
};

export type CoverLetterTemplateData = {
  name: string;
  date: string;
  recipient: string | null;
  company: string;
  role: string;
  bodyParagraphs: string[];
  closing: string | null;
};

export type TemplateData = ResumeTemplateData | CoverLetterTemplateData;
