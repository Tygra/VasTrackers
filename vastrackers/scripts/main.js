const MODULE_ID   = "vastrackers";
const SETTING_KEY = "state";

class VasTrackersApp extends Application {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: "vastrackers-app",
      title: "VasTrackers",
      template: `modules/${MODULE_ID}/templates/panel.hbs`,
      width: 340,
      popOut: true,
      resizable: false
    });
  }

  async getData() {
    const state = game.settings.get(MODULE_ID, SETTING_KEY) ?? {};
    return {
      time: state.time ?? 0,
      supply: state.supply ?? 0,
      shiphp: state.shiphp ?? 0,
      locked: state.locked ?? false,
      canEdit: game.user.isGM && !(state.locked ?? false)
    };
  }

  activateListeners(html) {
    super.activateListeners(html);

    const setState = (patch) => {
      const curr = game.settings.get(MODULE_ID, SETTING_KEY) ?? {};
      return game.settings.set(
        MODULE_ID,
        SETTING_KEY,
        foundry.utils.mergeObject(curr, patch, { inplace: false })
      );
    };

    html.find("[data-action='toggle-lock']").on("click", async () => {
      if (!game.user.isGM) return ui.notifications?.warn("Only the GM can toggle lock.");
      const state = game.settings.get(MODULE_ID, SETTING_KEY) ?? {};
      await setState({ locked: !state.locked });
    });

    html.find("[data-action='inc'], [data-action='dec']").on("click", async ev => {
      const btn   = ev.currentTarget;
      const key   = btn.dataset.key;
      const delta = btn.dataset.action === "inc" ? 1 : -1;

      const state  = game.settings.get(MODULE_ID, SETTING_KEY) ?? {};
      const locked = state.locked ?? false;
      if (!game.user.isGM || locked) return;

      const next = Math.max(0, Number(state[key] ?? 0) + delta);
      await setState({ [key]: next });
    });

    html.find("input[data-key]").on("change", async ev => {
      const inp = ev.currentTarget;
      const key = inp.dataset.key;

      let val = Number(inp.value);
      if (!Number.isFinite(val)) val = 0;
      val = Math.max(0, Math.floor(val));

      const state  = game.settings.get(MODULE_ID, SETTING_KEY) ?? {};
      const locked = state.locked ?? false;
      if (!game.user.isGM || locked) { inp.value = state[key] ?? 0; return; }

      await setState({ [key]: val });
    });
  }
}

let vasTrackersApp;

/* --------------------------- INIT --------------------------- */
Hooks.once("init", () => {
  game.settings.register(MODULE_ID, SETTING_KEY, {
    scope: "world",
    config: false,
    type: Object,
    default: { time: 0, supply: 0, shiphp: 0, locked: false },
    onChange: () => vasTrackersApp?.render(false)
  });

  game.settings.registerMenu(MODULE_ID, "openPanel", {
    name: "Open VasTrackers",
    label: "Open VasTrackers",
    hint: "Open the VasTrackers panel.",
    icon: "fas fa-ship",
    restricted: false,
    type: class extends FormApplication {
      render() { vasTrackersApp?.render(true); return this; }
    }
  });
});

/* --------------------------- READY -------------------------- */
Hooks.once("ready", () => {
  vasTrackersApp = new VasTrackersApp();

  const api = {
    open : () => vasTrackersApp?.render(true),
    state: () => game.settings.get(MODULE_ID, SETTING_KEY)
  };
  const mod = game.modules.get(MODULE_ID);
  if (mod) mod.api = api;
});

/* ------------- SCENE CONTROL BUTTONS (bal oldali gomb) ------------- */
Hooks.on("getSceneControlButtons", (controls) => {
  const tokenCtl = controls.find(c => c.name === "token");
  const tool = {
    name : "vastrackers",
    title: "VasTrackers",
    icon : "fas fa-ship",
    toggle: true,
    active: false,
    onClick: (toggled) => {
      if (toggled) vasTrackersApp?.render(true);
      else vasTrackersApp?.close();
    }
  };

  if (tokenCtl) {
    tokenCtl.tools.push(tool);
    return;
  }

  controls.push({
    name : "vastrackers",
    title: "VasTrackers",
    icon : "fas fa-ship",
    tools: [{
      name : "open-vastrackers",
      title: "Open VasTrackers",
      icon : "fas fa-ship",
      onClick: () => vasTrackersApp?.render(true),
      button: true
    }]
  });
});
