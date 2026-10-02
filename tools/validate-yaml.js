#!/usr/bin/env node
// Check a YAML file against one of the extension's generated JSON schemas,
// using the same validator (yaml-language-server) the extension uses.
//
// Usage (from the repo root, after `npm run schema`):
//   node tools/validate-yaml.js <schema-name> <file.yaml>
// Example:
//   node tools/validate-yaml.js integration-automation ~/automations.yaml
//
// Prints one line per problem (line:col [severity] message) and a TOTAL.
// Severity 1 = error, 2 = warning. Only schema checks are run here; the
// entity/area/label checks need a live Home Assistant connection.
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const ls = path.join(root, "src/language-service/node_modules/");
const { getLanguageService } = require(ls + "yaml-language-server/out/server/src/languageservice/yamlLanguageService");
const { TextDocument } = require(ls + "vscode-languageserver-textdocument");

const [schemaName, yamlPath] = process.argv.slice(2);
if (!schemaName || !yamlPath) {
  console.error("Usage: node tools/validate-yaml.js <schema-name> <file.yaml>");
  process.exit(2);
}
const schemaFile = path.join(root, "src/language-service/src/schemas/json", `${schemaName.replace(/\.json$/, "")}.json`);
const schema = JSON.parse(fs.readFileSync(schemaFile, "utf8"));
const uri = "file://" + path.resolve(yamlPath);

const service = getLanguageService({
  schemaRequestService: async () => "{}",
  workspaceContext: { resolveRelativePath: (p) => p },
});
const tags = ["include", "include_dir_list", "include_dir_named", "include_dir_merge_list",
  "include_dir_merge_named", "env_var", "input", "secret"].map((t) => `!${t} scalar`);
service.configure({
  validate: true,
  customTags: tags,
  isKubernetes: false,
  schemas: [{ uri: "ha://schema", fileMatch: [uri], schema }],
});

const doc = TextDocument.create(uri, "yaml", 1, fs.readFileSync(yamlPath, "utf8"));
service.doValidation(doc, false).then((diagnostics) => {
  for (const d of diagnostics) {
    const msg = d.message.replace(/\s+/g, " ").slice(0, 300);
    console.log(`${d.range.start.line + 1}:${d.range.start.character + 1} [${d.severity}] ${msg}`);
  }
  console.log(`TOTAL ${diagnostics.length}`);
});
