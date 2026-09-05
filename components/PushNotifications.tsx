"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

const VAPID_PUBLIC_KEY =
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "";

function urlBase64ToUint8Array(base64String: string) {
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
  const [showIOSInstall, setShowIOSInstall] =
    useState(false);

  const [
    showNotificationPrompt,
    setShowNotificationPrompt,
  ] = useState(false);

  const [notificationsReady, setNotificationsReady] =
    useState(false);

  const [loading, setLoading] =
    useState(false);

  const [testing, setTesting] =
    useState(false);

  const [message, setMessage] =
    useState("");

    const saveSubscription = async (
  subscription: PushSubscription
) => {
  try {
    const guestId =
      localStorage.getItem(
        "bodafake_guest_id"
      );

    if (!guestId) {
      setMessage(
        "No encontramos tu registro de invitado."
      );
      return false;
    }

    const json =
      subscription.toJSON();

    const endpoint =
      subscription.endpoint;

    const p256dh =
      json.keys?.p256dh;

    const auth =
      json.keys?.auth;

    if (
      !endpoint ||
      !p256dh ||
      !auth
    ) {
      setMessage(
        "No pudimos completar la suscripción."
      );
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

      setMessage(
        result?.error ||
          "No pudimos guardar las notificaciones."
      );

      return false;
    }

    localStorage.setItem(
      "bodafake_notifications_enabled",
      "true"
    );

    setNotificationsReady(true);

    return true;
  } catch (error) {
    console.error(
      "Error guardando suscripción:",
      error
    );

    setMessage(
      "No pudimos activar las notificaciones."
    );

    return false;
  }
};

  const createSubscription = async () => {
    if (!VAPID_PUBLIC_KEY) {
      setMessage(
        "Falta configurar la clave pública VAPID."
      );
      return;
    }

    try {
      setLoading(true);
      setMessage("");

      const permission =
        await Notification.requestPermission();

      if (permission !== "granted") {
        setMessage(
          "Las notificaciones no fueron activadas."
        );
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
        setMessage(
          "Notificaciones activadas."
        );
      }
    } catch (error) {
      console.error(
        "Error activando notificaciones:",
        error
      );

      setMessage(
        "No pudimos activar las notificaciones."
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

      if (ios && !standalone) {
        const dismissed =
          localStorage.getItem(
            "bodafake_ios_install_seen"
          );

        if (!dismissed) {
          setShowIOSInstall(true);
        }

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

        setNotificationsReady(true);
      }
    };

    initialize();
  }, []);

  const testNotification = async () => {
    try {
      setTesting(true);
      setMessage("");

      const guestId =
        localStorage.getItem(
          "bodafake_guest_id"
        );

      if (!guestId) {
        setMessage(
          "No encontramos tu invitado."
        );
        return;
      }

      const response =
        await fetch("/api/push/test", {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            guestId,
          }),
        });

      const data =
        await response.json();

      if (!response.ok) {
        console.error(
  "Error de prueba:",
  JSON.stringify(data, null, 2)
);
        setMessage(
          data?.error ||
            "No se pudo enviar la prueba."
        );

        return;
      }

      setMessage(
        "Notificación de prueba enviada."
      );
    } catch (error) {
      console.error(
        "Error probando notificación:",
        error
      );

      setMessage(
        "No se pudo enviar la notificación."
      );
    } finally {
      setTesting(false);
    }
  };

  const closeIOSInstall = () => {
    localStorage.setItem(
      "bodafake_ios_install_seen",
      "true"
    );

    setShowIOSInstall(false);
  };

  if (showIOSInstall) {
    return (
      <div className="push-modal-backdrop">
        <div className="push-modal">
          <p className="push-modal-eyebrow">
            BODАFAKE
          </p>

          <h2>
            Activa los avisos de la boda
          </h2>

          <p>
            Para recibir los momentos en tu
            iPhone, primero agrega BodaFake a tu
            pantalla de inicio.
          </p>

          <div className="push-steps">
            <div>
              <strong>1</strong>
              <span>
                Abre el menú de compartir de
                Safari.
              </span>
            </div>

            <div>
              <strong>2</strong>
              <span>
                Toca “Agregar a pantalla de
                inicio”.
              </span>
            </div>

            <div>
              <strong>3</strong>
              <span>
                Abre BodaFake desde el nuevo
                ícono.
              </span>
            </div>

            <div>
              <strong>4</strong>
              <span>
                Ahí podrás activar las
                notificaciones.
              </span>
            </div>
          </div>

          <button
            type="button"
            className="push-primary-button"
            onClick={closeIOSInstall}
          >
            Entendido
          </button>
        </div>
      </div>
    );
  }

  if (showNotificationPrompt) {
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
            Te avisaremos cuando llegue un nuevo
            momento de la boda para que puedas
            capturarlo.
          </p>

          <button
            type="button"
            className="push-primary-button"
            onClick={
              createSubscription
            }
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
              setShowNotificationPrompt(
                false
              )
            }
          >
            Ahora no
          </button>
        </div>
      </div>
    );
  }

  if (notificationsReady) {
    return (
      <div className="push-status">
        <button
          type="button"
          onClick={
            testNotification
          }
          disabled={testing}
        >
          {testing
            ? "Enviando..."
            : "Probar notificación"}
        </button>

        {message && (
          <span>{message}</span>
        )}
      </div>
    );
  }

  return null;
}