// Hermes microtask fix - must run before any other code
if (global.HermesInternal && global.HermesInternal.enableMicrotasks) {
  global.HermesInternal.enableMicrotasks();
}
require('expo-router/entry');
