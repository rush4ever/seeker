import { getDb } from "./db";
import type { KnowledgeNode, Subject } from "../types";

export interface TreeNode {
  id: number;
  name: string;
  subject: Subject;
  grade: number;
  semester: number;
  children: TreeNode[];
}

const MATH_NODES: Omit<KnowledgeNode, "is_preset" | "description">[] = [
  { id: 1, name: "数学", subject: "math", grade: 0, semester: 0, parent_id: null, chapter: "" },
  { id: 2, name: "初二上册", subject: "math", grade: 8, semester: 1, parent_id: 1, chapter: "" },
  { id: 3, name: "全等三角形", subject: "math", grade: 8, semester: 1, parent_id: 2, chapter: "" },
  { id: 4, name: "全等三角形的概念与性质", subject: "math", grade: 8, semester: 1, parent_id: 3, chapter: "" },
  { id: 5, name: "全等三角形的判定", subject: "math", grade: 8, semester: 1, parent_id: 3, chapter: "" },
  { id: 6, name: "轴对称图形", subject: "math", grade: 8, semester: 1, parent_id: 2, chapter: "" },
  { id: 7, name: "轴对称与轴对称图形", subject: "math", grade: 8, semester: 1, parent_id: 6, chapter: "" },
  { id: 8, name: "线段、角的轴对称性", subject: "math", grade: 8, semester: 1, parent_id: 6, chapter: "" },
  { id: 9, name: "勾股定理", subject: "math", grade: 8, semester: 1, parent_id: 2, chapter: "" },
  { id: 10, name: "勾股定理及其逆定理", subject: "math", grade: 8, semester: 1, parent_id: 9, chapter: "" },
  { id: 11, name: "实数", subject: "math", grade: 8, semester: 1, parent_id: 2, chapter: "" },
  { id: 12, name: "平方根与立方根", subject: "math", grade: 8, semester: 1, parent_id: 11, chapter: "" },
  { id: 13, name: "实数的概念与运算", subject: "math", grade: 8, semester: 1, parent_id: 11, chapter: "" },
  { id: 14, name: "平面直角坐标系", subject: "math", grade: 8, semester: 1, parent_id: 2, chapter: "" },
  { id: 15, name: "坐标与图形位置", subject: "math", grade: 8, semester: 1, parent_id: 14, chapter: "" },
  { id: 16, name: "一次函数", subject: "math", grade: 8, semester: 1, parent_id: 2, chapter: "" },
  { id: 17, name: "函数的概念与表示", subject: "math", grade: 8, semester: 1, parent_id: 16, chapter: "" },
  { id: 18, name: "一次函数的图像与性质", subject: "math", grade: 8, semester: 1, parent_id: 16, chapter: "" },
  { id: 19, name: "用待定系数法求一次函数表达式", subject: "math", grade: 8, semester: 1, parent_id: 16, chapter: "" },

  { id: 20, name: "初二下册", subject: "math", grade: 8, semester: 2, parent_id: 1, chapter: "" },
  { id: 21, name: "数据的收集、整理与描述", subject: "math", grade: 8, semester: 2, parent_id: 20, chapter: "" },
  { id: 22, name: "统计图表", subject: "math", grade: 8, semester: 2, parent_id: 21, chapter: "" },
  { id: 23, name: "认识概率", subject: "math", grade: 8, semester: 2, parent_id: 20, chapter: "" },
  { id: 24, name: "概率的计算", subject: "math", grade: 8, semester: 2, parent_id: 23, chapter: "" },
  { id: 25, name: "图形的平移、旋转与对称", subject: "math", grade: 8, semester: 2, parent_id: 20, chapter: "" },
  { id: 26, name: "图形的平移", subject: "math", grade: 8, semester: 2, parent_id: 25, chapter: "" },
  { id: 27, name: "图形的旋转", subject: "math", grade: 8, semester: 2, parent_id: 25, chapter: "" },
  { id: 28, name: "中心对称", subject: "math", grade: 8, semester: 2, parent_id: 25, chapter: "" },
  { id: 29, name: "分式", subject: "math", grade: 8, semester: 2, parent_id: 20, chapter: "" },
  { id: 30, name: "分式的概念与基本性质", subject: "math", grade: 8, semester: 2, parent_id: 29, chapter: "" },
  { id: 31, name: "分式的乘除", subject: "math", grade: 8, semester: 2, parent_id: 29, chapter: "" },
  { id: 32, name: "分式的加减", subject: "math", grade: 8, semester: 2, parent_id: 29, chapter: "" },
  { id: 33, name: "分式方程", subject: "math", grade: 8, semester: 2, parent_id: 29, chapter: "" },
  { id: 34, name: "反比例函数", subject: "math", grade: 8, semester: 2, parent_id: 20, chapter: "" },
  { id: 35, name: "反比例函数的图像与性质", subject: "math", grade: 8, semester: 2, parent_id: 34, chapter: "" },
  { id: 36, name: "反比例函数的应用", subject: "math", grade: 8, semester: 2, parent_id: 34, chapter: "" },

  { id: 37, name: "初三上册", subject: "math", grade: 9, semester: 1, parent_id: 1, chapter: "" },
  { id: 38, name: "一元二次方程", subject: "math", grade: 9, semester: 1, parent_id: 37, chapter: "" },
  { id: 39, name: "一元二次方程的概念与解法", subject: "math", grade: 9, semester: 1, parent_id: 38, chapter: "" },
  { id: 40, name: "根的判别式", subject: "math", grade: 9, semester: 1, parent_id: 38, chapter: "" },
  { id: 41, name: "根与系数的关系", subject: "math", grade: 9, semester: 1, parent_id: 38, chapter: "" },
  { id: 42, name: "一元二次方程的应用", subject: "math", grade: 9, semester: 1, parent_id: 38, chapter: "" },
  { id: 43, name: "二次函数", subject: "math", grade: 9, semester: 1, parent_id: 37, chapter: "" },
  { id: 44, name: "二次函数的图像与性质", subject: "math", grade: 9, semester: 1, parent_id: 43, chapter: "" },
  { id: 45, name: "二次函数与一元二次方程", subject: "math", grade: 9, semester: 1, parent_id: 43, chapter: "" },
  { id: 46, name: "二次函数的应用", subject: "math", grade: 9, semester: 1, parent_id: 43, chapter: "" },
  { id: 47, name: "圆", subject: "math", grade: 9, semester: 1, parent_id: 37, chapter: "" },
  { id: 48, name: "圆的基本性质", subject: "math", grade: 9, semester: 1, parent_id: 47, chapter: "" },
  { id: 49, name: "直线与圆的位置关系", subject: "math", grade: 9, semester: 1, parent_id: 47, chapter: "" },
  { id: 50, name: "圆与圆的位置关系", subject: "math", grade: 9, semester: 1, parent_id: 47, chapter: "" },
  { id: 51, name: "正多边形与圆", subject: "math", grade: 9, semester: 1, parent_id: 47, chapter: "" },
  { id: 52, name: "弧长与扇形面积", subject: "math", grade: 9, semester: 1, parent_id: 47, chapter: "" },

  { id: 53, name: "初三下册", subject: "math", grade: 9, semester: 2, parent_id: 1, chapter: "" },
  { id: 54, name: "锐角三角函数", subject: "math", grade: 9, semester: 2, parent_id: 53, chapter: "" },
  { id: 55, name: "正弦、余弦、正切", subject: "math", grade: 9, semester: 2, parent_id: 54, chapter: "" },
  { id: 56, name: "解直角三角形", subject: "math", grade: 9, semester: 2, parent_id: 54, chapter: "" },
  { id: 57, name: "三角函数的应用", subject: "math", grade: 9, semester: 2, parent_id: 54, chapter: "" },
  { id: 58, name: "相似三角形", subject: "math", grade: 9, semester: 2, parent_id: 53, chapter: "" },
  { id: 59, name: "相似三角形的判定", subject: "math", grade: 9, semester: 2, parent_id: 58, chapter: "" },
  { id: 60, name: "相似三角形的性质", subject: "math", grade: 9, semester: 2, parent_id: 58, chapter: "" },
  { id: 61, name: "相似三角形的应用", subject: "math", grade: 9, semester: 2, parent_id: 58, chapter: "" },
  { id: 62, name: "投影与视图", subject: "math", grade: 9, semester: 2, parent_id: 53, chapter: "" },
  { id: 63, name: "中心投影与平行投影", subject: "math", grade: 9, semester: 2, parent_id: 62, chapter: "" },
  { id: 64, name: "三视图", subject: "math", grade: 9, semester: 2, parent_id: 62, chapter: "" },
  { id: 65, name: "统计与概率综合", subject: "math", grade: 9, semester: 2, parent_id: 53, chapter: "" },
];

const PHYSICS_NODES: Omit<KnowledgeNode, "is_preset" | "description">[] = [
  { id: 101, name: "物理", subject: "physics", grade: 0, semester: 0, parent_id: null, chapter: "" },
  { id: 102, name: "初二上册", subject: "physics", grade: 8, semester: 1, parent_id: 101, chapter: "" },
  { id: 103, name: "声现象", subject: "physics", grade: 8, semester: 1, parent_id: 102, chapter: "" },
  { id: 104, name: "声音的产生与传播", subject: "physics", grade: 8, semester: 1, parent_id: 103, chapter: "" },
  { id: 105, name: "声音的特性", subject: "physics", grade: 8, semester: 1, parent_id: 103, chapter: "" },
  { id: 106, name: "物态变化", subject: "physics", grade: 8, semester: 1, parent_id: 102, chapter: "" },
  { id: 107, name: "温度与温度计", subject: "physics", grade: 8, semester: 1, parent_id: 106, chapter: "" },
  { id: 108, name: "熔化和凝固", subject: "physics", grade: 8, semester: 1, parent_id: 106, chapter: "" },
  { id: 109, name: "汽化和液化", subject: "physics", grade: 8, semester: 1, parent_id: 106, chapter: "" },
  { id: 110, name: "升华和凝华", subject: "physics", grade: 8, semester: 1, parent_id: 106, chapter: "" },
  { id: 111, name: "光现象", subject: "physics", grade: 8, semester: 1, parent_id: 102, chapter: "" },
  { id: 112, name: "光的直线传播", subject: "physics", grade: 8, semester: 1, parent_id: 111, chapter: "" },
  { id: 113, name: "光的反射", subject: "physics", grade: 8, semester: 1, parent_id: 111, chapter: "" },
  { id: 114, name: "光的折射", subject: "physics", grade: 8, semester: 1, parent_id: 111, chapter: "" },
  { id: 115, name: "透镜", subject: "physics", grade: 8, semester: 1, parent_id: 111, chapter: "" },
  { id: 116, name: "物体的运动", subject: "physics", grade: 8, semester: 1, parent_id: 102, chapter: "" },
  { id: 117, name: "长度和时间的测量", subject: "physics", grade: 8, semester: 1, parent_id: 116, chapter: "" },
  { id: 118, name: "速度", subject: "physics", grade: 8, semester: 1, parent_id: 116, chapter: "" },
  { id: 119, name: "直线运动", subject: "physics", grade: 8, semester: 1, parent_id: 116, chapter: "" },

  { id: 120, name: "初二下册", subject: "physics", grade: 8, semester: 2, parent_id: 101, chapter: "" },
  { id: 121, name: "物质的物理属性", subject: "physics", grade: 8, semester: 2, parent_id: 120, chapter: "" },
  { id: 122, name: "质量与密度", subject: "physics", grade: 8, semester: 2, parent_id: 121, chapter: "" },
  { id: 123, name: "密度的测量与应用", subject: "physics", grade: 8, semester: 2, parent_id: 121, chapter: "" },
  { id: 124, name: "力", subject: "physics", grade: 8, semester: 2, parent_id: 120, chapter: "" },
  { id: 125, name: "力的概念与测量", subject: "physics", grade: 8, semester: 2, parent_id: 124, chapter: "" },
  { id: 126, name: "重力", subject: "physics", grade: 8, semester: 2, parent_id: 124, chapter: "" },
  { id: 127, name: "弹力", subject: "physics", grade: 8, semester: 2, parent_id: 124, chapter: "" },
  { id: 128, name: "摩擦力", subject: "physics", grade: 8, semester: 2, parent_id: 124, chapter: "" },
  { id: 129, name: "力与运动", subject: "physics", grade: 8, semester: 2, parent_id: 120, chapter: "" },
  { id: 130, name: "二力平衡", subject: "physics", grade: 8, semester: 2, parent_id: 129, chapter: "" },
  { id: 131, name: "牛顿第一定律", subject: "physics", grade: 8, semester: 2, parent_id: 129, chapter: "" },
  { id: 132, name: "惯性", subject: "physics", grade: 8, semester: 2, parent_id: 129, chapter: "" },
  { id: 133, name: "压强和浮力", subject: "physics", grade: 8, semester: 2, parent_id: 120, chapter: "" },
  { id: 134, name: "压强", subject: "physics", grade: 8, semester: 2, parent_id: 133, chapter: "" },
  { id: 135, name: "液体压强", subject: "physics", grade: 8, semester: 2, parent_id: 133, chapter: "" },
  { id: 136, name: "气体压强", subject: "physics", grade: 8, semester: 2, parent_id: 133, chapter: "" },
  { id: 137, name: "浮力", subject: "physics", grade: 8, semester: 2, parent_id: 133, chapter: "" },
  { id: 138, name: "阿基米德原理", subject: "physics", grade: 8, semester: 2, parent_id: 133, chapter: "" },
  { id: 139, name: "物体的浮与沉", subject: "physics", grade: 8, semester: 2, parent_id: 133, chapter: "" },

  { id: 140, name: "初三上册", subject: "physics", grade: 9, semester: 1, parent_id: 101, chapter: "" },
  { id: 141, name: "简单机械和功", subject: "physics", grade: 9, semester: 1, parent_id: 140, chapter: "" },
  { id: 142, name: "杠杆", subject: "physics", grade: 9, semester: 1, parent_id: 141, chapter: "" },
  { id: 143, name: "滑轮", subject: "physics", grade: 9, semester: 1, parent_id: 141, chapter: "" },
  { id: 144, name: "功和功率", subject: "physics", grade: 9, semester: 1, parent_id: 141, chapter: "" },
  { id: 145, name: "机械效率", subject: "physics", grade: 9, semester: 1, parent_id: 141, chapter: "" },
  { id: 146, name: "机械能", subject: "physics", grade: 9, semester: 1, parent_id: 140, chapter: "" },
  { id: 147, name: "动能、势能、机械能", subject: "physics", grade: 9, semester: 1, parent_id: 146, chapter: "" },
  { id: 148, name: "内能", subject: "physics", grade: 9, semester: 1, parent_id: 140, chapter: "" },
  { id: 149, name: "内能、热量、比热容", subject: "physics", grade: 9, semester: 1, parent_id: 148, chapter: "" },
  { id: 150, name: "热机", subject: "physics", grade: 9, semester: 1, parent_id: 148, chapter: "" },
  { id: 151, name: "电路初探", subject: "physics", grade: 9, semester: 1, parent_id: 140, chapter: "" },
  { id: 152, name: "电路的组成", subject: "physics", grade: 9, semester: 1, parent_id: 151, chapter: "" },
  { id: 153, name: "电流和电流表", subject: "physics", grade: 9, semester: 1, parent_id: 151, chapter: "" },
  { id: 154, name: "电压和电压表", subject: "physics", grade: 9, semester: 1, parent_id: 151, chapter: "" },
  { id: 155, name: "串并联电路", subject: "physics", grade: 9, semester: 1, parent_id: 151, chapter: "" },
  { id: 156, name: "欧姆定律", subject: "physics", grade: 9, semester: 1, parent_id: 140, chapter: "" },
  { id: 157, name: "电阻", subject: "physics", grade: 9, semester: 1, parent_id: 156, chapter: "" },
  { id: 158, name: "欧姆定律及其应用", subject: "physics", grade: 9, semester: 1, parent_id: 156, chapter: "" },

  { id: 159, name: "初三下册", subject: "physics", grade: 9, semester: 2, parent_id: 101, chapter: "" },
  { id: 160, name: "电功和电热", subject: "physics", grade: 9, semester: 2, parent_id: 159, chapter: "" },
  { id: 161, name: "电功和电功率", subject: "physics", grade: 9, semester: 2, parent_id: 160, chapter: "" },
  { id: 162, name: "电热器", subject: "physics", grade: 9, semester: 2, parent_id: 160, chapter: "" },
  { id: 163, name: "家庭电路", subject: "physics", grade: 9, semester: 2, parent_id: 160, chapter: "" },
  { id: 164, name: "电与磁", subject: "physics", grade: 9, semester: 2, parent_id: 159, chapter: "" },
  { id: 165, name: "磁体与磁场", subject: "physics", grade: 9, semester: 2, parent_id: 164, chapter: "" },
  { id: 166, name: "电流的磁场", subject: "physics", grade: 9, semester: 2, parent_id: 164, chapter: "" },
  { id: 167, name: "磁场对电流的作用", subject: "physics", grade: 9, semester: 2, parent_id: 164, chapter: "" },
  { id: 168, name: "电磁感应", subject: "physics", grade: 9, semester: 2, parent_id: 164, chapter: "" },
  { id: 169, name: "电磁波与现代通信", subject: "physics", grade: 9, semester: 2, parent_id: 159, chapter: "" },
  { id: 170, name: "能源与可持续发展", subject: "physics", grade: 9, semester: 2, parent_id: 159, chapter: "" },
];

const ALL_NODES = [...MATH_NODES, ...PHYSICS_NODES];

export function getAllKnowledgeNodes(): Omit<KnowledgeNode, "is_preset" | "description">[] {
  return ALL_NODES;
}

export async function seedKnowledgeTree(): Promise<void> {
  const db = await getDb();

  // Check if already seeded
  const count = await db.select<{ count: number }[]>("SELECT COUNT(*) as count FROM knowledge_nodes");
  if (count[0].count > 0) return;

  for (const node of ALL_NODES) {
    await db.execute(
      `INSERT INTO knowledge_nodes (id, subject, grade, semester, chapter, name, parent_id, is_preset)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 1)`,
      [node.id, node.subject, node.grade, node.semester, node.chapter || "", node.name, node.parent_id]
    );
  }
}

export function buildTree(nodes: Omit<KnowledgeNode, "is_preset" | "description">[]): TreeNode[] {
  const nodeMap = new Map<number, TreeNode>();
  const roots: TreeNode[] = [];

  for (const node of nodes) {
    nodeMap.set(node.id, {
      id: node.id,
      name: node.name,
      subject: node.subject,
      grade: node.grade,
      semester: node.semester,
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
