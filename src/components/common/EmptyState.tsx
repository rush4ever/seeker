import type { LucideIcon } from "lucide-react";

interface Props {
  icon: LucideIcon;
  message: string;
}

export default function EmptyState({ icon: Icon, message }: Props) {
  return (
    <div className="flex flex-col items-center justify-center h-full text-gray-400">
      <Icon size={48} className="mb-4" />
      <p className="text-lg">{message}</p>
    </div>
  );
}
