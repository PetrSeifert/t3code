import { useCallback, useEffect, useState } from "react";
import { Modal, Pressable, View } from "react-native";

import type { SourceControlSshPasswordPromptRequest } from "@t3tools/contracts";

import { useThemeColor } from "../lib/useThemeColor";
import { AppText, AppTextInput } from "./AppText";
import { sshPasswordPromptBroker } from "./sshPasswordPromptBroker";

export function SshPasswordPromptHost() {
  const [prompt, setPrompt] = useState<SourceControlSshPasswordPromptRequest | null>(null);
  const [password, setPassword] = useState("");
  const pressedOverlay = useThemeColor("--color-subtle");

  useEffect(
    () =>
      sshPasswordPromptBroker.subscribe((nextPrompt) => {
        setPassword("");
        setPrompt(nextPrompt);
      }),
    [],
  );

  const finish = useCallback((requestId: string, value: string | null) => {
    sshPasswordPromptBroker.resolveCurrent(requestId, value);
  }, []);

  const submit = useCallback(() => {
    if (prompt !== null && password.length > 0) {
      finish(prompt.requestId, password);
    }
  }, [finish, password, prompt]);

  return (
    <Modal
      visible={prompt !== null}
      transparent
      animationType="fade"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={() => {
        if (prompt !== null) {
          finish(prompt.requestId, null);
        }
      }}
    >
      {prompt === null ? null : (
        <View className="flex-1 items-center justify-center bg-backdrop px-8">
          <View className="w-full rounded-[24px] bg-card px-6 pb-4 pt-5">
            <AppText className="text-lg font-t3-medium">SSH password required</AppText>
            <AppText className="mt-2 text-sm text-foreground-secondary">
              Enter the password for {prompt.username ?? "SSH"} at {prompt.destination}.
            </AppText>
            <AppTextInput
              autoFocus
              autoCapitalize="none"
              autoCorrect={false}
              className="mt-4 rounded-xl bg-background px-4 py-3 text-base text-foreground"
              onChangeText={setPassword}
              onSubmitEditing={submit}
              placeholder="Password"
              returnKeyType="done"
              secureTextEntry
              value={password}
            />
            <View className="mt-4 flex-row justify-end gap-1">
              <View className="overflow-hidden rounded-full">
                <Pressable
                  accessibilityRole="button"
                  className="min-h-10 items-center justify-center px-4"
                  android_ripple={{ color: pressedOverlay }}
                  onPress={() => finish(prompt.requestId, null)}
                >
                  <AppText className="text-base font-t3-medium">Cancel</AppText>
                </Pressable>
              </View>
              <View className="overflow-hidden rounded-full">
                <Pressable
                  accessibilityRole="button"
                  className="min-h-10 items-center justify-center px-4"
                  disabled={password.length === 0}
                  android_ripple={{ color: pressedOverlay }}
                  onPress={submit}
                >
                  <AppText
                    className={`text-base font-t3-medium ${password.length === 0 ? "opacity-40" : ""}`}
                  >
                    Continue
                  </AppText>
                </Pressable>
              </View>
            </View>
          </View>
        </View>
      )}
    </Modal>
  );
}
