"use client";

import { useEffect } from "react";

export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (
      typeof window !== "undefined" &&
      "serviceWorker" in navigator
    ) {
      navigator.serviceWorker
        .register("/sw.js")
        .then((registration) => {
          console.log(
            "BodaFake Service Worker registrado:",
            registration.scope
          );
        })
        .catch((error) => {
          console.error(
            "Error registrando Service Worker:",
            error
          );
        });
    }
  }, []);

  return null;
}