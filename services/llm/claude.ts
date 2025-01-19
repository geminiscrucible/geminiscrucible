import { Anthropic } from "@anthropic-ai/sdk";
import type { Message, StructuredMessage } from "./types";

export interface SendMessageOptions {
  messages: Message[];
  maxTokens?: number;
}

// Interface to enforce the structure of tool calls
interface ToolCallSchema {
  name: "approveTransfer" | "rejectTransfer";
  arguments: {
    explanation: string;
  };
}

export async function sendMessage({
  messages,
  maxTokens = 1000,
}: SendMessageOptions): Promise<StructuredMessage> {
  const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY!,
  });

  let systemPrompt: string | undefined;
  let messagesToSend = messages;

  if (messages[0]?.role === "system") {
    systemPrompt = messages[0].content;
    messagesToSend = messages.slice(1);
  }

  const claudeMessages: Anthropic.MessageParam[] = messagesToSend.map(
    (msg) => ({
      role: msg.role === "assistant" ? "assistant" : "user",
      content: msg.content,
    })
  );

  const tools: Anthropic.Tool[] = [
    {
      name: "approveTransfer",
      description: "Approve the money transfer request and provide explanation",
      input_schema: {
        type: "object" as const,
        properties: {
          explanation: {
            type: "string",
            description: "Explanation for why the money transfer is approved",
          },
        },
        required: ["explanation"],
      },
    },
    {
      name: "rejectTransfer",
      description: "Reject the money transfer request and provide explanation",
      input_schema: {
        type: "object" as const,
        properties: {
          explanation: {
            type: "string",
            description: "Explanation for why the money transfer is rejected",
          },
        },
        required: ["explanation"],
      },
    },
  ];

  const completion = await anthropic.messages.create({
    model: "claude-3-5-sonnet-latest",
    messages: claudeMessages,
    system: systemPrompt,
    tools: tools,
    max_tokens: maxTokens,
  });

  console.log("completion");
  console.log(completion.content);

  // Iterate through the content array and enforce tool usage
  for (const content of completion.content) {
      if (content.type === "tool_use") {
        // Use the ToolCallSchema for validation
          const toolUseContent = content as ToolCallSchema;

          // Validate tool name and arguments
          if (
              (toolUseContent.name === "approveTransfer" ||
              toolUseContent.name === "rejectTransfer") &&
              toolUseContent.arguments &&
              typeof toolUseContent.arguments.explanation === "string" &&
              toolUseContent.arguments.explanation.trim() !== ""
          ) {
              return {
                  explanation: toolUseContent.arguments.explanation,
                  decision: toolUseContent.name === "approveTransfer",
              };
          } else {
              // Invalid tool use, treat as rejection
              return {
                  explanation: "Invalid tool use format or missing explanation.",
                  decision: false,
              };
          }
      }
  }

  // Fallback: Handle cases where no valid tool call is found (treat as rejection)
  try {
    const responseText =
      completion.content[0].type === "text" ? completion.content[0].text : "";

    const response = JSON.parse(responseText);
     // Check if the parsed response has the expected structure
     if (
      typeof response === "object" &&
      response !== null &&
      "explanation" in response &&
      typeof response.explanation === "string"
    ) {
      return {
        explanation: response.explanation,
        decision: false, // Default to false if no tool call
      };
    } else {
      throw new Error("Invalid response structure");
    }
  } catch (e) {
    // Fallback if response isn't valid JSON or doesn't have the expected structure
    const fallbackText =
      completion.content[0].type === "text"
        ? completion.content[0].text
        : "Transfer rejected";

    return {
      explanation: fallbackText,
      decision: false,
    };
  }
}