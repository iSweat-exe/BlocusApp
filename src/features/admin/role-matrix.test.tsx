import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PermissionState } from "./permission-actions";
import { RolePermissionSwitch } from "./permission-forms";
import { RoleMatrixView } from "./role-matrix";
import { buildRoleMatrixModel } from "./role-matrix-model";

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const toggle = vi.fn<(previous: PermissionState, formData: FormData) => Promise<PermissionState>>();
vi.mock("./permission-actions", () => ({
  toggleRolePermission: (previous: PermissionState, formData: FormData) =>
    toggle(previous, formData),
  setUserPermission: vi.fn(),
}));

beforeEach(() => toggle.mockReset());

const ROLES = [
  { key: "user", label: "Utilisateur", rank: 10 },
  { key: "moderator", label: "Modérateur", rank: 30 },
  { key: "admin", label: "Administrateur", rank: 40 },
  { key: "super_admin", label: "Super administrateur", rank: 100 },
];
const PERMISSIONS = [
  { key: "announcement.publish" },
  { key: "event.create" },
  { key: "user.ban" },
  { key: "permission.manage" },
];

function view(role: string, options: { canReadJournal?: boolean } = {}) {
  const model = buildRoleMatrixModel({
    roles: ROLES,
    permissions: PERMISSIONS,
    held: new Set(["moderator:announcement.publish", "moderator:user.ban"]),
    caller: { role: "admin", permissions: ["announcement.publish", "event.create"] },
    requestedRole: role,
  });
  if (!model) throw new Error("no model");
  return render(<RoleMatrixView model={model} canReadJournal={options.canReadJournal} />);
}

describe("RoleMatrixView", () => {
  it("shows the chosen role with its count, its status and its permissions in named groups", () => {
    view("moderator");
    expect(screen.getByRole("heading", { level: 3, name: "Modérateur" })).toBeInTheDocument();
    expect(screen.getByText("Modifiable")).toBeInTheDocument();
    expect(screen.getByText(/Supervise le contenu des gérants/)).toBeInTheDocument();
    expect(screen.getByText(/sur 4 permissions/)).toBeInTheDocument();
    for (const group of ["Annonces", "Calendrier", "Modération", "Administration"]) {
      expect(screen.getByRole("heading", { level: 4, name: group })).toBeInTheDocument();
    }
  });

  it("offers a switch, named after the permission and the role, only where the caller may act", () => {
    view("moderator");
    expect(screen.getByRole("switch", { name: "Publier des annonces (Modérateur)" })).toBeChecked();
    expect(
      screen.getByRole("switch", { name: "Créer des événements (Modérateur)" }),
    ).not.toBeChecked();
    // Granted already: the caller can take it away even though they do not hold it.
    expect(
      screen.getByRole("switch", { name: "Bannir un utilisateur (Modérateur)" }),
    ).toBeChecked();
    // Not granted and not held by the caller: no switch, and the reason is shown.
    expect(screen.queryByRole("switch", { name: /Gérer les permissions/ })).toBeNull();
    expect(screen.getByText("Non accordée")).toBeInTheDocument();
    expect(screen.getByText("Tu ne possèdes pas cette permission.")).toBeInTheDocument();
  });

  it("keeps « Accordée » and « Non accordée » on one line", () => {
    view("moderator");
    expect(screen.getByText("Non accordée").className).toContain("whitespace-nowrap");
    view("super_admin");
    for (const granted of screen.getAllByText("Accordée")) {
      expect(granted.className).toContain("whitespace-nowrap");
    }
  });

  it("shows a role at or above the caller's without any switch", () => {
    view("admin");
    expect(screen.getByText("Lecture seule")).toBeInTheDocument();
    expect(screen.queryAllByRole("switch")).toHaveLength(0);
    expect(screen.getByText(/tu peux le consulter, pas le modifier/)).toBeInTheDocument();
  });

  it("shows the super administrator as locked, holding everything", () => {
    view("super_admin");
    expect(screen.getByText("Verrouillé")).toBeInTheDocument();
    expect(screen.getByText(/sur 4 permissions/).textContent).toBe("4 sur 4 permissions");
    expect(screen.getAllByText("Accordée")).toHaveLength(4);
    expect(screen.queryAllByRole("switch")).toHaveLength(0);
  });

  it("lets the journal be reached only by those who may read it", () => {
    const { unmount } = view("moderator", { canReadJournal: true });
    expect(screen.getByRole("link", { name: "Voir le journal" })).toHaveAttribute(
      "href",
      "/admin/journal",
    );
    unmount();
    view("moderator");
    expect(screen.queryByRole("link", { name: "Voir le journal" })).toBeNull();
  });

  it("lists every role as a link, with its count, and marks the chosen one", () => {
    view("moderator");
    const nav = screen.getByRole("navigation", { name: "Rôles" });
    const links = within(nav).getAllByRole("link");
    expect(links.map((link) => link.getAttribute("href"))).toEqual([
      "/admin/roles?role=super_admin",
      "/admin/roles?role=admin",
      "/admin/roles?role=moderator",
      "/admin/roles?role=user",
    ]);
    expect(within(nav).getByRole("link", { current: "page" })).toHaveTextContent("Modérateur");
    expect(links[2]).toHaveTextContent("2 permissions");
  });
});

describe("RolePermissionSwitch", () => {
  function renderSwitch(currentlyGranted: boolean) {
    return render(
      <RolePermissionSwitch
        role="moderator"
        permission="event.create"
        currentlyGranted={currentlyGranted}
        label="Créer des événements (Modérateur)"
      />,
    );
  }

  it("flips at once, sends the wanted state, then keeps it when the server accepts", async () => {
    let finish: (state: PermissionState) => void = () => {};
    toggle.mockReturnValue(new Promise<PermissionState>((resolve) => (finish = resolve)));
    renderSwitch(false);
    const control = screen.getByRole("switch");
    expect(control).not.toBeChecked();

    await userEvent.click(control);
    await waitFor(() => expect(control).toBeChecked());
    expect(control).toBeDisabled();

    const sent = toggle.mock.calls[0]?.[1];
    expect(sent?.get("role")).toBe("moderator");
    expect(sent?.get("permission")).toBe("event.create");
    expect(sent?.get("granted")).toBe("true");

    await act(async () => finish({ status: "success", message: "Enregistré." }));
    await waitFor(() => expect(control).toBeEnabled());
  });

  it("goes back by itself and says why when the server refuses", async () => {
    let finish: (state: PermissionState) => void = () => {};
    toggle.mockReturnValue(new Promise<PermissionState>((resolve) => (finish = resolve)));
    renderSwitch(true);
    const control = screen.getByRole("switch");

    await userEvent.click(control);
    await waitFor(() => expect(control).not.toBeChecked());

    await act(async () =>
      finish({ status: "error", message: "Tu n'as pas le droit de gérer les permissions." }),
    );
    await waitFor(() => expect(control).toBeChecked());
    expect(await screen.findByRole("alert")).toHaveTextContent("pas le droit");
  });
});
