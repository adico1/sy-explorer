export interface SYCorpus {
  version: string;
  stats: {
    units: number;
    operations: number;
    domains: number;
    variants: number;
  };
  provenance: unknown[];
  validation: {
    valid: boolean;
    errors: string[];
  };
  [key: string]: unknown;
}

export function createConverter(spec: unknown): (source: string) => SYCorpus;
