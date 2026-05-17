import { beforeEach, describe, expect, it, vi } from "vitest";

import { GroupVisibility } from "@/lib/db/generated/enums";

// Hoisted with vi.hoisted so the mock factory can reference these refs
// (vi.mock calls themselves are hoisted to the top of the file).
const { prismaMock, txMocks } = vi.hoisted(() => {
  const txMocks = {
    group: { create: vi.fn() },
    groupMember: { create: vi.fn() },
    playerProfile: { create: vi.fn() },
    invite: { create: vi.fn() },
  };
  const prismaMock = {
    group: { findUnique: vi.fn() },
    $transaction: vi.fn(async (fn: (tx: typeof txMocks) => unknown) =>
      fn(txMocks),
    ),
  };
  return { prismaMock, txMocks };
});

vi.mock("@/lib/db", async () => {
  const enums = await vi.importActual<
    typeof import("@/lib/db/generated/enums")
  >("@/lib/db/generated/enums");
  return { ...enums, prisma: prismaMock };
});

const { createGroupForOwner } = await import("@/lib/groups/create-group");

describe("createGroupForOwner", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.group.findUnique.mockResolvedValue(null);
    txMocks.group.create.mockImplementation(async ({ data }) => ({
      id: "group_1",
      name: data.name,
      description: data.description ?? null,
      visibility: data.visibility,
      joinCode: data.joinCode,
      createdByUserId: data.createdByUserId,
      createdAt: new Date(),
      updatedAt: new Date(),
    }));
    txMocks.groupMember.create.mockResolvedValue({});
    txMocks.playerProfile.create.mockResolvedValue({});
    txMocks.invite.create.mockResolvedValue({});
  });

  it("creates Group + OWNER member + linked player + Invite in one transaction", async () => {
    const result = await createGroupForOwner({
      ownerUserId: "user_1",
      ownerName: "Alice Smith",
      ownerEmail: "alice@example.com",
      input: {
        name: "Tuesday Pickleball",
        description: undefined,
        visibility: GroupVisibility.INVITE_ONLY,
      },
    });

    expect(prismaMock.$transaction).toHaveBeenCalledOnce();

    expect(txMocks.group.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        name: "Tuesday Pickleball",
        visibility: GroupVisibility.INVITE_ONLY,
        createdByUserId: "user_1",
        joinCode: expect.stringMatching(
          /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/,
        ),
      }),
    });

    expect(txMocks.groupMember.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        groupId: "group_1",
        userId: "user_1",
        role: "OWNER",
        status: "ACTIVE",
      }),
    });

    expect(txMocks.playerProfile.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        groupId: "group_1",
        userId: "user_1",
        displayName: "Alice Smith",
        status: "ACTIVE",
        createdByUserId: "user_1",
      }),
    });

    expect(txMocks.invite.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        groupId: "group_1",
        createdByUserId: "user_1",
        status: "ACTIVE",
        code: result.joinCode,
      }),
    });

    expect(result.group.id).toBe("group_1");
    expect(result.joinCode).toMatch(
      /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/,
    );
  });

  it("falls back to the email local-part when name is empty", async () => {
    await createGroupForOwner({
      ownerUserId: "user_2",
      ownerName: null,
      ownerEmail: "bob@example.com",
      input: {
        name: "Backyard Pickle",
        description: undefined,
        visibility: GroupVisibility.PRIVATE,
      },
    });

    expect(txMocks.playerProfile.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ displayName: "bob" }),
    });
  });
});
