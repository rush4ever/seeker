import { Settings } from "lucide-react";

export default function SettingsPage() {
  return (
    <div className="flex flex-col items-center justify-center h-full text-gray-400">
      <Settings size={48} className="mb-4" />
      <p className="text-lg">设置功能将在后续版本中实现</p>
      <p className="text-sm mt-2">备份配置、模型配置、年级管理</p>
    </div>
  );
}
