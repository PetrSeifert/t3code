import { useRef } from "react";
import { DEFAULT_SERVER_SETTINGS } from "@t3tools/contracts";

import { Textarea } from "../ui/textarea";
import { SettingsRow, SettingResetButton } from "./settingsLayout";
import { useSettingsScope } from "./SettingsScopeContext";
import { searchableSetting } from "./settingsSearch";
import {
  useScopedSettings,
  useScopedSettingsMixed,
  useUpdateScopedSettings,
} from "./useScopedSettings";

export function OrchestratorInstructionsSettings() {
  const settings = useScopedSettings();
  const { targets } = useSettingsScope();
  const scopeKey = targets.map((target) => `${target.environmentId}:${target.projectId}`).join(",");
  const edited = useRef(false);
  const updateSettings = useUpdateScopedSettings();
  const mixed = useScopedSettingsMixed(["orchestratorInstructions"]);
  const defaultInstructions = DEFAULT_SERVER_SETTINGS.orchestratorInstructions;

  return (
    <SettingsRow
      serverScoped
      settingKeys={["orchestratorInstructions"]}
      {...searchableSetting("orchestrator-instructions")}
      description="Given to a project's orchestrator thread with its role."
      resetAction={
        mixed || settings.orchestratorInstructions !== defaultInstructions ? (
          <SettingResetButton
            label="orchestrator instructions"
            onClick={() => updateSettings({ orchestratorInstructions: defaultInstructions })}
          />
        ) : null
      }
    >
      <div className="mt-3 max-w-2xl pb-3.5">
        <Textarea
          key={`${scopeKey}:${mixed}:${settings.orchestratorInstructions}`}
          aria-label="Orchestrator instructions"
          onChange={() => {
            edited.current = true;
          }}
          rows={4}
          defaultValue={mixed ? "" : settings.orchestratorInstructions}
          placeholder={
            mixed
              ? "Mixed. Enter instructions to apply to all selected targets."
              : "Delegate the work to worker threads and review what they return."
          }
          onBlur={(event) => {
            const value = event.target.value.trim();
            if (edited.current && (mixed || value !== settings.orchestratorInstructions))
              updateSettings({ orchestratorInstructions: value });
            edited.current = false;
          }}
        />
      </div>
    </SettingsRow>
  );
}
