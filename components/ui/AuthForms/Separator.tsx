interface SeparatorProps {
  text: string;
}

export default function Separator({ text }: SeparatorProps) {
  return (
    <div className="flex items-center gap-3 my-5">
      <div className="flex-1 border-t border-zinc-800" />
      <span className="text-xs text-zinc-500 whitespace-nowrap">{text}</span>
      <div className="flex-1 border-t border-zinc-800" />
    </div>
  );
}
