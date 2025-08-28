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
    
    // Initialize trackers array if it doesn't exist
    if (!state.trackers) {
      // Default trackers for backward compatibility
      state.trackers = [
        {
          id: "time",
          label: "Time",
          icon: "fa-sun",
          value: state.time ?? 0
        },
        {
          id: "supply",
          label: "Supply", 
          icon: "fa-boxes",
          value: state.supply ?? 0
        },
        {
          id: "shiphp",
          label: "Ship HP",
          icon: "fa-ship",
          value: state.shiphp ?? 0
        }
      ];
      // Save the migrated structure
      await game.settings.set(MODULE_ID, SETTING_KEY, state);
    }
    
    return {
      trackers: state.trackers,
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
      
      ui.notifications?.info(newShowToPlayers ? "Tracker Window shown to players" : "Tracker Window hidden from players");
    });

    // Open options menu (GM only)
    html.find("[data-action='open-options']").on("click", async () => {
      if (!game.user.isGM) return ui.notifications?.warn("Only the GM can access options.");
      
      const state = game.settings.get(MODULE_ID, SETTING_KEY) ?? {};
      const trackers = state.trackers ?? [];
      
      // Build the HTML for each tracker
      let trackersHtml = trackers.map((tracker, index) => `
        <div class="tracker-config" data-tracker-index="${index}" style="border: 1px solid #ccc; padding: 10px; border-radius: 4px; margin-bottom: 10px; position: relative;">
          <button type="button" class="remove-tracker" data-index="${index}" style="position: absolute; right: 5px; top: 5px; width: 24px; height: 24px; border-radius: 3px; background: #dc3545; color: white; border: none; cursor: pointer;" title="Remove this tracker">
            <i class="fas fa-times"></i>
          </button>
          <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px;">
            <div>
              <label style="display: block; margin-bottom: 4px;">Label:</label>
              <input type="text" name="label_${index}" value="${tracker.label}" style="width: 100%;">
            </div>
            <div>
              <label style="display: block; margin-bottom: 4px;">Icon Class:</label>
              <input type="text" name="icon_${index}" value="${tracker.icon}" style="width: 100%;">
            </div>
            <div>
              <label style="display: block; margin-bottom: 4px;">Current Value:</label>
              <input type="number" name="value_${index}" value="${tracker.value}" style="width: 100%;">
            </div>
          </div>
        </div>
      `).join('');
      
      // Create a dialog for options
      new Dialog({
        title: "Hex Tracker Options",
        content: `
          <form style="padding: 10px;">
            <h3>Manage Trackers</h3>
            <p style="font-size: 12px; opacity: 0.8; margin-bottom: 15px;">
              Add, remove, or customize trackers. Icons use Font Awesome classes (e.g., fa-sun, fa-clock, fa-heart).
            </p>
            
            <div id="trackers-list">
              ${trackersHtml}
            </div>
            
            <div style="margin-top: 15px; display: flex; gap: 10px;">
              <button type="button" id="add-tracker" style="padding: 6px 12px; background: #28a745; color: white; border: none; border-radius: 3px; cursor: pointer;">
                <i class="fas fa-plus"></i> Add New Tracker
              </button>
              <button type="button" id="reset-defaults" style="padding: 6px 12px; background: #6c757d; color: white; border: none; border-radius: 3px; cursor: pointer;">
                <i class="fas fa-undo"></i> Reset to Defaults
              </button>
            </div>
            
            <hr style="margin: 15px 0;">
            
            <p style="font-size: 11px; opacity: 0.7; text-align: center;">Changes will be saved when you click Save</p>
          </form>
        `,
        buttons: {
          save: {
            label: "Save",
            callback: async (html) => {
              const form = html[0].querySelector("form");
              const state = game.settings.get(MODULE_ID, SETTING_KEY) ?? {};
              
              // Collect all tracker data
              const newTrackers = [];
              const trackerConfigs = form.querySelectorAll('.tracker-config');
              
              trackerConfigs.forEach((config, index) => {
                const label = form[`label_${index}`]?.value;
                const icon = form[`icon_${index}`]?.value;
                const value = parseInt(form[`value_${index}`]?.value) || 0;
                
                if (label) { // Only add if label exists
                  // Generate ID from label if new tracker
                  const id = state.trackers?.[index]?.id || label.toLowerCase().replace(/\s+/g, '_');
                  newTrackers.push({ id, label, icon, value });
                }
              });
              
              // Save the new trackers array
              await setState({ trackers: newTrackers });
              ui.notifications?.info("Tracker configuration saved!");
            }
          },
          cancel: {
            label: "Cancel",
            callback: () => {}
          }
        },
        default: "save",
        render: (html) => {
          // Add tracker functionality
          html.find("#add-tracker").on("click", () => {
            const trackersList = html.find("#trackers-list");
            const newIndex = trackersList.find('.tracker-config').length;
            
            const newTrackerHtml = `
              <div class="tracker-config" data-tracker-index="${newIndex}" style="border: 1px solid #ccc; padding: 10px; border-radius: 4px; margin-bottom: 10px; position: relative;">
                <button type="button" class="remove-tracker" data-index="${newIndex}" style="position: absolute; right: 5px; top: 5px; width: 24px; height: 24px; border-radius: 3px; background: #dc3545; color: white; border: none; cursor: pointer;" title="Remove this tracker">
                  <i class="fas fa-times"></i>
                </button>
                <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px;">
                  <div>
                    <label style="display: block; margin-bottom: 4px;">Label:</label>
                    <input type="text" name="label_${newIndex}" value="New Tracker" style="width: 100%;">
                  </div>
                  <div>
                    <label style="display: block; margin-bottom: 4px;">Icon Class:</label>
                    <input type="text" name="icon_${newIndex}" value="fa-star" style="width: 100%;">
                  </div>
                  <div>
                    <label style="display: block; margin-bottom: 4px;">Current Value:</label>
                    <input type="number" name="value_${newIndex}" value="0" style="width: 100%;">
                  </div>
                </div>
              </div>
            `;
            
            trackersList.append(newTrackerHtml);
            
            // Reattach remove handlers
            attachRemoveHandlers(html);
          });
          
          // Reset to defaults functionality
          html.find("#reset-defaults").on("click", () => {
            const defaultTrackers = `
              <div class="tracker-config" data-tracker-index="0" style="border: 1px solid #ccc; padding: 10px; border-radius: 4px; margin-bottom: 10px; position: relative;">
                <button type="button" class="remove-tracker" data-index="0" style="position: absolute; right: 5px; top: 5px; width: 24px; height: 24px; border-radius: 3px; background: #dc3545; color: white; border: none; cursor: pointer;" title="Remove this tracker">
                  <i class="fas fa-times"></i>
                </button>
                <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px;">
                  <div>
                    <label style="display: block; margin-bottom: 4px;">Label:</label>
                    <input type="text" name="label_0" value="Time" style="width: 100%;">
                  </div>
                  <div>
                    <label style="display: block; margin-bottom: 4px;">Icon Class:</label>
                    <input type="text" name="icon_0" value="fa-sun" style="width: 100%;">
                  </div>
                  <div>
                    <label style="display: block; margin-bottom: 4px;">Current Value:</label>
                    <input type="number" name="value_0" value="0" style="width: 100%;">
                  </div>
                </div>
              </div>
              <div class="tracker-config" data-tracker-index="1" style="border: 1px solid #ccc; padding: 10px; border-radius: 4px; margin-bottom: 10px; position: relative;">
                <button type="button" class="remove-tracker" data-index="1" style="position: absolute; right: 5px; top: 5px; width: 24px; height: 24px; border-radius: 3px; background: #dc3545; color: white; border: none; cursor: pointer;" title="Remove this tracker">
                  <i class="fas fa-times"></i>
                </button>
                <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px;">
                  <div>
                    <label style="display: block; margin-bottom: 4px;">Label:</label>
                    <input type="text" name="label_1" value="Supply" style="width: 100%;">
                  </div>
                  <div>
                    <label style="display: block; margin-bottom: 4px;">Icon Class:</label>
                    <input type="text" name="icon_1" value="fa-boxes" style="width: 100%;">
                  </div>
                  <div>
                    <label style="display: block; margin-bottom: 4px;">Current Value:</label>
                    <input type="number" name="value_1" value="0" style="width: 100%;">
                  </div>
                </div>
              </div>
              <div class="tracker-config" data-tracker-index="2" style="border: 1px solid #ccc; padding: 10px; border-radius: 4px; margin-bottom: 10px; position: relative;">
                <button type="button" class="remove-tracker" data-index="2" style="position: absolute; right: 5px; top: 5px; width: 24px; height: 24px; border-radius: 3px; background: #dc3545; color: white; border: none; cursor: pointer;" title="Remove this tracker">
                  <i class="fas fa-times"></i>
                </button>
                <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px;">
                  <div>
                    <label style="display: block; margin-bottom: 4px;">Label:</label>
                    <input type="text" name="label_2" value="Ship HP" style="width: 100%;">
                  </div>
                  <div>
                    <label style="display: block; margin-bottom: 4px;">Icon Class:</label>
                    <input type="text" name="icon_2" value="fa-ship" style="width: 100%;">
                  </div>
                  <div>
                    <label style="display: block; margin-bottom: 4px;">Current Value:</label>
                    <input type="number" name="value_2" value="0" style="width: 100%;">
                  </div>
                </div>
              </div>
            `;
            
            html.find("#trackers-list").html(defaultTrackers);
            attachRemoveHandlers(html);
          });
          
          // Function to attach remove handlers
          const attachRemoveHandlers = (html) => {
            html.find(".remove-tracker").off("click").on("click", (e) => {
              $(e.currentTarget).closest('.tracker-config').remove();
              
              // Reindex remaining trackers
              html.find('.tracker-config').each((index, element) => {
                $(element).attr('data-tracker-index', index);
                $(element).find('input').each((i, input) => {
                  const name = $(input).attr('name');
                  if (name) {
                    const baseName = name.split('_')[0];
                    $(input).attr('name', `${baseName}_${index}`);
                  }
                });
                $(element).find('.remove-tracker').attr('data-index', index);
              });
            });
          };
          
          // Attach handlers initially
          attachRemoveHandlers(html);
        }
      }).render(true);
    });

    // Handle increment/decrement for dynamic trackers
    html.find("[data-action='inc'], [data-action='dec']").on("click", async ev => {
      const btn = ev.currentTarget;
      const trackerIndex = parseInt(btn.dataset.index);
      const delta = btn.dataset.action === "inc" ? 1 : -1;

      const state = game.settings.get(MODULE_ID, SETTING_KEY) ?? {};
      if (!game.user.isGM || (state.locked ?? false)) return;

      const trackers = [...state.trackers];
      trackers[trackerIndex].value = Math.max(0, (trackers[trackerIndex].value || 0) + delta);
      
      await setState({ trackers });
    });

    // Handle direct input changes for dynamic trackers
    html.find("input[data-tracker-index]").on("change", async ev => {
      const inp = ev.currentTarget;
      const trackerIndex = parseInt(inp.dataset.trackerIndex);

      let val = Number(inp.value);
      if (!Number.isFinite(val)) val = 0;
      val = Math.max(0, Math.floor(val));

      const state = game.settings.get(MODULE_ID, SETTING_KEY) ?? {};
      if (!game.user.isGM || (state.locked ?? false)) { 
        inp.value = state.trackers[trackerIndex].value || 0; 
        return; 
      }

      const trackers = [...state.trackers];
      trackers[trackerIndex].value = val;
      
      await setState({ trackers });
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
    default: { 
      trackers: [
        { id: "time", label: "Time", icon: "fa-sun", value: 0 },
        { id: "supply", label: "Supply", icon: "fa-boxes", value: 0 },
        { id: "shiphp", label: "Ship HP", icon: "fa-ship", value: 0 }
      ],
      locked: false, 
      showToPlayers: false 
    },
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
    close: () => vasTrackersApp?.close(),
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