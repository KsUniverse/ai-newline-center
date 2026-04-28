/**
 * 将模板内容中的 {{variable}} 占位符替换为对应变量值。
 * 若变量表中不存在该 key，保留原始占位符（避免生成残缺 Prompt）。
 */
export function renderPromptTemplate(
  content: string,
  variables: Record<string, string>,
): string {
  return content.replace(/\{\{(\w+)\}\}/g, (match, key: string) => {
    return key in variables ? (variables[key] ?? match) : match;
  });
}
