import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import webpush from "web-push";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
);

webpush.setVapidDetails(
  "mailto:bodafake@example.com",
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
);

export async function POST() {
  try {
    const { data: subscriptions, error } =
      await supabaseAdmin
        .from("push_subscriptions")
        .select(
          "id, endpoint, p256dh, auth"
        );

    if (error) {
      return NextResponse.json(
        {
          success: false,
          error: error.message,
        },
        { status: 500 }
      );
    }

    if (!subscriptions?.length) {
      return NextResponse.json(
        {
          success: false,
          error:
            "No existe ninguna suscripción push.",
        },
        { status: 404 }
      );
    }

    const payload = JSON.stringify({
      title: "BodaFake",
      body: "¡La prueba de notificaciones funciona!",
      url: "/camera",
    });

    let sent = 0;
    let expired = 0;

    for (const subscription of subscriptions) {
      try {
        await webpush.sendNotification(
          {
            endpoint: subscription.endpoint,
            keys: {
              p256dh: subscription.p256dh,
              auth: subscription.auth,
            },
          },
          payload
        );

        sent++;
      } catch (error: any) {
        console.error(
          "Error enviando Push:",
          error
        );

        if (
          error?.statusCode === 404 ||
          error?.statusCode === 410
        ) {
          expired++;

          await supabaseAdmin
            .from("push_subscriptions")
            .delete()
            .eq("id", subscription.id);
        }
      }
    }

    if (sent > 0) {
      return NextResponse.json({
        success: true,
        message:
          "Push enviado correctamente.",
        sent,
        expired,
      });
    }

    return NextResponse.json(
      {
        success: false,
        error:
          "No existe ninguna suscripción push válida.",
        expired,
      },
      { status: 410 }
    );
  } catch (error: any) {
    console.error(
      "ERROR GENERAL PUSH:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error:
          error?.message ||
          "Error interno del servidor.",
      },
      { status: 500 }
    );
  }
}