"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

const EVENT_SLUG = "bodafake";

const MOMENTS = [
  "22:00",
  "22:30",
  "23:00",
  "23:30",
  "00:00",
  "00:30",
  "01:00",
  "01:30",
  "02:00",
  "02:30",
  "03:00",
];

type DeviceType = "iphone" | "android" | "other";

export default function SetupPage() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const savedName = localStorage.getItem("bodafake_guest_name");

    if (savedName) {
      router.replace("/");
      return;
    }

    const userAgent = navigator.userAgent;

    const iphone =
      /iPhone|iPad|iPod/i.test(userAgent) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true;

    setIsIOS(iphone);
    setIsStandalone(standalone);
  }, [router]);

  const detectDevice = (): DeviceType => {
    const userAgent = navigator.userAgent.toLowerCase();

    if (/iphone|ipad|ipod/.test(userAgent)) {
      return "iphone";
    }

    if (/android/.test(userAgent)) {
      return "android";
    }

    return "other";
  };

  const registerGuest = async () => {
    const cleanName = name.trim();

    if (!cleanName || loading) return;

    setLoading(true);
    setError("");

    try {
      // Buscar la boda
      const { data: events, error: eventError } = await supabase
        .from("events")
        .select("id")
        .eq("slug", EVENT_SLUG)
        .limit(1);

      if (eventError) {
        console.error("EVENT ERROR:", eventError);

        throw new Error(
          `Error buscando la boda: ${eventError.message}`
        );
      }

      const event = events?.[0];

      if (!event) {
        throw new Error(
          "El evento BodaFake no existe en Supabase."
        );
      }

      // Detectar dispositivo
      const deviceType = detectDevice();

      // Hora exacta de registro
      const registeredAt = new Date().toISOString();

      // Crear invitado
      const { data: guest, error: guestError } = await supabase
        .from("guests")
        .insert({
          event_id: event.id,
          name: cleanName,
          registered_at: registeredAt,
          device_type: deviceType,
        })
        .select("id, name, registered_at, device_type")
        .single();

      if (guestError) {
        console.error("GUEST INSERT ERROR:", guestError);

        throw new Error(
          `Error registrando invitado: ${guestError.message}`
        );
      }

      if (!guest) {
        throw new Error(
          "Supabase no devolvió el invitado creado."
        );
      }

      // Guardar identidad del invitado en el dispositivo
      localStorage.setItem("bodafake_guest_id", guest.id);
      localStorage.setItem("bodafake_guest_name", guest.name);
      localStorage.setItem(
        "bodafake_registered_at",
        guest.registered_at
      );
      localStorage.setItem(
        "bodafake_device",
        deviceType
      );
      localStorage.setItem(
        "bodafake_notification_moments",
        JSON.stringify(MOMENTS)
      );

      // iPhone necesita primero instalar la web
      if (deviceType === "iphone" && !isStandalone) {
        setStep(2);
        setLoading(false);
        return;
      }

      await enableNotifications();
    } catch (err) {
      console.error("BODAFAKE SETUP ERROR:", err);

      setError(
        err instanceof Error
          ? err.message
          : "Ocurrió un error inesperado."
      );

      setLoading(false);
    }
  };

  const enableNotifications = async () => {
    try {
      if ("Notification" in window) {
        await Notification.requestPermission();
      }
    } catch (err) {
      console.error("NOTIFICATION ERROR:", err);
    }

    router.push("/camera");
  };

  return (
    <main className="setup-page">
      <div className="setup-card">
        {step === 1 && (
          <>
            <p className="setup-eyebrow">
              BIENVENIDO A BODAFAKE
            </p>

            <h1>
              Primero, dinos
              <br />
              quién eres.
            </h1>

            <p className="setup-description">
              Tu nombre aparecerá junto a las fotos que compartas
              durante la boda.
            </p>

            <div className="setup-form">
              <label htmlFor="guest-name">
                Tu nombre
              </label>

              <input
                id="guest-name"
                type="text"
                placeholder="Escribe tu nombre"
                value={name}
                onChange={(event) =>
                  setName(event.target.value)
                }
                autoComplete="name"
                autoCapitalize="words"
                autoFocus
                disabled={loading}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    registerGuest();
                  }
                }}
              />

              {error && (
                <p className="setup-error">
                  {error}
                </p>
              )}

              <button
                type="button"
                className="setup-button"
                onClick={registerGuest}
                disabled={!name.trim() || loading}
              >
                {loading
                  ? "Entrando..."
                  : "Entrar a la boda"}
              </button>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <p className="setup-eyebrow">
              UN ÚLTIMO PASO
            </p>

            <h1>
              Agrega BodaFake
              <br />
              a tu inicio.
            </h1>

            <p className="setup-description">
              En iPhone necesitamos que BodaFake esté en tu
              pantalla de inicio para poder enviarte los
              momentos de la boda.
            </p>

            <div className="ios-instructions">
              <div className="ios-step">
                <span>01</span>
                <p>
                  Toca el botón{" "}
                  <strong>Compartir</strong> de Safari.
                </p>
              </div>

              <div className="ios-step">
                <span>02</span>
                <p>
                  Selecciona{" "}
                  <strong>
                    “Añadir a pantalla de inicio”
                  </strong>
                  .
                </p>
              </div>

              <div className="ios-step">
                <span>03</span>
                <p>
                  Abre <strong>BodaFake</strong> desde tu
                  pantalla de inicio.
                </p>
              </div>

              <div className="ios-step">
                <span>04</span>
                <p>
                  Permite las{" "}
                  <strong>notificaciones</strong>.
                </p>
              </div>
            </div>

            <button
              type="button"
              className="setup-button"
              onClick={enableNotifications}
            >
              Ya lo hice
            </button>

            <button
              type="button"
              className="setup-skip"
              onClick={() => router.push("/camera")}
            >
              Continuar sin activar ahora
            </button>
          </>
        )}
      </div>
    </main>
  );
}