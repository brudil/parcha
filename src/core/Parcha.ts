import chokidar from 'chokidar';
import { blueBright, green } from 'colorette';
import { writeFile } from 'fs/promises';
import globby from 'globby';
import path from 'node:path';
import pLimit from 'p-limit';
import { CodeGenerator } from './CodeGenerator';
import {Configuration} from './Configuration'
import {DocumentManager} from './DocumentManager'
import { Logger } from './Logger';
import { SchemaContainer } from './SchemaContainer';
import { SourceFile } from './SourceFile';

export class Parcha {
  private fileCache = new Map<string, SourceFile>();

  private schema = new SchemaContainer(this.config);

  private documentManager = new DocumentManager();

  private generator = new CodeGenerator(this.config, this.schema, this.documentManager);

  private globs = ['!**/node_modules', '!**/*.d.ts', '!**/service'];

  private outputted = '';

  constructor(private config: Configuration) {
    this.config.documents.globs.forEach((rel) => this.globs.unshift(path.join(process.cwd(), rel)));
    this.globs.push(`!${path.join(process.cwd(), this.config.output.outputPath)}`);
  }

  async build() {
    await this.schema.load();

    Logger.logger.time('build');
    const files = await globby(this.globs);

    const sources = files.map((path) => this.addSourceFile(path));

    const limit = pLimit(30);

    await Promise.all(sources.map((source) => limit(() => source.refresh())));
    Logger.logger.timeEnd('build');

    await this.save();
  }

  getDocumentCount() {
    return [...this.fileCache.values()].flatMap((source) => source.queries)
      .length;
  }

  lint() {
    Logger.logger.time('lint');

    [...this.fileCache.values()].forEach((source) => {
      source.queries.forEach((doc) => {
        for (const issue of doc.lint(this.schema)) {
          console.log(`Issue found in ${source.path}`);
          console.log(issue.message);
        }
      });
    });

    Logger.logger.timeEnd('lint');
  }

  async save() {
    const nextOutput = await this.generator.output();

    if (nextOutput === this.outputted) {
      return;
    }
    Logger.logger.time('write');
    this.outputted = nextOutput;
    await writeFile(
      path.join(process.cwd(), this.config.output.outputPath),
      nextOutput,
      { encoding: 'utf-8' }
    );
    Logger.logger.timeEnd('write');
  }

  async watch() {
    const watcher = chokidar
      .watch(this.globs, {
        ignored: /(^|[\/\\])\../, // ignore dotfiles
        persistent: true,
        ignoreInitial: true,
      })
      .on('add', (path) => this.addSourceFile(path))
      .on('change', async (path) => {
        const start = Date.now();
        const file = this.fileCache.get(path);

        await file?.refresh();

        await this.save();
        const time = Date.now() - start;
        console.log(
          `Change from ${green(
            path.split('/').pop() ?? ''
          )} regenerated in ${blueBright(`${time} ms`)}`
        );
      })
      .on('unlink', async (path) => {
        console.log('file deleted ', path);
        this.removeSourceFile(path);
        await this.save();
      });

    const schemaWatcher = chokidar
      .watch(path.join(process.cwd(), this.config.schema.path), {
        ignored: /(^|[\/\\])\../, // ignore dotfiles
        persistent: true,
        ignoreInitial: true,
      })
      .on('change', async (path) => {
        console.log(
          `Schema DSL changed`
        );
        await this.schema.load();
        await this.save();
      })
  }

  removeSourceFile(path: string) {
    this.fileCache.delete(path);
  }

  addSourceFile(path: string) {
    const source = new SourceFile(path, this.documentManager);
    this.fileCache.set(path, source);

    return source;
  }
}
