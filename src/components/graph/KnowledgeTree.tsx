import { useState, useCallback } from "react";
import type { KnowledgeTreeNode } from "../../types";
import { ChevronRight, ChevronDown, Circle } from "lucide-react";
import { masteryColorHex, masteryLabel } from "../../lib/mastery";

interface Props {
  tree: KnowledgeTreeNode[];
  selectedId?: number;
  onSelect: (node: KnowledgeTreeNode) => void;
  multiSelect?: boolean;
  selectedIds?: Set<number>;
  onToggle?: (id: number) => void;
}

export default function KnowledgeTree({
  tree,
  selectedId,
  onSelect,
  multiSelect,
  selectedIds,
  onToggle,
}: Props) {
  return (
    <div className="space-y-0.5">
      {tree.map((root) => (
        <TreeNode
          key={root.node.id}
          item={root}
          depth={0}
          selectedId={selectedId}
          onSelect={onSelect}
          multiSelect={multiSelect}
          selectedIds={selectedIds}
          onToggle={onToggle}
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
  multiSelect,
  selectedIds,
  onToggle,
}: {
  item: KnowledgeTreeNode;
  depth: number;
  selectedId?: number;
  onSelect: (node: KnowledgeTreeNode) => void;
  multiSelect?: boolean;
  selectedIds?: Set<number>;
  onToggle?: (id: number) => void;
}) {
  const [expanded, setExpanded] = useState(depth < 2);
  const hasChildren = item.children.length > 0;
  const isSelected = selectedId === item.node.id;

  const toggle = useCallback(() => {
    if (hasChildren) {
      setExpanded((prev) => !prev);
    }
  }, [hasChildren]);

  const hasQuestions = item.node.question_count > 0;
  const masteryScore = item.node.avg_mastery ?? 0;
  const color = hasQuestions ? masteryColorHex(masteryScore) : "#9ca3af";
  const label = hasQuestions ? masteryLabel(masteryScore) : "未学习";

  return (
    <div>
      <div
        className={`flex items-center gap-2 py-2 px-2 rounded-lg cursor-pointer transition-colors ${
          isSelected ? "bg-primary-50 ring-1 ring-primary-200" : "hover:bg-gray-50"
        }`}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
        onClick={() => onSelect(item)}
      >
        {/* Multi-select checkbox */}
        {multiSelect && (
          <input
            type="checkbox"
            checked={selectedIds?.has(item.node.id) ?? false}
            onChange={(e) => {
              e.stopPropagation();
              onToggle?.(item.node.id);
            }}
            onClick={(e) => e.stopPropagation()}
            className="w-3.5 h-3.5 shrink-0"
          />
        )}

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
          fill={color}
          stroke={color}
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
              backgroundColor: `${color}20`,
              color: color,
            }}
          >
            {label}
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
              multiSelect={multiSelect}
              selectedIds={selectedIds}
              onToggle={onToggle}
            />
          ))}
        </div>
      )}
    </div>
  );
}

