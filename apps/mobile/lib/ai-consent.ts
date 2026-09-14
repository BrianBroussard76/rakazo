import { AI_DATA_DISCLOSURES, AI_PRIVACY_URL, type AiRecipient } from "@rakazo/contracts";
import { Alert, Linking } from "react-native";

export function promptAiConsent(recipient: AiRecipient): Promise<boolean> {
  return new Promise((resolve) => {
    const show = () =>
      Alert.alert(
        `Share data with ${recipient.name}?`,
        [
          recipient.detail,
          AI_DATA_DISCLOSURES[recipient.use],
          "You can withdraw permission in Account → AI data sharing.",
        ]
          .filter(Boolean)
          .join("\n\n"),
        [
          { text: "Not now", style: "cancel", onPress: () => resolve(false) },
          {
            text: "Privacy policy",
            onPress: () => {
              void Linking.openURL(AI_PRIVACY_URL).finally(show);
            },
          },
          { text: "Allow", onPress: () => resolve(true) },
        ],
        { cancelable: true, onDismiss: () => resolve(false) },
      );
    show();
  });
}
