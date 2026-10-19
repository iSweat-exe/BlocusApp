import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AdminMfaGate } from "./admin-mfa-gate";
import { AdminMfaToggle } from "./admin-mfa-toggle";
import type { MfaState } from "./mfa";
import { SecurityPanel } from "./security-panel";
import { TotpChallenge } from "./totp-challenge";
import { TotpDisable } from "./totp-disable";
import { TotpEnrollment } from "./totp-enrollment";
import { TwoFactorSection } from "./two-factor-section";

const refresh = vi.fn();
const startTotpEnrollment = vi.fn();
const confirmTotpEnrollment = vi.fn();
const verifyTotpCode = vi.fn();
const disableTotp = vi.fn();
const setAdminMfaRequired = vi.fn();
const getMfaState = vi.fn();
const getSessionPermissions = vi.fn();

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("./actions", () => ({
  startTotpEnrollment: () => startTotpEnrollment(),
  confirmTotpEnrollment: (...args: unknown[]) => confirmTotpEnrollment(...args),
  verifyTotpCode: (...args: unknown[]) => verifyTotpCode(...args),
  disableTotp: (...args: unknown[]) => disableTotp(...args),
  setAdminMfaRequired: (...args: unknown[]) => setAdminMfaRequired(...args),
}));
vi.mock("./state", () => ({ getMfaState: () => getMfaState() }));
vi.mock("@/server/session", () => ({ getSessionPermissions: () => getSessionPermissions() }));

const state = (overrides: Partial<MfaState> = {}): MfaState => ({
  aal: "aal1",
  verifiedFactorId: null,
  required: false,
  blocked: false,
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
  getSessionPermissions.mockResolvedValue({ userId: "u1", permissions: ["user.ban"] });
  getMfaState.mockResolvedValue(state());
  startTotpEnrollment.mockResolvedValue({
    ok: true,
    factorId: "00000000-0000-0000-0000-00000000fa01",
    qrCode: "data:image/svg+xml;utf8,<svg/>",
    secret: "JBSWY3DPEHPK3PXP",
  });
  confirmTotpEnrollment.mockResolvedValue({ ok: true });
  verifyTotpCode.mockResolvedValue({ ok: true });
  disableTotp.mockResolvedValue({ ok: true });
  setAdminMfaRequired.mockResolvedValue({ ok: true });
});

describe("TotpEnrollment", () => {
  it("walks from the button to the QR code, then confirms with the first code and refreshes", async () => {
    const user = userEvent.setup();
    render(<TotpEnrollment />);

    await user.click(screen.getByRole("button", { name: "Activer la double authentification" }));
    expect(await screen.findByRole("img", { name: /Code QR/ })).toBeInTheDocument();
    expect(screen.getByText("JBSW Y3DP EHPK 3PXP")).toBeInTheDocument();

    const confirm = screen.getByRole("button", { name: "Confirmer" });
    expect(confirm).toBeDisabled();
    await user.type(screen.getByLabelText("Code à six chiffres"), "123 456");
    await user.click(confirm);

    expect(confirmTotpEnrollment).toHaveBeenCalledWith(
      "00000000-0000-0000-0000-00000000fa01",
      "123 456",
    );
    expect(refresh).toHaveBeenCalled();
  });

  it("shows why the enrollment could not start", async () => {
    startTotpEnrollment.mockResolvedValue({ ok: false, message: "Déjà activée." });
    const user = userEvent.setup();
    render(<TotpEnrollment />);
    await user.click(screen.getByRole("button", { name: "Activer la double authentification" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Déjà activée.");
  });

  it("keeps the screen and empties the field after a wrong code", async () => {
    confirmTotpEnrollment.mockResolvedValue({ ok: false, message: "Code incorrect." });
    const user = userEvent.setup();
    render(<TotpEnrollment />);
    await user.click(screen.getByRole("button", { name: "Activer la double authentification" }));
    await user.type(await screen.findByLabelText("Code à six chiffres"), "000000");
    await user.click(screen.getByRole("button", { name: "Confirmer" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Code incorrect.");
    expect(screen.getByLabelText("Code à six chiffres")).toHaveValue("");
    expect(refresh).not.toHaveBeenCalled();
  });
});

describe("TotpChallenge", () => {
  it("sends the code and refreshes when it is right", async () => {
    const user = userEvent.setup();
    render(<TotpChallenge />);
    await user.type(screen.getByLabelText("Code à six chiffres"), "654321");
    await user.click(screen.getByRole("button", { name: "Valider" }));
    expect(verifyTotpCode).toHaveBeenCalledWith("654321");
    expect(refresh).toHaveBeenCalled();
  });

  it("shows the refusal and does not refresh", async () => {
    verifyTotpCode.mockResolvedValue({ ok: false, message: "Code incorrect." });
    const user = userEvent.setup();
    render(<TotpChallenge />);
    await user.type(screen.getByLabelText("Code à six chiffres"), "654321");
    await user.click(screen.getByRole("button", { name: "Valider" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Code incorrect.");
    expect(refresh).not.toHaveBeenCalled();
  });
});

describe("TotpDisable", () => {
  it("asks for the current code before turning the protection off", async () => {
    const user = userEvent.setup();
    render(<TotpDisable />);
    await user.click(screen.getByRole("button", { name: "Désactiver" }));
    await user.type(screen.getByLabelText("Code à six chiffres"), "111222");
    await user.click(screen.getAllByRole("button", { name: "Désactiver" })[0]!);
    expect(disableTotp).toHaveBeenCalledWith("111222");
    expect(refresh).toHaveBeenCalled();
  });
});

describe("AdminMfaGate", () => {
  it("shows the admin sections when nothing holds the session back", async () => {
    render(await AdminMfaGate({ children: <p>Sections</p> }));
    expect(screen.getByText("Sections")).toBeInTheDocument();
  });

  it("replaces them with the code screen for someone who is enrolled but held back", async () => {
    getMfaState.mockResolvedValue(state({ blocked: true, required: true, verifiedFactorId: "f1" }));
    render(await AdminMfaGate({ children: <p>Sections</p> }));
    expect(screen.queryByText("Sections")).toBeNull();
    expect(
      screen.getByRole("heading", { name: "Double authentification requise" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Code à six chiffres")).toBeInTheDocument();
  });

  it("offers the enrollment to someone held back who has no authenticator yet", async () => {
    getMfaState.mockResolvedValue(state({ blocked: true, required: true }));
    render(await AdminMfaGate({ children: <p>Sections</p> }));
    expect(
      screen.getByRole("button", { name: "Activer la double authentification" }),
    ).toBeInTheDocument();
  });
});

describe("TwoFactorSection", () => {
  it("is for administration staff only", async () => {
    getSessionPermissions.mockResolvedValue({
      userId: "u1",
      permissions: ["announcement.publish"],
    });
    expect(await TwoFactorSection()).toBeNull();
    getSessionPermissions.mockResolvedValue(null);
    expect(await TwoFactorSection()).toBeNull();
  });

  it("offers the enrollment, and says when it is mandatory", async () => {
    getMfaState.mockResolvedValue(state({ required: true }));
    render((await TwoFactorSection())!);
    expect(screen.getByText(/Obligatoire pour les administrateurs/)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Activer la double authentification" }),
    ).toBeInTheDocument();
  });

  it("shows it is on, with a way to turn it off", async () => {
    getMfaState.mockResolvedValue(state({ verifiedFactorId: "f1", aal: "aal2" }));
    render((await TwoFactorSection())!);
    expect(screen.getByText("Activée", { selector: ".chip" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Désactiver" })).toBeInTheDocument();
  });
});

describe("SecurityPanel and AdminMfaToggle", () => {
  it("asks a super administrator without authenticator to enroll first", async () => {
    render((await SecurityPanel())!);
    expect(screen.getByRole("note")).toHaveTextContent(
      "Active d'abord ta propre double authentification",
    );
    expect(screen.queryByRole("button", { name: "Rendre obligatoire" })).toBeNull();
  });

  it("asks for the code first when the session did not give it", async () => {
    getMfaState.mockResolvedValue(state({ verifiedFactorId: "f1" }));
    render((await SecurityPanel())!);
    expect(screen.getByLabelText("Code à six chiffres")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Rendre obligatoire" })).toBeNull();
  });

  it("offers the switch to a session at AAL2, and shows the state", async () => {
    getMfaState.mockResolvedValue(state({ verifiedFactorId: "f1", aal: "aal2", required: true }));
    render((await SecurityPanel())!);
    expect(screen.getByText("obligatoire")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Rendre facultative" })).toBeInTheDocument();
  });

  it("makes the rule mandatory only after a confirmation that warns about the lock", async () => {
    const user = userEvent.setup();
    render(<AdminMfaToggle required={false} />);
    await user.click(screen.getByRole("button", { name: "Rendre obligatoire" }));
    expect(screen.getByRole("alert")).toHaveTextContent("perdront leurs droits");
    expect(setAdminMfaRequired).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Confirmer" }));
    expect(setAdminMfaRequired).toHaveBeenCalledWith(true);
    expect(refresh).toHaveBeenCalled();
  });

  it("makes the rule optional again in one tap, and shows a refusal", async () => {
    setAdminMfaRequired.mockResolvedValue({ ok: false, message: "Valide d'abord ton code." });
    const user = userEvent.setup();
    render(<AdminMfaToggle required />);
    await user.click(screen.getByRole("button", { name: "Rendre facultative" }));
    expect(setAdminMfaRequired).toHaveBeenCalledWith(false);
    expect(await screen.findByRole("alert")).toHaveTextContent("Valide d'abord ton code.");
    expect(refresh).not.toHaveBeenCalled();
  });
});
