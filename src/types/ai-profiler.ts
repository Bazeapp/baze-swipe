export type AiProfilerDecision = "pass" | "no_pass" | "ambiguous";

export type AiProfilerRating = "alto" | "medio" | "basso";

export interface AiProfilerAreaDetail {
  rating: AiProfilerRating;
  why: string;
}

export type AiProfilerAreas = Record<string, AiProfilerAreaDetail | undefined>;

export type AiProfilerContextSection = Record<
  string,
  string | number | boolean | null | undefined
>;

export interface AiProfilerResponse {
  decision: AiProfilerDecision;
  reason: string;
  areas: AiProfilerAreas;
  risk_flags?: string[];
  version?: string;
  context?: {
    worker?: AiProfilerContextSection;
    job?: AiProfilerContextSection;
    competenze?: AiProfilerContextSection;
    referenze?: AiProfilerContextSection;
    travel_time?: AiProfilerContextSection;
    disponibilita?: AiProfilerContextSection;
    [key: string]: AiProfilerContextSection | undefined;
  };
}
