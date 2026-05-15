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
      // We match questions whose chapter contains the knowledge node name
      const statsMap = new Map<
        number,
        { question_count: number; avg_mastery: number | null }
      >();

      if (studentId) {
        for (const node of rawNodes) {
          // Leaf nodes (actual knowledge points) match by name
          // Non-leaf nodes (grades, chapters) aggregate their descendants
          const hasChildren = rawNodes.some((n) => n.parent_id === node.id);

          let result: { question_count: number; avg_mastery: number | null };

          if (hasChildren) {
            // For non-leaf nodes, aggregate all descendant leaf nodes
            const descendantIds = getDescendantIds(node.id, rawNodes);
            const descendantNames = descendantIds
              .map((id) => rawNodes.find((n) => n.id === id)?.name)
              .filter(Boolean) as string[];

            if (descendantNames.length === 0) {
              result = { question_count: 0, avg_mastery: null };
            } else {
              // Build chapter LIKE conditions for all descendants
              const likeConditions = descendantNames
                .map((_, i) => `chapter LIKE $${i + 3}`)
                .join(" OR ");
              const likeParams = descendantNames.map((n) => `%${n}%`);

              const rows = await db.select<
                { question_count: number; avg_mastery: number }[]
              >(
                `SELECT COUNT(*) as question_count, COALESCE(AVG(mastery_score), 0) as avg_mastery
                 FROM questions
                 WHERE student_id = $1 AND subject = $2 AND (${likeConditions})`,
                [studentId, subject, ...likeParams]
              );
              const row = rows[0];
              result = {
                question_count: row.question_count,
                avg_mastery: row.question_count > 0 ? row.avg_mastery : null,
              };
            }
          } else {
            // For leaf nodes, match by name directly
            const rows = await db.select<
              { question_count: number; avg_mastery: number }[]
            >(
              `SELECT COUNT(*) as question_count, COALESCE(AVG(mastery_score), 0) as avg_mastery
               FROM questions
               WHERE student_id = $1 AND subject = $2 AND chapter LIKE $3`,
              [studentId, subject, `%${node.name}%`]
            );
            const row = rows[0];
            result = {
              question_count: row.question_count,
              avg_mastery: row.question_count > 0 ? row.avg_mastery : null,
            };
          }

          statsMap.set(node.id, result);
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

function getDescendantIds(
  parentId: number,
  allNodes: KnowledgeNode[]
): number[] {
  const result: number[] = [];
  const children = allNodes.filter((n) => n.parent_id === parentId);
  for (const child of children) {
    const hasGrandchildren = allNodes.some((n) => n.parent_id === child.id);
    if (hasGrandchildren) {
      result.push(...getDescendantIds(child.id, allNodes));
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
