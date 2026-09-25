export type ProjectState = 'Ready' | 'Recording' | 'Paused' | 'Stopping' | 'Processing' | 'Needs Review' | 'Interrupted' | 'Failed';
export type CoverageState = 'discovered' | 'captured' | 'tested-no-motion' | 'blocked' | 'not-tested';
export interface EditPlan { version: 1; source: string; clips: { start: number; end: number }[]; }
export interface NarratedSegment { video: string; audio: string; start: number; end: number; text: string; }
export interface BudgetApproval { cap: number; estimate: number; approved: true; quote: string; }
export interface Word { text: string; start: number; end: number; }
export interface Output { file: string; sha256: string; duration: number; captions?: string; }
export interface Project { id: string; name: string; mode: 'record' | 'walkthrough'; state: ProjectState; data: Record<string, unknown>; created: string; updated: string; }
