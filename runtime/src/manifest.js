import fs from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';
import Ajv from 'ajv';

const schemaPath = path.resolve(process.cwd(), 'schemas/manifest.schema.json');
const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
const ajv = new Ajv({ allErrors: true, strict: false, allowUnionTypes: true });
const validate = ajv.compile(schema);

export function loadAndValidateManifest() {
  const manifestPath = process.env.HUB_MANIFEST;
  if (!manifestPath) {
    return { manifest: null, errors: ["HUB_MANIFEST is not set"] };
  }
  if (!fs.existsSync(manifestPath)) {
    return { manifest: null, errors: [`Manifest not found: ${manifestPath}`] };
  }
  const raw = fs.readFileSync(manifestPath, 'utf8');
  const manifest = YAML.parse(raw);
  const ok = validate(manifest);
  if (!ok) {
    const errors = (validate.errors || []).map(e => `${e.instancePath || '/'} ${e.message}`);
    return { manifest: null, errors };
  }
  // Namespace uniqueness check
  const namespaces = new Set();
  for (const [name, cfg] of Object.entries(manifest.cores || {})) {
    const ns = cfg.namespace || name;
    if (namespaces.has(ns)) {
      return { manifest: null, errors: [`Duplicate namespace: ${ns}`] };
    }
    namespaces.add(ns);
  }
  return { manifest, errors: [] };
}

