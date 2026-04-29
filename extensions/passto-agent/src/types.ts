export interface PasstoAgentConfirmationState {
  cwd?: boolean;
  goal?: boolean;
  stage?: boolean;
}

export interface PasstoAgentRequest {
  input: string;
  cwd?: string;
  execute?: boolean;
  confirm?: PasstoAgentConfirmationState;
}

export interface PasstoAgentTaskInput {
  kind: "file" | "doc" | "artifact" | "inline";
  path?: string;
  content?: string;
  label?: string;
  required?: boolean;
}

export interface PasstoAgentStageInfo {
  name: string;
  stageDocPath: string;
  description?: string;
  useCases: string[];
  requiredParameters: string[];
  optionalParameters: string[];
  recommendedExecutorType?: string;
  exampleTaskDoc?: string;
}

export interface PasstoAgentDraftTask {
  stage: string;
  cwd: string;
  taskTitle?: string;
  goal: string;
  executorType?: string;
  constraints: string[];
  todolist: string[];
  checklist: string[];
  inputs: PasstoAgentTaskInput[];
  preferredModel?: string;
  preferredThinking?: "none" | "low" | "medium" | "high";
  preferredRole?: string;
}

export interface PasstoAgentFieldResolution {
  field: string;
  status: "provided" | "inferred" | "required-user-input" | "skipped";
  source?: "provided" | "inferred" | "user";
}

export interface PasstoAgentAnalysis {
  stage: string;
  missingFields: string[];
  confirmationRequired: Array<"cwd" | "goal" | "stage">;
  stageInfo: PasstoAgentStageInfo;
  fieldResolutions: PasstoAgentFieldResolution[];
}

export interface PasstoAgentResult {
  stage: string;
  taskDocPath: string;
  executed: boolean;
  needsConfirmation: boolean;
  missingFields: string[];
  confirmationRequired: Array<"cwd" | "goal" | "stage">;
}

export interface PasstoAgentChoiceQuestion {
  title: string;
  options: string[];
  allowOther?: boolean;
  placeholder?: string;
}

export interface PasstoAgentMultiSelectQuestion {
  title: string;
  options: string[];
  allowOther?: boolean;
  placeholder?: string;
}

export interface PasstoAgentTextQuestion {
  title: string;
  placeholder?: string;
  prefill?: string;
}

export interface PasstoAgentConfirmQuestion {
  title: string;
  message: string;
}

export interface PasstoAgentPreviewPayload {
  title: string;
  message: string;
}

export interface PasstoAgentUiAdapter {
  choose(question: PasstoAgentChoiceQuestion): Promise<string>;
  multiselect(question: PasstoAgentMultiSelectQuestion): Promise<string[]>;
  prompt(question: PasstoAgentTextQuestion): Promise<string>;
  confirm(question: PasstoAgentConfirmQuestion): Promise<boolean>;
  preview?(payload: PasstoAgentPreviewPayload): Promise<void> | void;
}
