// Типы данных API. Точная копия схем из docs/openapi.yaml — при изменении контракта меняем оба места.

export type Segment = 'retail' | 'services' | 'production';
export type FeedSegment = Segment | 'general';
export type CreditHistory = 'excellent' | 'fair' | 'poor';
export type Goal = 'working_capital' | 'equipment' | 'cash_gap';

export type ApplicationStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'CHECKING_EGRUL'
  | 'CHECKING_BKI'
  | 'SCORING'
  | 'APPROVED'
  | 'COUNTER_OFFER'
  | 'REJECTED'
  | 'OFFER_ACCEPTED'
  | 'SIGNED'
  | 'DISBURSED'
  | 'NEEDS_RECHECK';

export type DecisionOutcome = 'APPROVED' | 'COUNTER_OFFER' | 'REJECTED';

export interface Company {
  inn: string;
  name: string;
  /** Выручка за год, ₽ */
  annual_revenue: number;
  /** Текущие платежи по кредитам, ₽/мес */
  monthly_payments: number;
  credit_history: CreditHistory;
  business_age_years: number;
  segment: Segment;
}

export interface DemoProfile {
  id: string;
  label: string;
  risk_level: 'ideal' | 'medium' | 'risky';
  company: Company;
}

export interface ApplicationCreate {
  company: Company;
  requested_amount: number;
  term_months: number;
  goal: Goal;
}

export type StageCode = 'egrul' | 'bki' | 'scoring';
export type StageState = 'pending' | 'in_progress' | 'done' | 'failed';

export interface PipelineStage {
  code: StageCode;
  title: string;
  state: StageState;
  started_at: string | null;
  finished_at: string | null;
}

export type FactorCode = 'credit_history' | 'debt_load' | 'revenue' | 'business_age' | 'amount_to_revenue';

export interface Factor {
  code: FactorCode;
  name: string;
  points: number;
  max_points: number;
  explanation: string;
}

export interface Decision {
  outcome: DecisionOutcome;
  score: number | null;
  factors: Factor[];
  rate: number | null;
  approved_amount: number | null;
  term_months: number;
  monthly_payment: number | null;
  total_payment: number | null;
  overpayment: number | null;
  max_amount: number | null;
  capacity: number;
  debt_ratio: number;
  rejection_reason: string | null;
  recommendations: string[];
  reapply_date: string | null;
  decided_by: 'system' | 'bank';
  bank_comment: string | null;
}

export interface Application {
  events?: { occurred_at: string; from_status: string | null; to_status: string; actor: string; details: Record<string, unknown> }[];
  id: string;
  status: ApplicationStatus;
  status_label: string;
  created_at: string;
  updated_at: string;
  company: Company;
  requested_amount: number;
  term_months: number;
  goal: Goal;
  goal_label: string;
  pipeline: PipelineStage[];
  decision: Decision | null;
  sign_attempts_left: number;
  signed_at: string | null;
  disbursed_at: string | null;
  error_message: string | null;
}

export interface ApplicationSummary {
  id: string;
  status: ApplicationStatus;
  status_label: string;
  created_at: string;
  company_name: string;
  requested_amount: number;
  approved_amount: number | null;
  goal: Goal;
}

export interface FeedItem {
  id: string;
  title: string;
  summary: string;
  body: string;
  tag: string;
  read_minutes: number;
  synthetic: true;
}

export interface FeedResponse {
  segment: FeedSegment;
  segment_label: string;
  reason: string;
  items: FeedItem[];
}

export interface ResetResult {
  status: 'ok';
  removed_applications: number;
}

export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'COMPANY_NOT_FOUND'
  | 'INVALID_TRANSITION'
  | 'INVALID_SIGN_CODE'
  | 'TOO_MANY_ATTEMPTS'
  | 'UNAUTHORIZED'
  | 'INTERNAL_ERROR'
  | 'NETWORK_ERROR';

export interface ErrorBody {
  code: ErrorCode;
  message: string;
  details: Record<string, unknown>;
}

/** Ошибка API в едином формате {code, message, details}. Её бросают и мок, и HTTP-клиент. */
export class ApiError extends Error {
  readonly status: number;
  readonly code: ErrorCode;
  readonly details: Record<string, unknown>;

  constructor(status: number, body: ErrorBody) {
    super(body.message);
    this.name = 'ApiError';
    this.status = status;
    this.code = body.code;
    this.details = body.details;
  }
}
