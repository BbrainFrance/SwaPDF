import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUser } from "@/lib/auth";

// GET - Récupérer les signatures de l'utilisateur
export async function GET() {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json(
        { error: "Non authentifié" },
        { status: 401 }
      );
    }

    const signatures = await prisma.signature.findMany({
      where: { userId: user.userId },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ signatures });
  } catch (error) {
    console.error("Get signatures error:", error);
    return NextResponse.json(
      { error: "Erreur interne du serveur" },
      { status: 500 }
    );
  }
}

// POST - Sauvegarder une nouvelle signature
export async function POST(request: NextRequest) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json(
        { error: "Non authentifié" },
        { status: 401 }
      );
    }

    const { name, data } = await request.json();

    if (!name || !data) {
      return NextResponse.json(
        { error: "Le nom et les données de signature sont requis" },
        { status: 400 }
      );
    }

    const signature = await prisma.signature.create({
      data: {
        userId: user.userId,
        name,
        data,
      },
    });

    return NextResponse.json({ signature }, { status: 201 });
  } catch (error) {
    console.error("Save signature error:", error);
    return NextResponse.json(
      { error: "Erreur interne du serveur" },
      { status: 500 }
    );
  }
}

// DELETE - Supprimer une signature
export async function DELETE(request: NextRequest) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json(
        { error: "Non authentifié" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "ID de signature requis" },
        { status: 400 }
      );
    }

    // Vérifier que la signature appartient à l'utilisateur
    const signature = await prisma.signature.findFirst({
      where: { id, userId: user.userId },
    });

    if (!signature) {
      return NextResponse.json(
        { error: "Signature non trouvée" },
        { status: 404 }
      );
    }

    await prisma.signature.delete({ where: { id } });

    return NextResponse.json({ message: "Signature supprimée" });
  } catch (error) {
    console.error("Delete signature error:", error);
    return NextResponse.json(
      { error: "Erreur interne du serveur" },
      { status: 500 }
    );
  }
}
