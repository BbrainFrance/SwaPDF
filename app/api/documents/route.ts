import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUser } from "@/lib/auth";

// GET - Récupérer l'historique des documents + usage du jour
export async function GET(request: NextRequest) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "20");
    const offset = parseInt(searchParams.get("offset") || "0");

    // Documents récents
    const documents = await prisma.document.findMany({
      where: { userId: user.userId },
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
    });

    const totalDocuments = await prisma.document.count({
      where: { userId: user.userId },
    });

    // Compter les documents du jour
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const todayCount = await prisma.document.count({
      where: {
        userId: user.userId,
        createdAt: { gte: todayStart },
      },
    });

    // Récupérer le plan de l'utilisateur
    const dbUser = await prisma.user.findUnique({
      where: { id: user.userId },
      select: { plan: true },
    });

    const plan = dbUser?.plan || "free";
    const dailyLimit = plan === "free" ? 2 : -1; // -1 = illimité

    return NextResponse.json({
      documents,
      totalDocuments,
      todayCount,
      dailyLimit,
      plan,
      canProcess: plan !== "free" || todayCount < 2,
    });
  } catch (error) {
    console.error("Get documents error:", error);
    return NextResponse.json(
      { error: "Erreur interne du serveur" },
      { status: 500 }
    );
  }
}

// POST - Enregistrer un document traité
export async function POST(request: NextRequest) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const { filename, originalName, type, action, size } = await request.json();

    if (!filename || !originalName || !type || !action) {
      return NextResponse.json(
        { error: "Données manquantes" },
        { status: 400 }
      );
    }

    // Vérifier la limite quotidienne pour les utilisateurs gratuits
    const dbUser = await prisma.user.findUnique({
      where: { id: user.userId },
      select: { plan: true },
    });

    const plan = dbUser?.plan || "free";

    if (plan === "free") {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const todayCount = await prisma.document.count({
        where: {
          userId: user.userId,
          createdAt: { gte: todayStart },
        },
      });

      if (todayCount >= 2) {
        return NextResponse.json(
          {
            error: "Limite quotidienne atteinte (2 documents/jour). Passez au plan Pro pour un accès illimité.",
            limitReached: true,
          },
          { status: 429 }
        );
      }
    }

    const document = await prisma.document.create({
      data: {
        userId: user.userId,
        filename,
        originalName,
        type,
        action,
        size: size || 0,
      },
    });

    return NextResponse.json({ document }, { status: 201 });
  } catch (error) {
    console.error("Create document error:", error);
    return NextResponse.json(
      { error: "Erreur interne du serveur" },
      { status: 500 }
    );
  }
}
