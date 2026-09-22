"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import PushNotifications from "@/components/PushNotifications";

type RealPhoto = {
  id: string;
  name: string;
  time: string;
  image: string;
};

const EVENT_SLUG = "bodafake";

function formatRelativeTime(dateString: string) {
  const date = new Date(dateString);
  const now = new Date();

  const seconds = Math.floor(
    (now.getTime() - date.getTime()) / 1000
  );

  if (seconds < 60) {
    return "ahora mismo";
  }

  const minutes = Math.floor(seconds / 60);

  if (minutes < 60) {
    return `hace ${minutes} ${
      minutes === 1 ? "minuto" : "minutos"
    }`;
  }

  const hours = Math.floor(minutes / 60);

  if (hours < 24) {
    return `hace ${hours} ${
      hours === 1 ? "hora" : "horas"
    }`;
  }

  const days = Math.floor(hours / 24);

  return `hace ${days} ${
    days === 1 ? "día" : "días"
  }`;
}

export default function Home() {
  const [realPhotos, setRealPhotos] =
    useState<RealPhoto[]>([]);

  const [selectedPhoto, setSelectedPhoto] =
    useState<RealPhoto | null>(null);

  const [checkingGuest, setCheckingGuest] =
    useState(true);

  const [menuOpen, setMenuOpen] =
    useState(false);

  // Revisar si el invitado ya está registrado
  useEffect(() => {
    const guestName = localStorage.getItem(
      "bodafake_guest_name"
    );

    if (!guestName) {
      window.location.replace("/setup");
      return;
    }

    setCheckingGuest(false);
  }, []);

  // Cargar fotos y escuchar nuevas publicaciones
  useEffect(() => {
    if (checkingGuest) return;

    let mounted = true;

    const loadRealPhotos = async () => {
      try {
        const {
          data: events,
          error: eventError,
        } = await supabase
          .from("events")
          .select("id")
          .eq("slug", EVENT_SLUG)
          .limit(1);

        if (eventError) {
          console.error(
            "Error buscando evento:",
            eventError
          );
          return;
        }

        const event = events?.[0];

        if (!event) {
          console.error(
            "No existe el evento Ibiza Night."
          );
          return;
        }

        const { data, error } = await supabase
          .from("photos")
          .select(`
            id,
            image_url,
            created_at,
            guests (
              name
            )
          `)
          .eq("event_id", event.id)
          .eq("is_visible", true)
          .order("created_at", {
            ascending: false,
          });

        if (error) {
          console.error(
            "Error cargando fotos:",
            error
          );
          return;
        }

        if (!mounted) return;

        const formattedPhotos: RealPhoto[] =
          (data || []).map((item) => {
            const guest = Array.isArray(item.guests)
              ? item.guests[0]
              : item.guests;

            return {
              id: item.id,
              name: guest?.name || "Invitado",
              time: formatRelativeTime(
                item.created_at
              ),
              image: item.image_url,
            };
          });

        setRealPhotos(formattedPhotos);
      } catch (error) {
        console.error(
          "Error del mural:",
          error
        );
      }
    };

    loadRealPhotos();

    const channel = supabase
      .channel("ibiza-night-photo-wall")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "photos",
        },
        () => {
          loadRealPhotos();
        }
      )
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
  }, [checkingGuest]);

  if (checkingGuest) {
    return (
      <main className="setup-loading">
        <span>IBIZA NIGHT</span>
      </main>
    );
  }

  return (
    <main className="app-shell ibiza-night-page">
      <PushNotifications />

      {/* FONDO IBIZA NIGHT */}
      <div
        className="ibiza-background"
        aria-hidden="true"
      >
        <div className="ibiza-gradient" />

        <div className="ibiza-sunset" />

        <div className="ibiza-window">
          <div className="ibiza-window-frame">
            <div className="ibiza-window-view">
              <div className="ibiza-horizon" />
              <div className="ibiza-sun" />
              <div className="ibiza-sea" />
            </div>
          </div>
        </div>

        <div className="ibiza-grain" />
      </div>

      <header className="topbar ibiza-topbar">
        <div className="ibiza-brand">
          <span className="ibiza-brand-main">
            Ibiza
          </span>

          <span className="ibiza-brand-night">
            Night
          </span>
        </div>

        {/* MENÚ */}
        <button
          type="button"
          className="ibiza-menu-button"
          aria-label="Abrir menú"
          aria-expanded={menuOpen}
          onClick={() =>
            setMenuOpen((previous) => !previous)
          }
        >
          <span />
          <span />
          <span />
        </button>
      </header>

      {/* MENÚ DE NAVEGACIÓN */}
      {menuOpen && (
        <div
          className="ibiza-menu-overlay"
          onClick={() => setMenuOpen(false)}
        >
          <div
            className="ibiza-menu"
            onClick={(event) =>
              event.stopPropagation()
            }
          >
            <button
              type="button"
              className="ibiza-menu-close"
              aria-label="Cerrar menú"
              onClick={() =>
                setMenuOpen(false)
              }
            >
              ×
            </button>

            <button
              type="button"
              className="ibiza-menu-option"
              onClick={() => {
                window.location.href =
                  "/project";
              }}
            >
              <span>Proyectar</span>
              <span className="ibiza-menu-arrow">
                →
              </span>
            </button>
          </div>
        </div>
      )}

      <section className="event-heading ibiza-heading">
        <p className="eyebrow">
          NUESTRO BEREAL DE
        </p>

        <h1>
          Ibiza
          <br />
          Night.
        </h1>

        <p className="heading-description">
          Tu vuelo acaba de despegar.
          <br />
          Captura cada momento del viaje.
        </p>

        <h2 className="photo-prompt">
          Guarda tu mejor
          <br />
          momento
        </h2>
      </section>

      <section
        className="photo-wall ibiza-photo-wall"
        aria-label="Mural de fotos de Ibiza Night"
      >
        {realPhotos.map((photo) => (
          <article
            className="polaroid ibiza-photo-card"
            key={`real-${photo.id}`}
            role="button"
            tabIndex={0}
            onClick={() =>
              setSelectedPhoto(photo)
            }
            onKeyDown={(event) => {
              if (
                event.key === "Enter" ||
                event.key === " "
              ) {
                event.preventDefault();
                setSelectedPhoto(photo);
              }
            }}
            aria-label={`Abrir foto de ${photo.name}`}
          >
            <div className="photo-frame">
              <img
                src={photo.image}
                alt={`Foto compartida por ${photo.name}`}
                loading="lazy"
              />
            </div>

            <div className="polaroid-info">
              <p className="photo-name">
                {photo.name}
              </p>

              <p className="photo-time">
                IBIZA NIGHT · {photo.time}
              </p>
            </div>
          </article>
        ))}
      </section>

      <button
        className="capture-button ibiza-capture-button"
        type="button"
        onClick={() => {
          window.location.href = "/camera";
        }}
      >
        <span
          className="capture-icon"
          aria-hidden="true"
        >
          <span />
        </span>

        <span>Captura el momento</span>
      </button>

      {selectedPhoto && (
        <div
          className="photo-lightbox ibiza-lightbox"
          role="dialog"
          aria-modal="true"
          aria-label={`Foto de ${selectedPhoto.name}`}
          onClick={() =>
            setSelectedPhoto(null)
          }
        >
          <button
            type="button"
            className="photo-lightbox-close"
            aria-label="Cerrar foto"
            onClick={() =>
              setSelectedPhoto(null)
            }
          >
            ×
          </button>

          <div
            className="photo-lightbox-content"
            onClick={(event) =>
              event.stopPropagation()
            }
          >
            <img
              src={selectedPhoto.image}
              alt={`Foto compartida por ${selectedPhoto.name}`}
            />

            <div className="photo-lightbox-info">
              <strong>
                {selectedPhoto.name}
              </strong>

              <span>
                IBIZA NIGHT ·{" "}
                {selectedPhoto.time}
              </span>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}