export interface SYCorpus {
  version: string;
  stats: {
    units: number;
    occurrences: number;
    names: number;
    repeated_names: number;
    single_occurrence_names: number;
  };
  evidence: {
    occurrences: unknown[];
    names: unknown[];
  };
  validation: {
    valid: boolean;
    errors: string[];
  };
  [key: string]: unknown;
}

export function createConverter(spec: unknown): (source: string) => SYCorpus;
