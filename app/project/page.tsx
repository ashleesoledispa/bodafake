"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type ProjectPhoto = {
  id: string;
  name: string;
  createdAt: string;
  time: string;
  image: string;
};

const EVENT_SLUG = "bodafake";

const DISPLAY_TIME = 30 * 1000;

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

export default function ProjectPage() {
  const [photos, setPhotos] =
    useState<ProjectPhoto[]>([]);

  const [currentIndex, setCurrentIndex] =
    useState(0);

  const [loading, setLoading] =
    useState(true);

  const loadPhotos = async () => {
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

      const {
        data,
        error,
      } = await supabase
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

      const formattedPhotos: ProjectPhoto[] =
        (data || []).map((item) => {
          const guest = Array.isArray(item.guests)
            ? item.guests[0]
            : item.guests;

          return {
            id: item.id,
            name:
              guest?.name || "Invitado",
            createdAt: item.created_at,
            time: formatRelativeTime(
              item.created_at
            ),
            image: item.image_url,
          };
        });

      setPhotos((previousPhotos) => {
        /*
         * Si ya tenemos fotos y entraron nuevas,
         * intentamos conservar la foto que estaba
         * actualmente en pantalla.
         */
        if (previousPhotos.length > 0) {
          const currentPhoto =
            previousPhotos[currentIndex];

          if (currentPhoto) {
            const newIndex =
              formattedPhotos.findIndex(
                (photo) =>
                  photo.id === currentPhoto.id
              );

            if (newIndex !== -1) {
              setCurrentIndex(newIndex);
            }
          }
        }

        return formattedPhotos;
      });
    } catch (error) {
      console.error(
        "Error del modo proyección:",
        error
      );
    } finally {
      setLoading(false);
    }
  };

  /*
   * Cargar fotos inicialmente
   */
  useEffect(() => {
    loadPhotos();
  }, []);

  /*
   * Escuchar nuevas fotos en tiempo real
   */
  useEffect(() => {
    const channel = supabase
      .channel("ibiza-night-projector")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "photos",
        },
        () => {
          loadPhotos();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  /*
   * Cambiar automáticamente de foto
   * cada 3 minutos.
   */
  useEffect(() => {
    if (photos.length <= 1) {
      return;
    }

    const interval = window.setInterval(() => {
      setCurrentIndex((previousIndex) => {
        return (
          (previousIndex + 1) %
          photos.length
        );
      });
    }, DISPLAY_TIME);

    return () => {
      window.clearInterval(interval);
    };
  }, [photos.length]);

  /*
   * Evitar que el índice quede fuera
   * cuando cambie la cantidad de fotos.
   */
  useEffect(() => {
    if (currentIndex >= photos.length) {
      setCurrentIndex(0);
    }
  }, [photos.length, currentIndex]);

  const currentPhoto =
    photos[currentIndex];

  if (loading) {
    return (
      <main className="project-page project-loading">
        <span>IBIZA NIGHT</span>
      </main>
    );
  }

  return (
    <main className="project-page">
      <div
        className="project-background"
        aria-hidden="true"
      >
        <div className="project-gradient" />
        <div className="project-glow" />
        <div className="project-grain" />
      </div>

      {/* HEADER */}
      <header className="project-header">
        <button
          type="button"
          className="project-back-button"
          onClick={() => {
            window.location.href = "/";
          }}
        >
          <span>←</span>
          <span>Volver</span>
        </button>

        <div className="project-brand">
          <span>Ibiza</span>
          <strong>Night</strong>
        </div>

        <div className="project-live">
          <span className="project-live-dot" />
          <span>LIVE</span>
        </div>
      </header>

      {/* CONTENIDO */}
      <section className="project-content">
        {!currentPhoto ? (
          <div className="project-empty">
            <p className="project-empty-eyebrow">
              IBIZA NIGHT
            </p>

            <h1>
              El viaje
              <br />
              comienza aquí.
            </h1>

            <p>
              Las fotos que compartan los
              invitados aparecerán aquí.
            </p>
          </div>
        ) : (
          <article
            className="project-polaroid"
            key={currentPhoto.id}
          >
            <div className="project-photo-frame">
  <img
    src={currentPhoto.image}
    alt={`Foto compartida por ${currentPhoto.name}`}
    className="project-photo-image"
  />
</div>

            <div className="project-photo-info">
              <div>
                <p className="project-photo-name">
                  {currentPhoto.name}
                </p>

                <p className="project-photo-time">
                  IBIZA NIGHT ·{" "}
                  {currentPhoto.time}
                </p>
              </div>

              <div className="project-photo-number">
                {currentIndex + 1}
                <span>
                  /
                  {photos.length}
                </span>
              </div>
            </div>
          </article>
        )}
      </section>

      {/* INDICADOR */}
      {photos.length > 1 && (
        <div className="project-progress">
          {photos.map((photo, index) => (
            <span
              key={photo.id}
              className={
                index === currentIndex
                  ? "active"
                  : ""
              }
            />
          ))}
        </div>
      )}
    </main>
  );
}