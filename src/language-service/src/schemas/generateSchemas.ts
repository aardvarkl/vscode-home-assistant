import { resolve } from "path";
import * as TJS from "typescript-json-schema";
import * as fs from "fs";
import * as path from "path";
import { PathToSchemaMapping } from "./schemaService";
import { exit } from "process";

const settings: TJS.PartialArgs = {
  required: true,
  noExtraProps: true,
};

const compilerOptions: TJS.CompilerOptions = {
  strictNullChecks: true,
};

const jsonPath = path.join(__dirname, "mappings.json");
const filecontents = fs.readFileSync(jsonPath, "utf-8");

const outputFolder = path.join(__dirname, "json");

if (!fs.existsSync(outputFolder)) {
  fs.mkdirSync(outputFolder);
}

if (fs.readdirSync(outputFolder).length > 0 && process.argv[2] === "--quick") {
  console.debug(
    "Skipping schema generation because there already schema files",
  );
} else {
  console.log("Generating schemas...");
  const pathToSchemaMappings: PathToSchemaMapping[] = JSON.parse(filecontents);
  pathToSchemaMappings.forEach((mapping) => {
    console.log(mapping.path);
    const tsFile = resolve(path.join(__dirname, mapping.tsFile));
    const program = TJS.getProgramFromFiles([tsFile], compilerOptions);
    const schema = generateSchemaFromFile(program, tsFile, mapping.fromType);
    if (schema === null) {
      console.error("Schema generation failed");
      exit(1);
    }
    fs.writeFileSync(
      path.join(outputFolder, mapping.file),
      JSON.stringify(schema),
    );
  });
}

/**
 * Generate the schema for the type `typeName` declared in `tsFile`.
 *
 * Many integration files declare a type with the same name (`File`, `Item`,
 * `Schema`). Looking the type up by bare name lets typescript-json-schema
 * pick whichever one it finds first in the program, so e.g. the sensor schema
 * silently became the automation schema. Generate with unique names, choose
 * the symbol declared in the mapping's own file, then strip the uniqueness
 * suffixes again wherever a name doesn't clash, so definition names stay as
 * they were.
 */
function generateSchemaFromFile(
  program: TJS.Program,
  tsFile: string,
  typeName: string,
): TJS.Definition | null {
  const generator = TJS.buildGenerator(program, { ...settings, uniqueNames: true });
  if (!generator) {
    return null;
  }
  const declaredIn = (ref: TJS.SymbolRef): string[] =>
    (ref.symbol.declarations ?? []).map((d) => resolve(d.getSourceFile().fileName));
  const symbol = generator
    .getSymbols(typeName)
    .find((ref) => declaredIn(ref).includes(tsFile));
  if (!symbol) {
    console.error(`Type '${typeName}' not found in ${tsFile}`);
    return null;
  }
  return simplifyDefinitionNames(generator.getSchemaForSymbol(symbol.name));
}

/**
 * Turn unique definition names like "Item.1a2b3c4d" back into "Item" when only
 * one definition has that base name; clashing names become "Item", "Item_1"...
 */
function simplifyDefinitionNames(schema: TJS.Definition): TJS.Definition {
  const definitions = (schema.definitions ?? {}) as Record<string, unknown>;
  const baseName = (name: string): string => name.replace(/\.[0-9a-f]{8}$/, "");
  const byBase = new Map<string, string[]>();
  for (const name of Object.keys(definitions)) {
    const base = baseName(name);
    byBase.set(base, [...(byBase.get(base) ?? []), name]);
  }
  const rename = new Map<string, string>();
  for (const [base, names] of byBase) {
    names.forEach((name, i) => rename.set(name, i === 0 ? base : `${base}_${i}`));
  }
  let json = JSON.stringify(schema);
  for (const [from, to] of rename) {
    if (from !== to) {
      // References may be written raw or URL-encoded (e.g. "Record%3C...%3E")
      for (const [f, t] of [[from, to], [encodeURIComponent(from), encodeURIComponent(to)]]) {
        json = json.split(`"#/definitions/${f}"`).join(`"#/definitions/${t}"`);
      }
    }
  }
  const result = JSON.parse(json) as TJS.Definition;
  if (result.definitions) {
    const renamed: Record<string, unknown> = {};
    for (const [name, def] of Object.entries(result.definitions)) {
      renamed[rename.get(name) ?? name] = def;
    }
    result.definitions = renamed as TJS.Definition["definitions"];
  }
  return result;
}
