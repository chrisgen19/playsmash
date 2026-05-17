"use server";

import { redirect } from "next/navigation";

import { requireUser } from "@/lib/auth/session";
import { createGroupForOwner } from "@/lib/groups/create-group";
import { createGroupSchema } from "@/lib/validations/group";

export type CreateGroupState = {
  fieldErrors?: Partial<
    Record<"name" | "description" | "visibility", string>
  >;
  error?: string;
};

export async function createGroupAction(
  _prevState: CreateGroupState,
  formData: FormData,
): Promise<CreateGroupState> {
  const user = await requireUser();

  const parsed = createGroupSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description"),
    visibility: formData.get("visibility"),
  });

  if (!parsed.success) {
    const flat = parsed.error.flatten().fieldErrors;
    return {
      fieldErrors: {
        name: flat.name?.[0],
        description: flat.description?.[0],
        visibility: flat.visibility?.[0],
      },
    };
  }

  const { group } = await createGroupForOwner({
    ownerUserId: user.id,
    ownerName: user.name,
    ownerEmail: user.email,
    input: parsed.data,
  });

  redirect(`/groups/${group.id}`);
}
