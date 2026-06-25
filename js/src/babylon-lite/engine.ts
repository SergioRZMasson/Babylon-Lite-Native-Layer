// Engine factory (mirrors src/engine). Single native engine/window in this prototype.

export function createEngine(_canvas?: any, _options?: any): Promise<any> {
    return Promise.resolve({ _id: 0, _kind: "engine" });
}
