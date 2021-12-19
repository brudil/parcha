import { GraphQLDocument } from './GraphQLDocument';
import { IdentifierMissingLintRule } from './linters/IdentifierMissingLintRule';
import { SchemaContainer } from './SchemaContainer';

export interface Issue {
  message: string;
}

export type LinterRule = (
  document: GraphQLDocument,
  schema: SchemaContainer
) => Generator<Issue>;

export const linters: LinterRule[] = [IdentifierMissingLintRule];
