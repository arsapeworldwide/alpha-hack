import type { Application, Factor } from '../../api/types';

export interface Recommendation {
  outcome: string;
  score: number;
  amount: number | null;
  rate: number | null;
  term_months: number;
  monthly_payment: number | null;
  capacity: number;
  factors: Factor[];
}

export interface BankApplication extends Application {
  system_recommendation: Recommendation | null;
  waiting_minutes: number;
  capacity_excess: number;
  policy_rate: number | null;
}
