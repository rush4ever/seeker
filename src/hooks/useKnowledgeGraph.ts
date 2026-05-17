import { useState, useEffect, useCallback, useMemo } from "react";
import type {
  KnowledgeNode,
  KnowledgeNodeWithStats,
  KnowledgeTreeNode,
  Subject,
} from "../types";
import { getDb } from "../lib/db";

interface UseKnowledgeGraphOptions {
  studentId?: number;
  subject: Subject;
  grade?: number;
  semester?: number;
}

export function useKnowledgeGraph({
  studentId,
  subject,
  grade,
  semester,
}: UseKnowledgeGraphOptions) {
  const [nodes, setNodes] = useState<KnowledgeNodeWithStats[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const db = await getDb();

      // Build query filters
      const filters: string[] = ["subject = $1"];
      const params: (string | number)[] = [subject];
      let paramIdx = 2;

      if (grade !== undefined) {
        filters.push(`grade IN (0, $${paramIdx})`);
        params.push(grade);
        paramIdx++;
      }
      if (semester !== undefined) {
        filters.push(`semester IN (0, $${paramIdx})`);
        params.push(semester);
        paramIdx++;
      }

      const whereClause = filters.join(" AND ");

      // Fetch knowledge nodes
      const rawNodes = await db.select<KnowledgeNode[]>(
        `SELECT * FROM knowledge_nodes WHERE ${whereClause} ORDER BY id`,
        params
      );

      // Fetch question stats per knowledge node
      const statsMap = new Map<
        number,
        { question_count: number; avg_mastery: number | null }
      >();

      if (studentId) {
        // Identify leaf nodes (nodes with no children)
        const leafIds = new Set<number>();
        for (const node of rawNodes) {
          const hasChildren = rawNodes.some((n) => n.parent_id === node.id);
          if (!hasChildren) leafIds.add(node.id);
        }

        // Fetch stats for all leaf nodes in a single query via question_knowledge
        if (leafIds.size > 0) {
          const placeholders = Array.from(leafIds).map(() => "?").join(",");
          const leafRows = await db.select<
            { knowledge_id: number; question_count: number; avg_mastery: number }[]
          >(
            `SELECT qk.knowledge_id,
                    COUNT(*) as question_count,
                    AVG(q.mastery_score) as avg_mastery
             FROM question_knowledge qk
             JOIN questions q ON qk.question_id = q.id
             WHERE q.student_id = ? AND qk.knowledge_id IN (${placeholders})
             GROUP BY qk.knowledge_id`,
            [studentId, ...leafIds]
          );

          for (const row of leafRows) {
            statsMap.set(row.knowledge_id, {
              question_count: row.question_count,
              avg_mastery: row.question_count > 0 ? row.avg_mastery : null,
            });
          }
        }

        // Aggregate non-leaf nodes from their descendant leaf stats
        for (const node of rawNodes) {
          if (!statsMap.has(node.id)) {
            const descendantLeafIds = getDescendantLeafIds(node.id, rawNodes);
            let totalQuestions = 0;
            let weightedMasterySum = 0;

            for (const leafId of descendantLeafIds) {
              const leafStats = statsMap.get(leafId);
              if (leafStats && leafStats.question_count > 0) {
                totalQuestions += leafStats.question_count;
                weightedMasterySum += leafStats.avg_mastery! * leafStats.question_count;
              }
            }

            statsMap.set(node.id, {
              question_count: totalQuestions,
              avg_mastery: totalQuestions > 0 ? weightedMasterySum / totalQuestions : null,
            });
          }
        }
      }

      // Merge nodes with stats
      const nodesWithStats: KnowledgeNodeWithStats[] = rawNodes.map((node) => {
        const stats = statsMap.get(node.id);
        return {
          ...node,
          question_count: stats?.question_count ?? 0,
          avg_mastery: stats?.avg_mastery ?? null,
        };
      });

      setNodes(nodesWithStats);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [studentId, subject, grade, semester]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const tree = useMemo(() => buildTree(nodes), [nodes]);

  return { nodes, tree, loading, error, refresh };
}

/** Get all descendant leaf node IDs for a given parent. */
function getDescendantLeafIds(
  parentId: number,
  allNodes: KnowledgeNode[]
): number[] {
  const result: number[] = [];
  const children = allNodes.filter((n) => n.parent_id === parentId);
  for (const child of children) {
    const hasGrandchildren = allNodes.some((n) => n.parent_id === child.id);
    if (hasGrandchildren) {
      result.push(...getDescendantLeafIds(child.id, allNodes));
    } else {
      result.push(child.id);
    }
  }
  return result;
}

function buildTree(nodes: KnowledgeNodeWithStats[]): KnowledgeTreeNode[] {
  const nodeMap = new Map<number, KnowledgeTreeNode>();
  const roots: KnowledgeTreeNode[] = [];

  for (const node of nodes) {
    nodeMap.set(node.id, {
      node,
      children: [],
    });
  }

  for (const node of nodes) {
    const treeNode = nodeMap.get(node.id)!;
    if (node.parent_id === null) {
      roots.push(treeNode);
    } else {
      const parent = nodeMap.get(node.parent_id);
      if (parent) {
        parent.children.push(treeNode);
      }
    }
  }

  return roots;
}
