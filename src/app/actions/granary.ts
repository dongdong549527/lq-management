"use server";

import { prisma } from "@/lib/prisma";

export async function updateGranaryStatus(id: number, status: number) {
  try {
    await prisma.granary.update({
      where: { id },
      data: { collectionStatus: status },
    });
    return { success: true };
  } catch (error) {
    console.error("Failed to update granary status:", error);
    return { success: false, error: "Failed to update status" };
  }
}
