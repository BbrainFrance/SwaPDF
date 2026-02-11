import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUser } from "@/lib/auth";

// GET - Vérifier l'usage du jour et le plan
export async function GET() {
  try {
    const user = await getUser();
    if (!user) {
      // Utilisateur non connecté = pas de limite trackée, mais pas de features Pro
      return NextResponse.json({
        authenticated: false,
        plan: "free",
        todayCount: 0,
        dailyLimit: 2,
        canProcess: true, // Pas connecté = on le laisse utiliser mais pas de tracking
        canUseTimestamp: false,
      });
    }

    const dbUser = await prisma.user.findUnique({
      where: { id: user.userId },
      select: { plan: true },
    });

    const plan = dbUser?.plan || "free";

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const todayCount = await prisma.document.count({
      where: {
        userId: user.userId,
        createdAt: { gte: todayStart },
      },
    });

    const dailyLimit = plan === "free" ? 2 : -1;
    const canProcess = plan !== "free" || todayCount < 2;
    const canUseTimestamp = plan !== "free"; // Signature horodatée = Pro+

    return NextResponse.json({
      authenticated: true,
      plan,
      todayCount,
      dailyLimit,
      canProcess,
      canUseTimestamp,
    });
  } catch (error) {
    console.error("Usage check error:", error);
    return NextResponse.json(
      { authenticated: false, plan: "free", todayCount: 0, dailyLimit: 2, canProcess: true, canUseTimestamp: false },
      { status: 200 }
    );
  }
}
