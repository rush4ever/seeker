import mammoth from 'mammoth';
import fs from 'fs';

const buffer = fs.readFileSync('/Users/valor/coding/seeker/refer/邵瀚文-数学错题集-20260514.docx');
const result = await mammoth.convertToHtml({ buffer });
const html = result.value;

function extractTextFromHtml(html) {
  return html
    .replace(/<img[^>]*>/g, ' [图片] ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const answerSectionIndex = html.indexOf('参考答案');
const questionHtml = answerSectionIndex > 0 ? html.substring(0, answerSectionIndex) : html;

const questionPattern = /(\d+)\s*[（(](客观题|主观题)[)）]\s*([^<]+).*?答题时间[：:]\s*(\d{4}-\d{2}-\d{2})/g;
const questionInfos = [];
let match;
while ((match = questionPattern.exec(questionHtml)) !== null) {
  questionInfos.push({ number: parseInt(match[1], 10), index: match.index });
}

for (let i = 0; i < questionInfos.length; i++) {
  const info = questionInfos[i];
  const startIdx = info.index;
  const endIdx = i + 1 < questionInfos.length ? questionInfos[i + 1].index : questionHtml.length;
  let contentHtml = questionHtml.substring(startIdx, endIdx);
  const tableEnd = contentHtml.indexOf('</table>');
  if (tableEnd > 0) contentHtml = contentHtml.substring(tableEnd + 8);
  contentHtml = contentHtml.replace(/<p>\s*<\/p>/g, '').replace(/\s+/g, ' ').trim();
  const content = extractTextFromHtml(contentHtml);
  console.log(`Q${info.number}: ${content.slice(0, 120)}`);
}
