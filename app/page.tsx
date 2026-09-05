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
  const [realPhotos, setRealPhotos] = useState<RealPhoto[]>([]);
  const [selectedPhoto, setSelectedPhoto] =
    useState<RealPhoto | null>(null);
  const [checkingGuest, setCheckingGuest] = useState(true);

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

  useEffect(() => {
    if (checkingGuest) return;

    let mounted = true;

    const loadRealPhotos = async () => {
      try {
        const { data: events, error: eventError } =
          await supabase
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
            "No existe el evento BodaFake."
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
              time: formatRelativeTime(item.created_at),
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
      .channel("bodafake-photo-wall")
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
        <span>BODАFAKE</span>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <PushNotifications />

      <video
        className="background-video"
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
        aria-hidden="true"
      >
        <source
          src="/background.MP4"
          type="video/mp4"
        />
      </video>

      <div
        className="background-overlay"
        aria-hidden="true"
      />

      <header className="topbar">
        <div className="brand-lockup">
          <img
            className="bodafake-logo"
            src="/bodafake-logo.png"
            alt="BodaFake"
          />

          <span className="brand-by">by</span>

          <img
            className="vertigo-logo"
            src="/vertigo-logo.png"
            alt="Vértigo"
          />
        </div>

      </header>

      <section className="event-heading">
        <p className="eyebrow">
          HASTA QUE LA FIESTA NOS SEPARE
        </p>

        <h1>
          Nuestro propio BeReal⚠️
          <br />
          de la BodaFake.
        </h1>

        <h2 className="photo-prompt">
          Comparte tu mejor foto o tu mejor borrachera
        </h2>
      </section>

      <section
        className="photo-wall"
        aria-label="Mural de fotos"
      >
        {realPhotos.map((photo) => (
          <article
            className="polaroid"
            key={`real-${photo.id}`}
            role="button"
            tabIndex={0}
            onClick={() => setSelectedPhoto(photo)}
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
                {photo.time}
              </p>
            </div>
          </article>
        ))}
      </section>

      <button
        className="capture-button"
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

        <span>Capturar momento</span>
      </button>

      {selectedPhoto && (
        <div
          className="photo-lightbox"
          role="dialog"
          aria-modal="true"
          aria-label={`Foto de ${selectedPhoto.name}`}
          onClick={() => setSelectedPhoto(null)}
        >
          <button
            type="button"
            className="photo-lightbox-close"
            aria-label="Cerrar foto"
            onClick={() => setSelectedPhoto(null)}
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
                {selectedPhoto.time}
              </span>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}