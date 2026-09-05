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

const NOTIFICATION_TEXT =
  "HORA DE CAPTURAR EN LA BODA FAKEEEE 🍸🥂💍";

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get("authorization");

    if (
      process.env.CRON_SECRET &&
      authHeader !== `Bearer ${process.env.CRON_SECRET}`
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "No autorizado.",
        },
        { status: 401 }
      );
    }

    const now = new Date().toISOString();

    // Buscar momentos que ya llegaron y todavía no han enviado
    const { data: moments, error: momentsError } =
      await supabaseAdmin
        .from("moments")
        .select(
          "id, event_id, title, message, scheduled_at, active, notification_sent"
        )
        .eq("active", true)
        .eq("notification_sent", false)
        .lte("scheduled_at", now)
        .order("scheduled_at", {
          ascending: true,
        });

    if (momentsError) {
      console.error(
        "Error buscando momentos:",
        momentsError
      );

      return NextResponse.json(
        {
          success: false,
          error: momentsError.message,
        },
        { status: 500 }
      );
    }

    if (!moments?.length) {
      return NextResponse.json({
        success: true,
        message: "No hay momentos pendientes.",
        processed: 0,
      });
    }

    let totalSent = 0;
    let totalExpired = 0;
    const processedMoments = [];

    for (const moment of moments) {
      // Invitados registrados antes o exactamente
      // en el momento de la notificación
      const { data: guests, error: guestsError } =
        await supabaseAdmin
          .from("guests")
          .select("id, registered_at")
          .eq("event_id", moment.event_id)
          .lte(
            "registered_at",
            moment.scheduled_at
          );

      if (guestsError) {
        console.error(
          "Error buscando invitados:",
          guestsError
        );

        continue;
      }

      const guestIds =
        guests?.map((guest) => guest.id) || [];

      if (!guestIds.length) {
        await supabaseAdmin
          .from("moments")
          .update({
            notification_sent: true,
          })
          .eq("id", moment.id);

        processedMoments.push({
          moment_id: moment.id,
          sent: 0,
          expired: 0,
          guests: 0,
        });

        continue;
      }

      // Buscar solamente las suscripciones
      // pertenecientes a invitados elegibles
      const { data: subscriptions, error: subscriptionsError } =
        await supabaseAdmin
          .from("push_subscriptions")
          .select(
            "id, guest_id, endpoint, p256dh, auth"
          )
          .in("guest_id", guestIds);

      if (subscriptionsError) {
        console.error(
          "Error buscando suscripciones:",
          subscriptionsError
        );

        continue;
      }

      let momentSent = 0;
      let momentExpired = 0;

      for (const subscription of subscriptions || []) {
        try {
          await webpush.sendNotification(
            {
              endpoint: subscription.endpoint,
              keys: {
                p256dh: subscription.p256dh,
                auth: subscription.auth,
              },
            },
            JSON.stringify({
              title: "BodaFake",
              body: NOTIFICATION_TEXT,
              url: "/camera",
            })
          );

          momentSent++;
          totalSent++;
        } catch (error: any) {
          console.error(
            "Error enviando Push:",
            error
          );

          // Suscripción vencida
          if (
            error?.statusCode === 404 ||
            error?.statusCode === 410
          ) {
            momentExpired++;
            totalExpired++;

            await supabaseAdmin
              .from("push_subscriptions")
              .delete()
              .eq("id", subscription.id);
          }
        }
      }

      // Marcar el momento como procesado
      await supabaseAdmin
        .from("moments")
        .update({
          notification_sent: true,
        })
        .eq("id", moment.id);

      processedMoments.push({
        moment_id: moment.id,
        scheduled_at: moment.scheduled_at,
        sent: momentSent,
        expired: momentExpired,
        guests: guestIds.length,
      });
    }

    return NextResponse.json({
      success: true,
      processed: processedMoments.length,
      sent: totalSent,
      expired: totalExpired,
      moments: processedMoments,
    });
  } catch (error: any) {
    console.error(
      "ERROR GENERAL SEND MOMENTS:",
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