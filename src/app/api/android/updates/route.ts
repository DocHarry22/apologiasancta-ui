import { NextResponse } from "next/server";
import { getLatestAndroidUpdate } from "@/lib/server/androidUpdates";

export async function GET() {
  try {
    return NextResponse.json({ update: await getLatestAndroidUpdate() }, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return NextResponse.json({ error: "Unable to check for app updates. Please try again later." }, {
      status: 503, headers: { "Cache-Control": "no-store" },
    });
  }
}
