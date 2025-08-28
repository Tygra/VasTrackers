const MODULE_ID   = "vastrackers";
const SETTING_KEY = "state";

class VasTrackersApp extends Application {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: "vastrackers-app",
      title: "Hex Trackers",
      template: `modules/${MODULE_ID}/templates/panel.hbs`,
      width: "auto",
      height: "auto",
      popOut: true,
      resizable: false
    });
  }

  async getData() {
    const state = game.settings.get(MODULE_ID, SETTING_KEY) ?? {};
    console.log("[VasTrackers] getData - isGM:", game.user.isGM);
    return {
      time: state.time ?? 0,
      supply: state.supply ?? 0,
      shiphp: state.shiphp ?? 0,
      locked: state.locked ?? false,
      showToPlayers: state.showToPlayers ?? false,
      isGM: game.user.isGM,
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

    // Toggle lock
    html.find("[data-action='toggle-lock']").on("click", async () => {
      if (!game.user.isGM) return ui.notifications?.warn("Only the GM can toggle lock.");
      const state = game.settings.get(MODULE_ID, SETTING_KEY) ?? {};
      await setState({ locked: !state.locked });
    });

    // Toggle player visibility (GM only)
    html.find("[data-action='toggle-show-players']").on("click", async () => {
      if (!game.user.isGM) return ui.notifications?.warn("Only the GM can control player visibility.");
      const state = game.settings.get(MODULE_ID, SETTING_KEY) ?? {};
      const newShowToPlayers = !state.showToPlayers;
      await setState({ showToPlayers: newShowToPlayers });
      
      console.log("[VasTrackers] GM toggling player visibility to:", newShowToPlayers);
      
      ui.notifications?.info(newShowToPlayers ? "Window shown to players" : "Window hidden from players");
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
  
  // Override render to check if players should see the window
  async _render(force, options) {
    // For non-GM users, check if they should see the window
    if (!game.user.isGM) {
      const state = game.settings.get(MODULE_ID, SETTING_KEY) ?? {};
      if (!state.showToPlayers) {
        console.log("[VasTrackers] Preventing render for player - showToPlayers is false");
        return;
      }
    }
    return super._render(force, options);
  }
}

let vasTrackersApp;

Hooks.once("init", () => {
  game.settings.register(MODULE_ID, SETTING_KEY, {
    scope: "world",
    config: false,
    type: Object,
    default: { time: 0, supply: 0, shiphp: 0, locked: false, showToPlayers: false },
    onChange: () => vasTrackersApp?.render(false)
  });
  console.log("[VasTrackers] init");
});

Hooks.once("ready", () => {
  vasTrackersApp = new VasTrackersApp();
  
  // Handle player window visibility based on settings changes
  Hooks.on("updateSetting", (setting) => {
    if (setting.key === `${MODULE_ID}.${SETTING_KEY}` && !game.user.isGM) {
      console.log("[VasTrackers] Player received settings update:", setting.value);
      const state = setting.value;
      
      if (state.showToPlayers) {
        console.log("[VasTrackers] Showing window to player via settings");
        vasTrackersApp?.render(true);
      } else {
        console.log("[VasTrackers] Hiding window from player via settings");
        
        // Force close the window for players
        // Try multiple methods to ensure it closes
        if (vasTrackersApp) {
          // Method 1: Try the standard close
          try {
            if (vasTrackersApp.rendered) {
              vasTrackersApp.close();
            }
          } catch (e) {
            console.log("[VasTrackers] Standard close failed:", e);
          }
          
          // Method 2: Force close by directly manipulating the element
          try {
            const windowElement = document.getElementById('vastrackers-app');
            if (windowElement) {
              console.log("[VasTrackers] Force removing window element");
              // Trigger the close event handlers
              vasTrackersApp._onClose?.(new Event('close'));
              // Remove the element
              windowElement.remove();
              // Update the app state
              vasTrackersApp._state = Application.RENDER_STATES.CLOSED;
              vasTrackersApp._element = null;
            }
          } catch (e) {
            console.log("[VasTrackers] Force removal failed:", e);
          }
          
          // Method 3: Use jQuery to ensure removal
          try {
            $('#vastrackers-app').remove();
          } catch (e) {
            console.log("[VasTrackers] jQuery removal failed:", e);
          }
        }
      }
    }
  });

  // Auto-show for players if setting is enabled on startup
  if (!game.user.isGM) {
    const state = game.settings.get(MODULE_ID, SETTING_KEY) ?? {};
    console.log("[VasTrackers] Player startup check - showToPlayers:", state.showToPlayers);
    if (state.showToPlayers) {
      vasTrackersApp?.render(true);
    }
  }
  
  const mod = game.modules.get(MODULE_ID);
  if (mod) mod.api = {
    open : () => vasTrackersApp?.render(true),
    close: () => vasTrackersApp?.close(), // Added close to API
    state: () => game.settings.get(MODULE_ID, SETTING_KEY)
  };
  console.log("[VasTrackers] ready");
});

// Scene controls
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
    
    $html.find('#scene-controls-layers button').attr('aria-pressed', 'false');
    button.attr('aria-pressed', 'true');
    
    const toolsMenu = $html.find('#scene-controls-tools');
    
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
        console.log("[VasTrackers] VasTrackers tool clicked");
        vasTrackersApp?.render(true);
      });
      
      console.log("[VasTrackers] Added VasTrackers tool to tools menu");
    }
  });
  
  const layersMenu = $html.find('#scene-controls-layers');
  if (layersMenu.length) {
    layersMenu.append(mainButtonLi);
    console.log("[VasTrackers] Tygra's Modules button added to layers menu");
  }
});