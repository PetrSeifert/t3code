import { useCallback, useEffect, useRef, useState } from "react";
import { Modal, Pressable, View } from "react-native";

import type { SourceControlSshPasswordPromptRequest } from "@t3tools/contracts";

import { useThemeColor } from "../lib/useThemeColor";
import { AppText, AppTextInput } from "./AppText";

type PendingSshPasswordPrompt = {
  readonly request: SourceControlSshPasswordPromptRequest;
  readonly resolve: (password: string | null) => void;
};

let presentPrompt: ((prompt: PendingSshPasswordPrompt) => void) | null = null;
let cancelPrompt: (() => void) | null = null;

export function requestSshPassword(
  request: SourceControlSshPasswordPromptRequest,
): Promise<string | null> {
  return new Promise((resolve) => {
    if (presentPrompt === null) {
      resolve(null);
      return;
    }
    presentPrompt({ request, resolve });
  });
}

export function cancelSshPasswordPrompt(): void {
  cancelPrompt?.();
}

export function SshPasswordPromptHost() {
  const [prompt, setPrompt] = useState<PendingSshPasswordPrompt | null>(null);
  const [password, setPassword] = useState("");
  const promptRef = useRef<PendingSshPasswordPrompt | null>(null);
  const pressedOverlay = useThemeColor("--color-subtle");

  useEffect(() => {
    presentPrompt = (nextPrompt) => {
      promptRef.current?.resolve(null);
      promptRef.current = nextPrompt;
      setPassword("");
      setPrompt(nextPrompt);
    };
    return () => {
      presentPrompt = null;
      promptRef.current?.resolve(null);
      promptRef.current = null;
    };
  }, []);

  const finish = useCallback((value: string | null) => {
    const currentPrompt = promptRef.current;
    promptRef.current = null;
    setPrompt(null);
    setPassword("");
    currentPrompt?.resolve(value);
  }, []);

  const submit = useCallback(() => {
    if (password.length > 0) finish(password);
  }, [finish, password]);

  useEffect(() => {
    cancelPrompt = () => finish(null);
    return () => {
      cancelPrompt = null;
    };
  }, [finish]);

  return (
    <Modal
      visible={prompt !== null}
      transparent
      animationType="fade"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={() => finish(null)}
    >
      {prompt === null ? null : (
        <View className="flex-1 items-center justify-center bg-backdrop px-8">
          <View className="w-full rounded-[24px] bg-card px-6 pb-4 pt-5">
            <AppText className="text-lg font-t3-medium">SSH password required</AppText>
            <AppText className="mt-2 text-sm text-foreground-secondary">
              Enter the password for {prompt.request.username ?? "SSH"} at{" "}
              {prompt.request.destination}.
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
                  onPress={() => finish(null)}
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
