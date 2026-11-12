// Small handler modules for tests, built from WAT with wat2wasm (not a test file).
export const good = Uint8Array.from(atob('AGFzbQEAAAABDAJgAX8Bf2ACf38BfwIPAQNlbnYGbWVtb3J5AgABAwMCAAEGBwF/AUGACAsHDwIFYWxsb2MAAANydW4AAQpxAhQBAX8jACEBIwAgAEEIamokACABC1oBA38gAUEEahAAIQIgAiABNgIAAkADQCADIAFPDQEgACADai0AACEEIARB4QBPIARB+gBNcQRAIARBIGshBAsgAkEEaiADaiAEOgAAIANBAWohAwwACwsgAgs='), (c) => c.charCodeAt(0));
export const loop = Uint8Array.from(atob('AGFzbQEAAAABDAJgAX8Bf2ACf38BfwIPAQNlbnYGbWVtb3J5AgABAwMCAAEHDwIFYWxsb2MAAANydW4AAQoRAgUAQYAICwkAA0AMAAtBAAs='), (c) => c.charCodeAt(0));
export const greedy = Uint8Array.from(atob('AGFzbQEAAAABDAJgAX8Bf2ACf38BfwIPAQNlbnYGbWVtb3J5AgABAwMCAAEHDwIFYWxsb2MAAANydW4AAQoeAgUAQYAICxYAQeDUA0AAGkHw////B0EBNgIAQQAL'), (c) => c.charCodeAt(0));
export const sneaky = Uint8Array.from(atob('AGFzbQEAAAABDAJgAX8Bf2ACf38BfwIbAgNlbnYGbWVtb3J5AgABA2VudgVmZXRjaAAAAwMCAAEHDwIFYWxsb2MAAQNydW4AAgoRAgUAQYAICwkAQQAQABpBAAs='), (c) => c.charCodeAt(0));
export const liar = Uint8Array.from(atob('AGFzbQEAAAABDAJgAX8Bf2ACf38BfwIPAQNlbnYGbWVtb3J5AgABAwMCAAEHDwIFYWxsb2MAAANydW4AAQoZAgUAQYAICxEAQcAAQf////8HNgIAQcAACw=='), (c) => c.charCodeAt(0));
