"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

const EVENT_SLUG = "bodafake";

export default function CameraPage() {
  const router = useRouter();

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [stream, setStream] = useState<MediaStream | null>(null);
  const [facingMode, setFacingMode] = useState<"user" | "environment">(
    "environment"
  );

  const [photo, setPhoto] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState("");
  const [name, setName] = useState("");
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    const savedName = localStorage.getItem("bodafake_guest_name");

    if (!savedName) {
      router.replace("/setup");
      return;
    }

    setName(savedName);
  }, [router]);

  useEffect(() => {
    let cancelled = false;

    const startCamera = async () => {
      try {
        setCameraError("");

        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error("La cámara no está disponible.");
        }

        if (stream) {
          stream.getTracks().forEach((track) => track.stop());
        }

        const newStream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode,
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
          audio: false,
        });

        if (cancelled) {
          newStream.getTracks().forEach((track) => track.stop());
          return;
        }

        setStream(newStream);

        if (videoRef.current) {
          videoRef.current.srcObject = newStream;
        }
      } catch (error) {
        console.error("CAMERA ERROR:", error);

        setCameraError(
          "No pudimos acceder a tu cámara. Revisa los permisos del navegador."
        );
      }
    };

    startCamera();

    return () => {
      cancelled = true;
    };
  }, [facingMode]);

  useEffect(() => {
    return () => {
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, [stream]);

  const switchCamera = () => {
    setFacingMode((current) =>
      current === "environment" ? "user" : "environment"
    );
  };

  const takePhoto = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (!video || !canvas || !video.videoWidth) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const context = canvas.getContext("2d");

    if (!context) return;

    if (facingMode === "user") {
      context.translate(canvas.width, 0);
      context.scale(-1, 1);
    }

    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    setPhoto(canvas.toDataURL("image/jpeg", 0.9));
  };

  const retake = () => {
    setPhoto(null);
  };

  const dataUrlToBlob = async (dataUrl: string) => {
    const response = await fetch(dataUrl);
    return await response.blob();
  };

  const publish = async () => {
    if (!photo || uploading) return;

    const guestId = localStorage.getItem("bodafake_guest_id");

    if (!guestId) {
      router.replace("/setup");
      return;
    }

    setUploading(true);
    setCameraError("");

    try {
      // Buscar evento
      const { data: events, error: eventError } = await supabase
        .from("events")
        .select("id")
        .eq("slug", EVENT_SLUG)
        .limit(1);

      if (eventError) {
        throw new Error(
          `No pudimos encontrar la boda: ${eventError.message}`
        );
      }

      const event = events?.[0];

      if (!event) {
        throw new Error("No encontramos la BodaFake.");
      }

      // Convertir foto a archivo
      const blob = await dataUrlToBlob(photo);

      const fileName = `${crypto.randomUUID()}.jpg`;

      const filePath = `${event.id}/${guestId}/${fileName}`;

      // Subir a Storage
      const { error: uploadError } = await supabase.storage
        .from("photos")
        .upload(filePath, blob, {
          contentType: "image/jpeg",
          cacheControl: "31536000",
          upsert: false,
        });

      if (uploadError) {
        console.error("STORAGE ERROR:", uploadError);

        throw new Error(
          `No pudimos subir la foto: ${uploadError.message}`
        );
      }

      // Obtener URL pública
      const { data: publicUrlData } = supabase.storage
        .from("photos")
        .getPublicUrl(filePath);

      const imageUrl = publicUrlData.publicUrl;

      // Registrar foto en la base de datos
      const { error: photoError } = await supabase
        .from("photos")
        .insert({
          event_id: event.id,
          guest_id: guestId,
          image_url: imageUrl,
          is_visible: true,
        });

      if (photoError) {
        console.error("PHOTO DATABASE ERROR:", photoError);

        // Si falla la BD, intentamos eliminar el archivo
        await supabase.storage
          .from("photos")
          .remove([filePath]);

        throw new Error(
          `No pudimos registrar la foto: ${photoError.message}`
        );
      }

      // Guardar última foto localmente
      localStorage.setItem("bodafake_last_photo", imageUrl);
      localStorage.setItem(
        "bodafake_last_photo_at",
        new Date().toISOString()
      );

      router.push("/");
    } catch (error) {
      console.error("PUBLISH ERROR:", error);

      setCameraError(
        error instanceof Error
          ? error.message
          : "No pudimos publicar tu foto."
      );

      setUploading(false);
    }
  };

  return (
    <main className="camera-page">
      <div className="camera-header">
        <button
          type="button"
          className="camera-back"
          onClick={() => router.push("/")}
        >
          Volver
        </button>

        <div className="camera-name">{name}</div>
      </div>

      {!photo ? (
        <>
          <div className="camera-view">
            {cameraError ? (
              <div className="camera-error">
                <h1>Algo salió mal.</h1>

                <p>{cameraError}</p>

                <button
                  type="button"
                  className="camera-error-button"
                  onClick={() => window.location.reload()}
                >
                  Intentar nuevamente
                </button>
              </div>
            ) : (
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className={
                  facingMode === "user" ? "camera-mirror" : ""
                }
              />
            )}
          </div>

          <canvas
            ref={canvasRef}
            className="hidden-canvas"
          />

          <div className="camera-controls">
            <button
              type="button"
              className="camera-switch"
              onClick={switchCamera}
              aria-label="Cambiar cámara"
            >
              ↻
            </button>

            <button
              type="button"
              className="shutter"
              onClick={takePhoto}
              aria-label="Tomar foto"
              disabled={!!cameraError}
            >
              <span />
            </button>

            <div className="camera-placeholder" />
          </div>
        </>
      ) : (
        <>
          <div className="photo-preview">
            <img
              src={photo}
              alt="Vista previa de tu foto"
            />
          </div>

          <div className="preview-actions">
            <button
              type="button"
              className="preview-secondary"
              onClick={retake}
              disabled={uploading}
            >
              Repetir
            </button>

            <button
              type="button"
              className="preview-primary"
              onClick={publish}
              disabled={uploading}
            >
              {uploading ? "Publicando..." : "Publicar"}
            </button>
          </div>
        </>
      )}
    </main>
  );
}