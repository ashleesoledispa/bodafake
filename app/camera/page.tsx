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
      window.location.replace("/setup");
      return;
    }

    setName(savedName);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const startCamera = async () => {
      try {
        setCameraError("");

        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error("La cámara no está disponible en este navegador.");
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

          try {
            await videoRef.current.play();
          } catch (error) {
            console.error("VIDEO PLAY ERROR:", error);
          }
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

    if (!video || !canvas || !video.videoWidth || !video.videoHeight) {
      setCameraError("La cámara todavía no está lista. Intenta nuevamente.");
      return;
    }

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const context = canvas.getContext("2d");

    if (!context) {
      setCameraError("No pudimos preparar la foto.");
      return;
    }

    context.setTransform(1, 0, 0, 1, 0, 0);

    if (facingMode === "user") {
      context.translate(canvas.width, 0);
      context.scale(-1, 1);
    }

    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    const image = canvas.toDataURL("image/jpeg", 0.9);

    setCameraError("");
    setPhoto(image);
  };

  const retake = () => {
    if (uploading) return;

    setCameraError("");
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
      window.location.replace("/setup");
      return;
    }

    setUploading(true);
    setCameraError("");

    try {
      // 1. Buscar evento
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

      // 2. Convertir foto
      const blob = await dataUrlToBlob(photo);

      if (!blob || blob.size === 0) {
        throw new Error("La foto está vacía. Intenta tomarla nuevamente.");
      }

      // 3. Crear nombre único
      const fileName = `${crypto.randomUUID()}.jpg`;
      const filePath = `${event.id}/${guestId}/${fileName}`;

      // 4. Subir a Storage
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

      // 5. Obtener URL pública
      const { data: publicUrlData } = supabase.storage
        .from("photos")
        .getPublicUrl(filePath);

      const imageUrl = publicUrlData?.publicUrl;

      if (!imageUrl) {
        throw new Error("No pudimos obtener la URL de la foto.");
      }

      // 6. Registrar foto en la base de datos
      const { error: photoError } = await supabase.from("photos").insert({
        event_id: event.id,
        guest_id: guestId,
        image_url: imageUrl,
        is_visible: true,
      });

      if (photoError) {
        console.error("PHOTO DATABASE ERROR:", photoError);

        await supabase.storage.from("photos").remove([filePath]);

        throw new Error(
          `No pudimos registrar la foto: ${photoError.message}`
        );
      }

      // 7. Guardar última foto
      localStorage.setItem("bodafake_last_photo", imageUrl);
      localStorage.setItem(
        "bodafake_last_photo_at",
        new Date().toISOString()
      );

      // 8. Detener cámara
      stream?.getTracks().forEach((track) => track.stop());

      // 9. Volver al mural
      window.location.replace("/");
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
          onClick={() => {
            stream?.getTracks().forEach((track) => track.stop());
            window.location.replace("/");
          }}
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
              disabled={!!cameraError}
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

          {cameraError && (
            <div className="publish-error">
              <p>{cameraError}</p>
            </div>
          )}

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