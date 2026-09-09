export interface SYCorpus {
  version: string;
  stats: {
    units: number;
    statements: number;
    relations: number;
    operations: number;
    domains: number;
    variants: number;
    tokens: number;
    lexemes: number;
    classified_lexemes: number;
    unclassified_lexemes: number;
  };
  provenance: unknown[];
  validation: {
    valid: boolean;
    errors: string[];
  };
  [key: string]: unknown;
}

export function createConverter(spec: unknown): (source: string) => SYCorpus;
