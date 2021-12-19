export class TokenCollector {
  private usedTokens: string[] = []
  public usedQueueTokens: string[] = []

  found(token: string) {
    if (
      !this.usedTokens.includes(token) &&
      !this.usedQueueTokens.includes(token)
    ) {
      this.usedQueueTokens.push(token)
    }
  }

  hasMoreTokens() {
    return this.usedQueueTokens.length > 0
  }

  reset() {
    this.usedQueueTokens = [];
    this.usedTokens = [];
  }

  consume() {
    const next = this.usedQueueTokens.pop()

    if (!next) throw new Error('queue empty')

    this.usedTokens.push(next)

    return next
  }
}
