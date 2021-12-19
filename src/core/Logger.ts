export class Logger {
  static logger = new Logger();

  private debugMode = false;

  setDebug(enabled: boolean) {
    this.debugMode = enabled;
  }

  time(label: string) {
    if (this.debugMode) {
      console.time(label);
    }
  }

  timeEnd(label: string) {
    if (this.debugMode) {
      console.timeEnd(label);
    }
  }
}
