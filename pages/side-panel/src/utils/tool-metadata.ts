interface ToolMetadata {
  label: string;
  icon: string;
}

const toolMetadataMap: Record<string, ToolMetadata> = {
  think: { label: 'Planning', icon: 'psychology' },
  inspect_page_dom: { label: 'Inspect DOM', icon: 'account_tree' },
  inspect_page_styles: { label: 'Inspect Styles', icon: 'palette' },
  read_page_text: { label: 'Read Page', icon: 'article' },
  pick_element: { label: 'Pick Element', icon: 'ads_click' },
  generate_react_component: { label: 'Generate Component', icon: 'widgets' },
  generate_js_script: { label: 'Generate Script', icon: 'code' },
  generate_css: { label: 'Generate Styles', icon: 'brush' },
  generate_background_worker: { label: 'Generate Worker', icon: 'engineering' },
  edit_artifact: { label: 'Edit Artifact', icon: 'edit' },
  deploy_artifact: { label: 'Deploy', icon: 'rocket_launch' },
  remove_artifact: { label: 'Remove', icon: 'delete' },
  request_user_input: { label: 'Request Input', icon: 'input' },
};

const snakeCaseToTitleCase = (name: string): string =>
  name
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

export const getToolMetadata = (toolName: string): ToolMetadata =>
  toolMetadataMap[toolName] ?? { label: snakeCaseToTitleCase(toolName), icon: 'terminal' };
