"use client";

import { ChatInterface } from "@/components/chat/ChatInterface";
import { useChatMessages } from "@/components/chat/ChatProvider";

export default function Home() {
  const { messages, setMessages } = useChatMessages();

  return <ChatInterface messages={messages} setMessages={setMessages} />;
}
