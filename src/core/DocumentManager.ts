import {GraphQLDocument} from './GraphQLDocument'
import {SourceFile} from './SourceFile'

export class DocumentManager {
  private queries = new Map<string, GraphQLDocument>()
  private mutations = new Map<string, GraphQLDocument>()
  private fragments = new Map<string, GraphQLDocument>()

  addDocument(source: SourceFile, query: string) {
    const doc = new GraphQLDocument(query);

    if (doc.type === 'fragment') {
      this.fragments.set(doc.name, doc);
    }

    if (doc.type === 'query') {
      this.queries.set(doc.name, doc);
    }

    if (doc.type === 'mutation') {
      this.mutations.set(doc.name, doc);
    }

    return doc;
  }

  getFragmentByName(name: string) {
    return this.fragments.get(name);
  }

  removeDocument(doc: GraphQLDocument) {
    if (doc.type === 'fragment') {
      this.fragments.delete(doc.name);
    }

    if (doc.type === 'query') {
      this.queries.delete(doc.name);
    }

    if (doc.type === 'mutation') {
      this.mutations.delete(doc.name);
    }
  }

  getQueries() {
    return [...this.queries.values()]
  }

  getMutations() {
    return [...this.mutations.values()]
  }

  getFragments() {
    return [...this.fragments.values()]
  }
}
