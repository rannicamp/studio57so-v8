"use client";

// Polyfill robusto para Promise.withResolvers
// Necessário para pdfjs-dist v4+ rodar em ambientes Next.js/Browser mais antigos
(function() {
  if (typeof Promise.withResolvers === "undefined") {
    const withResolvers = function () {
      let resolve, reject;
      const promise = new Promise((res, rej) => {
        resolve = res;
        reject = rej;
      });
      return { promise, resolve, reject };
    };
    
    // Aplica diretamente no objeto Promise global
    Object.defineProperty(Promise, "withResolvers", {
      value: withResolvers,
      writable: true,
      configurable: true,
    });
    
    // Garante no window/globalThis também por segurança
    if (typeof window !== "undefined") {
      window.Promise.withResolvers = withResolvers;
    }
    if (typeof globalThis !== "undefined") {
      globalThis.Promise.withResolvers = withResolvers;
    }
  }
})();