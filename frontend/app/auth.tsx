import { router } from "expo-router";
import * as Crypto from "expo-crypto";

import { useState } from "react";
import { Anchor, Button, Card, H2, Input, Spinner, Text, View } from "tamagui";
import { Eye, EyeOff } from "@tamagui/lucide-icons";

import Page from "@/components/page";

import { request } from "@/lib/helpers";
import useStorage from "@/lib/storage";

function PasswordInput({ setPassword, placeholder }) {
  const [visible, setVisible] = useState(false);
  return (
    <View flex={1} flexDirection="row" position="relative">
      <Input
        flexGrow={1} autoCapitalize="none"
        placeholder={placeholder} secureTextEntry={!visible}
        onChangeText={(text) => setPassword(text.trim())}>
      </Input>
      <Button
        transparent
        position="absolute" right={0}
        onPress={() => setVisible(!visible)}
        icon={visible ? <EyeOff scale={1.5} /> : <Eye scale={1.5} />}
      />
    </View>
  )
}

export default function AuthPage() {
  const [_, setToken] = useStorage<string>("jwt", "");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [repeatedPassword, setRepeatedPassword] = useState("");

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const [creatingAccount, setCreatingAccount] = useState(false);

  const toggleMode = () => {
    setError("");
    setCreatingAccount(!creatingAccount);
  };

  const validateInputs = (): boolean => {
    const base = email.length > 0 && password.length > 0
    const filled = creatingAccount ? base && repeatedPassword.length > 0 : base;
    if (!filled) {
      setError("Please fill out all the fields");
      return false;
    }

    const emailValidate = /^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/;
    if (!emailValidate.test(email)) {
      setError("Please enter a valid email address");
      return false;
    }

    // Only validate email when logging in
    if (!creatingAccount) return true;

    const minPasswordLength = 8;
    if (password.length < minPasswordLength) {
      setError(`Password must be at least ${minPasswordLength} characters long`);
      return false;
    }

    const validatePassword = /^(?=.*[0-9])(?=.*[^a-zA-Z0-9]).+$/;
    if (!validatePassword.test(password)) {
      setError("Password must contain at least 1 number and 1 special character");
      return false;
    }

    if (repeatedPassword != password) {
      setError("The passwords don't match");
      return false;
    }

    return true;
  };

  const authenticate = async () => {
    if (!validateInputs()) return;
    setLoading(true);

    try {
      const digest = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        password
      );
      const payload = { email, password: digest, existing: !creatingAccount };

      const response = await request("POST", "/authenticate", payload);
      const json = await response.json();

      if (response.status == 200) {
        setToken(json["token"]);
        router.navigate("/");
      } else if (response.status == 406) {
        // signal a user error
        let msg = json["details"];
        msg = msg.charAt(0).toUpperCase() + msg.slice(1);
        setError(msg);
      } else {
        setError("Something went wrong...");
      }
    } catch (error) {
      setError("Something went wrong...");
    }

    setLoading(false);
  }

  return (
    <Page>
      <View flex={1} justifyContent="center">
        <H2 fontWeight="bold" textAlign="center">Snapcram</H2>

        <Card gap={25} padding={5}>
          {error.length > 0 && <Text color="red" textAlign="center">{error}</Text>}

          <Input
            inputMode="email" autoCapitalize="none"
            onChangeText={(text) => setEmail(text.trim())}
            placeholder="Email"
          />
          <PasswordInput setPassword={setPassword} placeholder="Password" />

          {creatingAccount &&
            <PasswordInput
              setPassword={setRepeatedPassword}
              placeholder="Repeat password"
            />
          }

          <Button themeInverse onPress={authenticate}>
            {loading
                ? <Spinner size="large" color="$white" />
                : creatingAccount ? "Create account" : "Login"
            }
          </Button>

          <Anchor textAlign="right" onPress={toggleMode}>
            {creatingAccount ?  "I already have an account" : "I don't have an account"}
          </Anchor>
        </Card>

      </View>
    </Page>
  );
}
