import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
);

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const {
      guestId,
      endpoint,
      p256dh,
      auth,
    } = body;

    if (
      !guestId ||
      !endpoint ||
      !p256dh ||
      !auth
    ) {
      return NextResponse.json(
        {
          error:
            "Faltan datos de la suscripción.",
        },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from("push_subscriptions")
      .upsert(
        {
          guest_id: guestId,
          endpoint,
          p256dh,
          auth,
        },
        {
          onConflict: "endpoint",
        }
      );

    if (error) {
      console.error(
        "Error Supabase:",
        error
      );

      return NextResponse.json(
        {
          error: error.message,
          code: error.code,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error(
      "Error en /api/push/subscribe:",
      error
    );

    return NextResponse.json(
      {
        error: "Error interno del servidor.",
      },
      { status: 500 }
    );
  }
}