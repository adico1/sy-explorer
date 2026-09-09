export interface SYCorpus {
  version: string;
  stats: {
    units: number;
    occurrences: number;
    names: number;
    repeated_names: number;
    single_occurrence_names: number;
    source_records: number;
    repeated_sequences: number;
    slot_candidates: number;
    single_unit_name_candidates: number;
  };
  evidence: {
    occurrences: unknown[];
    names: unknown[];
  };
  structure: {
    records: unknown[];
    adjacency_edges: unknown[];
    same_name_groups: unknown[];
    role_candidates: unknown[];
    repeated_sequences: unknown[];
    slots: unknown[];
  };
  validation: {
    valid: boolean;
    errors: string[];
  };
  [key: string]: unknown;
}

export function createConverter(spec: unknown): (source: string) => SYCorpus;
