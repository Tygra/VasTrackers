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

    const windowElement = this.element;
    let isDragging = false;

    windowElement.on('mousedown', '.window-header', () => {
      isDragging = true;
      windowElement.addClass('dragging');
    });

    $(document).on('mouseup.vastrackers', () => {
      if (isDragging) {
        isDragging = false;
        windowElement.removeClass('dragging');
      }
    });

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
      if (!game.user.isGM || (state.locked ?? false)) return;

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
      if (!game.user.isGM || (state.locked ?? false)) { inp.value = state[key] ?? 0; return; }

      await setState({ [key]: val });
    });
  }

  close() {
    $(document).off('mouseup.vastrackers');
    return super.close();
  }
}

let vasTrackersApp;

Hooks.once("init", () => {
  game.settings.register(MODULE_ID, SETTING_KEY, {
    scope: "world",
    config: false,
    type: Object,
    default: { time: 0, supply: 0, shiphp: 0, locked: false },
    onChange: () => vasTrackersApp?.render(false)
  });
  console.log("[VasTrackers] init");
});

Hooks.once("ready", () => {
  vasTrackersApp = new VasTrackersApp();
  
  const mod = game.modules.get(MODULE_ID);
  if (mod) mod.api = {
    open : () => vasTrackersApp?.render(true),
    state: () => game.settings.get(MODULE_ID, SETTING_KEY)
  };
  console.log("[VasTrackers] ready");
});

Hooks.on("renderSceneControls", (app, html, data) => {
  console.log("[VasTrackers] Scene controls rendered");
  
  const $html = html instanceof jQuery ? html : $(html);
  
  if ($html.find('[data-tygra-modules="true"]').length) {
    console.log("[VasTrackers] Tygra's Modules button already exists");
    return;
  }
  
  console.log("[VasTrackers] Adding Tygra's Modules button");
  
  const mainButtonLi = $(`
    <li>
      <button type="button" class="control ui-control layer icon" 
              role="tab" data-action="control" data-control="tygra-modules" 
              data-tygra-modules="true" data-tooltip="" aria-pressed="false" 
              aria-label="Tygra's Modules" aria-controls="scene-controls-tools"
              title="Tygra's Modules">
        <span style="font-weight: 900; font-size: 16px; font-style: normal;">T</span>
      </button>
    </li>
  `);
  
  mainButtonLi.find('button').on("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    console.log("[VasTrackers] Main T button clicked");
    
    const button = $(e.currentTarget);
    const isPressed = button.attr('aria-pressed') === 'true';
    
    $html.find('#scene-controls-layers button').attr('aria-pressed', 'false');
    
    button.attr('aria-pressed', 'true');
    
    const toolsMenu = $html.find('#scene-controls-tools');
    console.log("[VasTrackers] Tools menu found:", toolsMenu.length);
    
    if (toolsMenu.length) {
      toolsMenu.empty();
      
      const vasTrackersToolHtml = `
        <li>
          <button type="button" class="control ui-control tool icon fa-solid fa-stopwatch" 
                  data-action="tool" data-tool="vastrackers" 
                  aria-label="VasTrackers" aria-pressed="false" 
                  title="VasTrackers">
          </button>
        </li>
      `;
      
      toolsMenu.append(vasTrackersToolHtml);
      
      toolsMenu.find('[data-tool="vastrackers"]').on('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        console.log("[VasTrackers] VasTrackers ship tool clicked");
        vasTrackersApp?.render(true);
      });
      
      console.log("[VasTrackers] Added VasTrackers tool to tools menu");
    } else {
      console.log("[VasTrackers] Could not find tools menu");
    }
  });
  
  const layersMenu = $html.find('#scene-controls-layers');
  if (layersMenu.length) {
    layersMenu.append(mainButtonLi);
    console.log("[VasTrackers] Tygra's Modules button added to layers menu");
  } else {
    console.log("[VasTrackers] Could not find layers menu");
  }
});