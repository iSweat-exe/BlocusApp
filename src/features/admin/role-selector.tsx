import { ChipTabs } from "@/components/chip-tabs";
import type { RoleOverview } from "./role-matrix-model";

/** Roles of the page, one tap each, with how many permissions each holds. */
export function RoleSelector({
  roles,
  selectedKey,
}: {
  roles: RoleOverview[];
  selectedKey: string;
}) {
  return (
    <ChipTabs
      label="Rôles"
      activeKey={selectedKey}
      tabs={roles.map((role) => ({
        key: role.key,
        label: role.label,
        href: `/admin/roles?role=${role.key}`,
        badge: role.grantedCount,
        badgeLabel: "permissions",
      }))}
    />
  );
}
