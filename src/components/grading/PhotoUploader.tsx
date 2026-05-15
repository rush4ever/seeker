import { useRef, useCallback } from "react";
import { Upload } from "lucide-react";

interface PhotoUploaderProps {
  onPhotoSelected: (base64: string) => void;
  disabled?: boolean;
}

export default function PhotoUploader({ onPhotoSelected, disabled }: PhotoUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (event) => {
        const base64 = event.target?.result as string;
        if (base64) onPhotoSelected(base64);
      };
      reader.readAsDataURL(file);

      // Reset input so the same file can be selected again
      e.target.value = "";
    },
    [onPhotoSelected]
  );

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFileChange}
        disabled={disabled}
      />
      <button
        onClick={() => inputRef.current?.click()}
        disabled={disabled}
        className="w-full flex flex-col items-center gap-2 p-6 border-2 border-dashed border-gray-300 rounded-lg hover:border-primary-400 hover:bg-primary-50 transition-colors disabled:opacity-50"
      >
        <Upload size={24} className="text-gray-400" />
        <span className="text-sm text-gray-500">点击上传答案照片</span>
      </button>
    </div>
  );
}
