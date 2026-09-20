import { describe, expect, it, vi } from "vitest";
import { activateWaitingServiceWorker, registerServiceWorker } from "../src/lib/pwa/register-service-worker";

describe("consulta offline y registro seguro", () => {
  it("devuelve null fuera de producción sin registrar el worker", async () => {
    // Cubre S3.5 y RNF-05: el registro no bloquea el desarrollo local.
    vi.stubEnv("NODE_ENV", "development");
    const register = vi.fn();
    vi.stubGlobal("window", {});
    vi.stubGlobal("navigator", { serviceWorker: { register } });
    await expect(registerServiceWorker()).resolves.toBeNull();
    expect(register).not.toHaveBeenCalled();
  });

  it("captura un rechazo de register y no lanza", async () => {
    // Cubre RNF-05: un fallo del worker no bloquea la aplicación.
    vi.stubEnv("NODE_ENV", "production");
    const error = new Error("registration failed");
    const register = vi.fn().mockRejectedValue(error);
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.stubGlobal("window", {});
    vi.stubGlobal("navigator", { serviceWorker: { register } });
    await expect(registerServiceWorker()).resolves.toBeNull();
    expect(consoleError).toHaveBeenCalled();
  });

  it("avisa cuando hay una actualización instalada y ya existe controlador", async () => {
    // Cubre el ciclo de actualización de RNF-05: no confundir primera instalación con update.
    vi.stubEnv("NODE_ENV", "production");
    let updateListener: (() => void) | undefined;
    let stateListener: (() => void) | undefined;
    const installing = {
      state: "installing",
      addEventListener: (_type: string, listener: () => void) => { stateListener = listener; },
    };
    const registration = {
      installing,
      addEventListener: (_type: string, listener: () => void) => { updateListener = listener; },
    };
    const onUpdateAvailable = vi.fn();
    vi.stubGlobal("window", {});
    vi.stubGlobal("navigator", { serviceWorker: { register: vi.fn().mockResolvedValue(registration), controller: {} } });
    await registerServiceWorker({ onUpdateAvailable });
    updateListener?.();
    installing.state = "installed";
    stateListener?.();
    expect(onUpdateAvailable).toHaveBeenCalledWith(registration);
  });

  it("envía SKIP_WAITING y recarga una sola vez", () => {
    // Cubre el ciclo de actualización segura descrito en docs/cache-strategy.md.
    const postMessage = vi.fn();
    const controllerListeners: (() => void)[] = [];
    const reload = vi.fn();
    vi.stubGlobal("window", { location: { reload } });
    vi.stubGlobal("navigator", {
      serviceWorker: { addEventListener: (_type: string, listener: () => void) => controllerListeners.push(listener) },
    });
    activateWaitingServiceWorker({ waiting: { postMessage } } as unknown as ServiceWorkerRegistration);
    expect(postMessage).toHaveBeenCalledWith({ type: "SKIP_WAITING" });
    controllerListeners[0]();
    controllerListeners[0]();
    expect(reload).toHaveBeenCalledTimes(1);
  });
});
