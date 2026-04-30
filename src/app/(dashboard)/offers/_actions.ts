"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { defineAction } from "@/lib/actions";
import * as offers from "@/lib/repositories/offers";

const offerBodySchema = z.object({
  company: z.string().min(1).max(200),
  role: z.string().min(1).max(200),
  baseSalary: z.coerce.number().min(0),
  currency: z.string().min(1).max(10),
  equity: z.string().max(500).optional(),
  bonus: z.string().max(500).optional(),
  leaveDays: z.coerce.number().int().min(0).optional(),
  location: z.string().min(1).max(200),
  remotePolicy: z.enum(["fully_remote", "hybrid", "onsite"]),
  roleLevel: z.string().min(1).max(100),
  notes: z.string().max(5000).optional(),
});

const updateOfferSchema = offerBodySchema.partial().extend({
  offerId: z.string().min(1),
});

const deleteOfferSchema = z.object({
  offerId: z.string().min(1),
});

export const createOffer = defineAction(
  async (ctx, input: z.infer<typeof offerBodySchema>) => {
    const data = offerBodySchema.parse(input);
    const offer = await offers.create(ctx.user._id.toString(), data);
    revalidatePath("/offers");
    return { offerId: offer._id };
  }
);

export const updateOffer = defineAction(
  async (ctx, input: z.infer<typeof updateOfferSchema>) => {
    const { offerId, ...rest } = updateOfferSchema.parse(input);
    const updated = await offers.update(ctx.user._id.toString(), offerId, rest);
    if (!updated) throw new Error("Offer not found");
    revalidatePath("/offers");
    revalidatePath(`/offers/${offerId}`);
    return { offerId };
  }
);

export const deleteOffer = defineAction(
  async (ctx, input: z.infer<typeof deleteOfferSchema>) => {
    const { offerId } = deleteOfferSchema.parse(input);
    const deleted = await offers.deleteOffer(ctx.user._id.toString(), offerId);
    if (!deleted) throw new Error("Offer not found");
    revalidatePath("/offers");
    return { offerId };
  }
);
