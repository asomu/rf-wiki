import { readFile } from 'node:fs/promises';
import { parse } from 'yaml';

const [designSource, tokenSource, cssSource, figmaSource] = await Promise.all([
  readFile(new URL('../DESIGN.md', import.meta.url), 'utf8'),
  readFile(new URL('../design/tokens.json', import.meta.url), 'utf8'),
  readFile(new URL('../src/styles/tokens.css', import.meta.url), 'utf8'),
  readFile(new URL('../design/figma-manifest.json', import.meta.url), 'utf8')
]);

const frontmatterMatch = designSource.match(/^---\n([\s\S]*?)\n---/);
if (!frontmatterMatch) throw new Error('DESIGN.md is missing YAML frontmatter.');

const design = parse(frontmatterMatch[1]);
const tokens = JSON.parse(tokenSource);
const figma = JSON.parse(figmaSource);
const cssDeclarations = new Map(
  [...cssSource.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)].map((match) => [match[1], match[2].trim()])
);

function resolveCssValue(name, trail = new Set()) {
  if (trail.has(name)) throw new Error(`Circular CSS variable reference at ${name}`);
  const value = cssDeclarations.get(name);
  if (!value) return undefined;
  const reference = value.match(/^var\((--[\w-]+)\)$/);
  if (!reference) return value;
  return resolveCssValue(reference[1], new Set([...trail, name]));
}

const errors = [];
for (const [name, token] of Object.entries(tokens.colors)) {
  const designValue = design.colors?.[name];
  if (designValue?.toLowerCase() !== token.value.toLowerCase()) {
    errors.push(`DESIGN.md colors.${name}=${designValue} but design/tokens.json=${token.value}`);
  }
  const cssValue = resolveCssValue(token.css);
  if (!cssValue) errors.push(`Missing CSS token ${token.css}`);
  if (cssValue && cssValue.toLowerCase() !== token.value.toLowerCase()) {
    errors.push(`${token.css}=${cssValue} but token value=${token.value}`);
  }
}

for (const groupName of ['spacing', 'radii', 'typography', 'layout', 'motion']) {
  for (const token of Object.values(tokens[groupName])) {
    const cssValue = resolveCssValue(token.css);
    if (!cssValue) errors.push(`Missing CSS token ${token.css}`);
    if (cssValue && cssValue !== token.value) {
      errors.push(`${token.css}=${cssValue} but token value=${token.value}`);
    }
  }
}

if (figma.fileKey !== tokens.meta.figmaFileKey) errors.push('Figma file key mismatch.');
if (figma.foundations.variables !== 81 || figma.foundations.validation !== 'passed') {
  errors.push('Figma foundation manifest is not at the validated 81-variable checkpoint.');
}

if (errors.length > 0) {
  console.error(errors.map((error) => `- ${error}`).join('\n'));
  process.exit(1);
}

console.log(
  `Design contract OK: ${Object.keys(tokens.colors).length} resolved CSS colors, ` +
  `${figma.foundations.variables} variables at the validated Figma manifest checkpoint.`
);
