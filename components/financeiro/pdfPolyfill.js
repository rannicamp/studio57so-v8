"use client";

// Polyfill que roda imediatamente ao ser importado
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
    
    // Tenta aplicar no Promise global
    try {
        Object.defineProperty(Promise, "withResolvers", {
          value: withResolvers,
          writable: true,
          configurable: true,
        });
    } catch (e) {
        // Fallback caso defineProperty falhe (muito raro)
        Promise.withResolvers = withResolvers;
    }
    
    // Garante no window também
    if (typeof window !== "undefined" && !window.Promise.withResolvers) {
      window.Promise.withResolvers = withResolvers;
    }
  }
})();