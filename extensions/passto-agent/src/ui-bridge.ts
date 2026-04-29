import type {
  PasstoAgentChoiceQuestion,
  PasstoAgentConfirmQuestion,
  PasstoAgentMultiSelectQuestion,
  PasstoAgentPreviewPayload,
  PasstoAgentTextQuestion,
  PasstoAgentUiAdapter,
} from "./types.ts";

export interface PasstoAgentUiBridge {
  choose(question: PasstoAgentChoiceQuestion): Promise<string>;
  multiselect(question: PasstoAgentMultiSelectQuestion): Promise<string[]>;
  prompt(question: PasstoAgentTextQuestion): Promise<string>;
  confirm(question: PasstoAgentConfirmQuestion): Promise<boolean>;
  preview?(payload: PasstoAgentPreviewPayload): Promise<void> | void;
}

export function createPasstoAgentUiAdapter(bridge: PasstoAgentUiBridge): PasstoAgentUiAdapter {
  return {
    choose(question) {
      return bridge.choose(question);
    },
    multiselect(question) {
      return bridge.multiselect(question);
    },
    prompt(question) {
      return bridge.prompt(question);
    },
    confirm(question) {
      return bridge.confirm(question);
    },
    preview(payload) {
      return bridge.preview?.(payload);
    },
  };
}
