import { Search, Code2, Sigma, Sparkles, Briefcase, LineChart, GraduationCap, ShieldCheck, Blocks, Database, GitPullRequest, MessageSquare, Scale, Merge, Bot, Wand2, Brain, Rocket } from 'lucide-react';

const MAP = { Search, Code2, Sigma, Sparkles, Briefcase, LineChart, GraduationCap, ShieldCheck, Blocks, Database, GitPullRequest, MessageSquare, Scale, Merge, Bot, Wand2, Brain, Rocket };
export const agentIcon = (name) => MAP[name] || Bot;
export const ICON_CHOICES = ['Bot', 'Brain', 'Wand2', 'Rocket', 'Code2', 'Sparkles', 'Search', 'Briefcase'];
