import { resolveModel, type ModelRole } from "./models";

const OLLAMA_BASE = "http://localhost:11434";

function buildVisionPrompt(): string {
  return `请详细识别这张图片中的数学内容，按以下规则处理：

1. 如果是数学公式，转换为标准 LaTeX 格式（用 $...$ 包裹行内公式，$$...$$ 包裹独立公式）
2. 如果是几何图形，描述图形中的关键元素：点的位置、线段关系、角度标注、已知条件等
3. 如果是函数图象或坐标系，描述函数类型、关键点坐标、趋势特征
4. 如果是表格或图表，提取数据关系
5. 如果包含中文文字，保留原文
6. 如果图片中包含白色的方框符号 □（U+25A1），在 LaTeX 中输出为 \\square，不要忽略它

请直接输出识别结果，不要添加解释或前缀。`;
}

export async function parseImageContent(
  imageBase64: string,
  modelName?: string
): Promise<string> {
  const m =
    modelName ||
    (await resolveModel("vision" as ModelRole))?.model ||
    "llava:13b";

  const res = await fetch(`${OLLAMA_BASE}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: m,
      messages: [
        {
          role: "user",
          content: buildVisionPrompt(),
          images: [imageBase64.replace(/^data:image\/\w+;base64,/, "")],
        },
      ],
      stream: false,
    }),
  });

  if (!res.ok) {
    throw new Error(`Vision API error: ${res.status}`);
  }

  const data = (await res.json()) as {
    message?: { content?: string };
  };
  return data.message?.content?.trim() || "[图片识别失败]";
}
