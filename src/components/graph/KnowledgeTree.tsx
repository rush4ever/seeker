import { useState, useCallback } from "react";
import type { KnowledgeTreeNode } from "../../types";
import { ChevronRight, ChevronDown, Circle } from "lucide-react";

interface Props {
  tree: KnowledgeTreeNode[];
  selectedId?: number;
  onSelect: (node: KnowledgeTreeNode) => void;
}

export default function KnowledgeTree({ tree, selectedId, onSelect }: Props) {
  return (
    <div className="space-y-0.5">
      {tree.map((root) => (
        <TreeNode
          key={root.node.id}
          item={root}
          depth={0}
          selectedId={selectedId}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
}

function TreeNode({
  item,
  depth,
  selectedId,
  onSelect,
}: {
  item: KnowledgeTreeNode;
  depth: number;
  selectedId?: number;
  onSelect: (node: KnowledgeTreeNode) => void;
}) {
  const [expanded, setExpanded] = useState(depth < 2);
  const hasChildren = item.children.length > 0;
  const isSelected = selectedId === item.node.id;

  const toggle = useCallback(() => {
    if (hasChildren) {
      setExpanded((prev) => !prev);
    }
  }, [hasChildren]);

  const masteryColor = getMasteryColor(item.node.avg_mastery, item.node.question_count);
  const masteryLabel = getMasteryLabel(item.node.avg_mastery, item.node.question_count);

  return (
    <div>
      <div
        className={`flex items-center gap-2 py-2 px-2 rounded-lg cursor-pointer transition-colors ${
          isSelected ? "bg-primary-50 ring-1 ring-primary-200" : "hover:bg-gray-50"
        }`}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
        onClick={() => onSelect(item)}
      >
        {/* Expand/collapse toggle */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            toggle();
          }}
          className={`w-5 h-5 flex items-center justify-center rounded hover:bg-gray-200 transition-colors ${
            hasChildren ? "" : "invisible"
          }`}
        >
          {expanded ? (
            <ChevronDown size={14} className="text-gray-500" />
          ) : (
            <ChevronRight size={14} className="text-gray-500" />
          )}
        </button>

        {/* Mastery indicator */}
        <Circle
          size={10}
          className="shrink-0"
          fill={masteryColor}
          stroke={masteryColor}
        />

        {/* Node name */}
        <span
          className={`text-sm flex-1 truncate ${
            isSelected ? "font-medium text-primary-700" : "text-gray-700"
          }`}
        >
          {item.node.name}
        </span>

        {/* Stats */}
        <div className="flex items-center gap-2 text-xs shrink-0">
          {item.node.question_count > 0 && (
            <span className="text-gray-500">
              {item.node.question_count}道错题
            </span>
          )}
          <span
            className="px-1.5 py-0.5 rounded-full font-medium"
            style={{
              backgroundColor: `${masteryColor}20`,
              color: masteryColor,
            }}
          >
            {masteryLabel}
          </span>
        </div>
      </div>

      {/* Children */}
      {hasChildren && expanded && (
        <div>
          {item.children.map((child) => (
            <TreeNode
              key={child.node.id}
              item={child}
              depth={depth + 1}
              selectedId={selectedId}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function getMasteryColor(
  avgMastery: number | null,
  questionCount: number
): string {
  if (questionCount === 0) return "#9ca3af"; // gray-400
  if (avgMastery === null) return "#9ca3af";
  if (avgMastery < 30) return "#ef4444"; // red-500
  if (avgMastery < 70) return "#f59e0b"; // amber-500
  return "#22c55e"; // green-500
}

function getMasteryLabel(
  avgMastery: number | null,
  questionCount: number
): string {
  if (questionCount === 0) return "未学习";
  if (avgMastery === null) return "未学习";
  if (avgMastery < 30) return "薄弱";
  if (avgMastery < 70) return "一般";
  return "掌握";
}
