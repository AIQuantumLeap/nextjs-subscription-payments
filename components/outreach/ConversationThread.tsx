'use client';

interface Message {
  id: string;
  direction: 'inbound' | 'outbound';
  subject: string | null;
  body: string;
  sent_at: string;
}

interface ConversationThreadProps {
  messages: Message[];
  leadName: string;
  agentName: string;
}

export default function ConversationThread({ messages, leadName, agentName }: ConversationThreadProps) {
  if (messages.length === 0) {
    return <p className="text-sm text-zinc-500 py-4 text-center">No messages yet.</p>;
  }

  return (
    <div className="space-y-4">
      {messages.map((msg, i) => {
        const isOutbound = msg.direction === 'outbound';
        return (
          <div key={msg.id} className={`flex flex-col ${isOutbound ? 'items-end' : 'items-start'}`}>
            <div className={`max-w-[85%] rounded-2xl px-4 py-3 ${
              isOutbound
                ? 'bg-blue-600 text-white rounded-br-sm'
                : 'bg-zinc-800 text-zinc-200 rounded-bl-sm'
            }`}>
              {msg.subject && i === 0 && (
                <p className={`text-[10px] font-medium mb-1 ${isOutbound ? 'text-blue-200' : 'text-zinc-400'}`}>
                  Subject: {msg.subject}
                </p>
              )}
              <p className="text-sm whitespace-pre-wrap leading-relaxed">{msg.body}</p>
            </div>
            <div className="flex items-center gap-1.5 mt-1 px-1">
              <span className="text-[10px] text-zinc-500">
                {isOutbound ? agentName : leadName}
              </span>
              <span className="text-[10px] text-zinc-600">·</span>
              <span className="text-[10px] text-zinc-600">
                {new Date(msg.sent_at).toLocaleString()}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
