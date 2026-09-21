import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { activateWaitingServiceWorker, registerServiceWorker } from "../src/lib/pwa/register-service-worker";
import { createFakeNetwork, createServiceWorkerHarness, navigationRequest } from "./helpers/sw-harness";

// Sin esta limpieza, `NODE_ENV`, `window`, `navigator` y el espía de console.error de un test
// siguen activos en el siguiente y las aserciones "no se llamó" pasarían por accidente.
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

/**
 * Prepara `registerServiceWorker` con un registro que dispara `updatefound` y luego pasa el
 * worker instalado a "installed". `controller` es null en la primera instalación.
 */
function createUpdateScenario(controller: object | null) {
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
  vi.stubGlobal("navigator", { serviceWorker: { register: vi.fn().mockResolvedValue(registration), controller } });

  return {
    registration,
    onUpdateAvailable,
    async run() {
      await registerServiceWorker({ onUpdateAvailable });
      expect(updateListener, "debe escuchar updatefound").toBeDefined();
      updateListener?.();
      expect(stateListener, "debe escuchar el cambio de estado del worker nuevo").toBeDefined();
      installing.state = "installed";
      stateListener?.();
    },
  };
}

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
    const scenario = createUpdateScenario({});
    await scenario.run();
    expect(scenario.onUpdateAvailable).toHaveBeenCalledWith(scenario.registration);
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

  it.each([
    ["sin window (render en el servidor)", () => { vi.stubGlobal("window", undefined); }],
    [
      "navigator sin serviceWorker (navegador sin soporte)",
      () => {
        vi.stubGlobal("window", {});
        vi.stubGlobal("navigator", {});
      },
    ],
  ])("devuelve null sin lanzar ni registrar error cuando falta soporte: %s", async (_caso, arrange) => {
    // Contrato 1/5 del registro. En producción, la falta de soporte no es un fallo que reportar.
    vi.stubEnv("NODE_ENV", "production");
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    arrange();

    await expect(registerServiceWorker()).resolves.toBeNull();

    expect(consoleError, "la falta de soporte no debe registrarse como error").not.toHaveBeenCalled();
  });

  it("no avisa de actualización en la primera instalación (sin controlador)", async () => {
    // Contrato 4/5 del registro, caso negativo: la primera instalación no es una actualización.
    const scenario = createUpdateScenario(null);
    await scenario.run();
    expect(scenario.onUpdateAvailable).not.toHaveBeenCalled();
  });
});

describe("consulta offline de extremo a extremo (service worker simulado)", () => {
  beforeEach(() => {
    // Los fallos de red simulados se registran con console.error: se silencian para no ensuciar la salida.
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  function setup() {
    const network = createFakeNetwork();
    network.respond("/", () => new Response("Inspecciones de laboratorio v1"));
    network.respond("/offline", () => new Response("Sin conexión"));
    return { network, harness: createServiceWorkerHarness(network.fetch) };
  }

  it("tras la primera visita, la portada se consulta sin red desde el precache", async () => {
    // Cubre RF-05/RNF-05: la lista de inspecciones sintéticas sigue disponible sin conexión.
    const { network, harness } = setup();
    await harness.install();
    await harness.activate();
    network.goOffline();

    const response = await harness.fetch(navigationRequest("/"));

    expect(await response?.text()).toBe("Inspecciones de laboratorio v1");
  });

  it("sin red se muestra la última respuesta cacheable vista con red, no la de la instalación", async () => {
    // Consistencia: la copia local no se queda congelada en el momento de instalar el worker.
    // Límite comprobado con `next start`: la ruta `/` real es dinámica (ƒ) y responde
    // `Cache-Control: no-store`, así que en producción esta actualización no ocurre para `/`.
    // Aquí la respuesta simulada sí es cacheable. Ver "Supuestos y límites" del README.
    const { network, harness } = setup();
    await harness.install();
    await harness.activate();
    network.respond("/", () => new Response("Inspecciones de laboratorio v2"));
    await harness.fetch(navigationRequest("/"));
    network.goOffline();

    const response = await harness.fetch(navigationRequest("/"));

    expect(await response?.text()).toBe("Inspecciones de laboratorio v2");
  });

  it("al volver la red se sirve de la red otra vez y /offline no queda fijado", async () => {
    // Consistencia: el fallback es solo para el momento sin conexión y no se guarda como la ruta pedida.
    const { network, harness } = setup();
    await harness.install();
    await harness.activate();
    network.goOffline();
    const sinRed = await harness.fetch(navigationRequest("/ruta-nueva"));
    network.goOnline();
    network.respond("/ruta-nueva", () => new Response("ruta nueva"));

    const conRed = await harness.fetch(navigationRequest("/ruta-nueva"));

    expect(await sinRed?.text()).toBe("Sin conexión");
    expect(await conRed?.text()).toBe("ruta nueva");
  });
});
