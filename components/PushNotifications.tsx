"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

const VAPID_PUBLIC_KEY =
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "";

function urlBase64ToUint8Array(
  base64String: string
) {
  const padding = "=".repeat(
    (4 - (base64String.length % 4)) % 4
  );

  const base64 = (
    base64String + padding
  )
    .replace(/-/g, "+")
    .replace(/_/g, "/");

  const rawData = window.atob(base64);

  return Uint8Array.from(
    [...rawData].map((char) =>
      char.charCodeAt(0)
    )
  );
}

function isIOS() {
  return (
    /iPhone|iPad|iPod/i.test(
      navigator.userAgent
    ) ||
    (navigator.platform === "MacIntel" &&
      navigator.maxTouchPoints > 1)
  );
}

function isStandalone() {
  return (
    window.matchMedia(
      "(display-mode: standalone)"
    ).matches ||
    (
      window.navigator as Navigator & {
        standalone?: boolean;
      }
    ).standalone === true
  );
}

export default function PushNotifications() {
  const [
    showNotificationPrompt,
    setShowNotificationPrompt,
  ] = useState(false);

  const [loading, setLoading] =
    useState(false);

  const saveSubscription = async (
    subscription: PushSubscription
  ) => {
    try {
      const guestId =
        localStorage.getItem(
          "bodafake_guest_id"
        );

      if (!guestId) {
        return false;
      }

      const json = subscription.toJSON();

      const endpoint =
        subscription.endpoint;

      const p256dh =
        json.keys?.p256dh;

      const auth =
        json.keys?.auth;

      if (!endpoint || !p256dh || !auth) {
        return false;
      }

      const response = await fetch(
        "/api/push/subscribe",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            guestId,
            endpoint,
            p256dh,
            auth,
          }),
        }
      );

      const result =
        await response.json();

      if (!response.ok) {
        console.error(
          "Error guardando suscripción:",
          result
        );

        return false;
      }

      localStorage.setItem(
        "bodafake_notifications_enabled",
        "true"
      );

      return true;
    } catch (error) {
      console.error(
        "Error guardando suscripción:",
        error
      );

      return false;
    }
  };

  const createSubscription = async () => {
    if (!VAPID_PUBLIC_KEY) {
      console.error(
        "Falta configurar la clave pública VAPID."
      );
      return;
    }

    try {
      setLoading(true);

      const permission =
        await Notification.requestPermission();

      if (permission !== "granted") {
        return;
      }

      const registration =
        await navigator.serviceWorker.ready;

      let subscription =
        await registration.pushManager.getSubscription();

      if (!subscription) {
        subscription =
          await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey:
              urlBase64ToUint8Array(
                VAPID_PUBLIC_KEY
              ),
          });
      }

      const saved =
        await saveSubscription(
          subscription
        );

      if (saved) {
        setShowNotificationPrompt(false);
      }
    } catch (error) {
      console.error(
        "Error activando notificaciones:",
        error
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const initialize = async () => {
      if (
        typeof window === "undefined" ||
        !("serviceWorker" in navigator) ||
        !("PushManager" in window) ||
        !("Notification" in window)
      ) {
        return;
      }

      const ios = isIOS();
      const standalone = isStandalone();

      /*
       * El registro de iPhone ya se maneja
       * desde /setup antes de llegar aquí.
       *
       * Si el usuario ya está dentro de la
       * versión instalada, solamente mostramos
       * la solicitud de notificaciones.
       */
      if (ios && !standalone) {
        return;
      }

      if (
        Notification.permission ===
        "default"
      ) {
        setShowNotificationPrompt(true);
        return;
      }

      if (
        Notification.permission ===
        "granted"
      ) {
        const registration =
          await navigator.serviceWorker.ready;

        let subscription =
          await registration.pushManager.getSubscription();

        if (!subscription) {
          await createSubscription();
        } else {
          await saveSubscription(
            subscription
          );
        }
      }
    };

    initialize();
  }, []);

  if (!showNotificationPrompt) {
    return null;
  }

  return (
    <div className="push-modal-backdrop">
      <div className="push-modal">
        <p className="push-modal-eyebrow">
          BODАFAKE
        </p>

        <h2>
          No te pierdas ningún momento
        </h2>

        <p>
          Te avisaremos cuando llegue un
          nuevo momento de la boda para que
          puedas capturarlo.
        </p>

        <button
          type="button"
          className="push-primary-button"
          onClick={createSubscription}
          disabled={loading}
        >
          {loading
            ? "Activando..."
            : "Activar notificaciones"}
        </button>

        <button
          type="button"
          className="push-secondary-button"
          onClick={() =>
            setShowNotificationPrompt(false)
          }
        >
          Ahora no
        </button>
      </div>
    </div>
  );
}