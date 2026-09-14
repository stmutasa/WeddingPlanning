/** Thrown by every Phase A service stub. Phase B replaces the throw with real logic. */
export class NotImplemented extends Error {
  constructor(name: string) {
    super(`${name} is not implemented until Phase B`);
    this.name = "NotImplemented";
  }
}
