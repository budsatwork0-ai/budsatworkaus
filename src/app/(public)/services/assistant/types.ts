import type { ServiceType, WizardState, Action } from '../types';

export type { Action };

export type QuestionId =
  | 'service_pick'
  | 'win_storeys'
  | 'win_panes_int'
  | 'win_panes_ext'
  | 'win_tracks'
  | 'win_screens'
  | 'clean_scope'
  | 'clean_bedrooms'
  | 'clean_bathrooms'
  | 'yard_scope'
  | 'yard_size_bucket'
  | 'dump_subtype'
  | 'dump_load_type'
  | 'dump_load_count'
  | 'auto_rego_lookup'
  | 'auto_vehicle_size'
  | 'auto_service_level'
  | 'ls_tier'
  | 'ls_laundry_loads'
  | 'ls_sneaker_pairs'
  | 'ls_turnaround';

export type AssistantAnswerId =
  | QuestionId
  | 'auto_rego_plate'
  | 'auto_rego_state'
  | 'auto_detected_make'
  | 'auto_detected_model'
  | 'auto_detected_year'
  | 'auto_detected_body_style'
  | 'auto_detected_doors'
  | 'auto_detected_seats'
  | 'auto_detected_category'
  | 'auto_detected_size_category';

export type OptionDef = {
  value: string;
  label: string;
  sublabel?: string;
};

export type QuestionDef = {
  id: QuestionId;
  prompt: string;
  hint?: string;
  kind: 'button-grid' | 'stepper' | 'rego-lookup';
  options?: OptionDef[];
  min?: number;
  max?: number;
  defaultValue?: number;
};

export type AssistantAnswers = Partial<Record<AssistantAnswerId, string | number>>;

export type AssistantState = {
  open: boolean;
  dismissed: boolean;
  service: ServiceType | null;
  questionIndex: number;
  answers: AssistantAnswers;
};

export type LiveEstimate = {
  total: number;
  confidence: string;
  breakdown?: string; // short plain-text explanation, e.g. "3 loads × $30 · incl. pickup"
};

export type AssistantHandlers = {
  onOpen: () => void;
  onClose: () => void;
  onDismiss: () => void;
  onAnswer: (id: AssistantAnswerId, value: string | number) => void;
  onNext: () => void;
  onBack: () => void;
  onHandoff: () => void;
};

export type AssistantAPI = {
  open: boolean;
  dismissed: boolean;
  service: ServiceType | null;
  currentQuestion: QuestionDef | null;
  currentStep: number;
  totalSteps: number;
  answers: AssistantAnswers;
  liveEstimate: LiveEstimate | null;
  canGoBack: boolean;
  canAdvance: boolean;
  isComplete: boolean;
  handlers: AssistantHandlers;
};
