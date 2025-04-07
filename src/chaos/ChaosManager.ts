export class ChaosManager {
  private static _instance: ChaosManager;

  public static getInstance() {
    if (!this._instance) this._instance = new ChaosManager();

    return this._instance;
  }

  private constructor() {}

  private endpointChaos: Record<string, { chaos: boolean, method?: string }> = {};

  public hasChaos(endpoint: string, method?: string) {
    if (!this.endpointChaos[endpoint]) return false;

    const { chaos, method: methodToMatch } = this.endpointChaos[endpoint];

    if (!chaos) return false;

    if (!methodToMatch) return true;

    return method === methodToMatch;
  }

  public setChaos(endpoint: string, chaos: boolean, method?: string) {
    this.endpointChaos[endpoint] = { chaos, method };
  }
}
