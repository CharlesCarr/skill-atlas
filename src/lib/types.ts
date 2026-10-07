export type SourceFile = { path: string; content: string };
export type Step = {
  id: string;
  skill?: string;
  title?: string;
  phase?: string;
  kind?: 'skill' | 'human';
  description?: string;
  inputs?: string[];
  outputs?: string[];
};
export type Connection = {
  from: string;
  to: string;
  label: string;
  type: 'handoff' | 'reference' | 'feedback';
};
export type Manifest = {
  version: 1;
  title: string;
  description?: string;
  steps: Step[];
  connections: Connection[];
};
export type Bundle = {
  version: 1;
  id: string;
  title: string;
  description: string;
  files: SourceFile[];
  manifest?: Manifest;
};
export type Section = { title: string; depth: number; line: number };
export type Skill = {
  id: string;
  title: string;
  description: string;
  path: string;
  source: string;
  body: string;
  frontmatter: Record<string, unknown>;
  sections: Section[];
  mentions: string[];
  links: { label: string; href: string; line: number }[];
};
export type Issue = { severity: 'warning' | 'error'; message: string; path?: string };
export type Workspace = {
  bundle: Bundle;
  skills: Skill[];
  steps: Step[];
  connections: Connection[];
  issues: Issue[];
  authored: boolean;
};
