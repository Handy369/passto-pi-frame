import type {
  PasstoAgentConfirmQuestion,
  PasstoAgentTextQuestion,
  PasstoAgentChoiceQuestion,
  PasstoAgentMultiSelectQuestion,
  PasstoAgentPreviewPayload,
  PasstoAgentUiAdapter,
} from "./types.ts";

export function createPasstoAgentMemoryUiAdapter(responses: {
  choose?: Array<string>;
  multiselect?: Array<string[]>;
  prompt?: Array<string>;
  confirm?: Array<boolean>;
}): PasstoAgentUiAdapter {
  const chooseQueue = [...(responses.choose ?? [])];
  const multiselectQueue = [...(responses.multiselect ?? [])];
  const promptQueue = [...(responses.prompt ?? [])];
  const confirmQueue = [...(responses.confirm ?? [])];

  return {
    async choose(_question: PasstoAgentChoiceQuestion): Promise<string> {
      const value = chooseQueue.shift();
      if (value === undefined) throw new Error("No mocked choose response available");
      return value;
    },
    async multiselect(_question: PasstoAgentMultiSelectQuestion): Promise<string[]> {
      const value = multiselectQueue.shift();
      if (value === undefined) throw new Error("No mocked multiselect response available");
      return value;
    },
    async prompt(_question: PasstoAgentTextQuestion): Promise<string> {
      const value = promptQueue.shift();
      if (value === undefined) throw new Error("No mocked prompt response available");
      return value;
    },
    async confirm(_question: PasstoAgentConfirmQuestion): Promise<boolean> {
      const value = confirmQueue.shift();
      if (value === undefined) throw new Error("No mocked confirm response available");
      return value;
    },
    async preview(_payload: PasstoAgentPreviewPayload): Promise<void> {
      return;
    },
  };
}
