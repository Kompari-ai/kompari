import type { PredictionFactor } from "@/lib/factors";

export type PredictionInput = {
  title: string;
  category: string;
  candidates: string[];
  aiDisplayName: string;
};

export type PredictionOutput = {
  main: string;
  second?: string;
  third?: string;
  confidence?: string;
  reason?: string;
  evidence?: string;
  usedFactors?: PredictionFactor[];
  factorKeys?: string[];
};
