type Replacement = string | { input: string, output: string };

interface TypeMap {
  replacements?: {
    [name: string]: Replacement,
  },
  passthrough?: boolean;
  passthroughPrepend?: string
}

interface PrintingConfig {
  scalars: TypeMap,
  enums: TypeMap,
  injection: string[],
}

interface DocumentsConfig {
  globs: string[]
}

interface SchemaConfig {
  path: string
}

interface OutputConfig {
  outputPath: string;
}

export interface Configuration {
  printing: PrintingConfig;
  documents: DocumentsConfig;
  schema: SchemaConfig;
  output: OutputConfig;
}
