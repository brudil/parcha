import { readFile } from 'fs/promises';
import {DocumentManager} from './DocumentManager'
import { GraphQLDocument } from './GraphQLDocument';
const HORRIBLE_REGEX = /gql`(?<query>(.|\n)*?)`/gi;

export class SourceFile {
  public queries: GraphQLDocument[] = [];

  constructor(public readonly path: string, private manager: DocumentManager) {}

  async refresh() {
    this.queries.forEach(doc => this.manager.removeDocument(doc));
    this.queries = [];
    const file = await readFile(this.path, { encoding: 'utf-8' });
    const m = [...file.matchAll(HORRIBLE_REGEX)];
    if (m.length > 0) {
      m.forEach((i) => {
        const query = i.groups?.query;

        if (query) {
          const doc = this.manager.addDocument(this, query);
          this.queries.push(doc);
        }
      });
    }
  }
}
