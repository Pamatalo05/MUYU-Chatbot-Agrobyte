export type ChatRole = "user" | "muyu";

export interface ChatMessage {
  id: string;
  role: ChatRole;
  text: string;
}
