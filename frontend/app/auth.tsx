import { router } from "expo-router";
import * as Crypto from "expo-crypto";

import { useEffect, useState } from "react";
import { Anchor, Button, Card, H2, Input, Text, View } from "tamagui";

import Page from "./components/page";
import { request, storageSet } from "./lib/helpers";

export default function AuthPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [repeatedPassword, setRepeatedPassword] = useState("");

  const [error, setError] = useState("");
  const [buttonEnabled, setButtonEnabled] = useState(false);
  const [creatingAccount, setCreatingAccount] = useState(false);

  useEffect(() => {
    const filled = email.length > 0 && password.length > 0;
    setButtonEnabled(
      creatingAccount ? filled && repeatedPassword.length > 0 : filled
    );
  }, [email, password, repeatedPassword]);

  const validateInputs = (): boolean => {
    const emailValidate = /^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/;
    if (!emailValidate.test(email)) {
      setError("Please enter a valid email address");
      return false;
    }

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

    if (creatingAccount && repeatedPassword != password) {
      setError("The passwords don't match");
      return false;
    }

    return true;
  };

  // TODO: dedicated password input with eye to hide/show
  // TODO: force the user to authenticate if they don't have token,
  //       or their token is expired
  //       if there are network issues, then show a dedicated page for that ("no wifi :(" or something),
  //       until the network issues are resolved
  const authenticate = async () => {
    if (!validateInputs()) return;

    try {
      const digest = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        password
      );
      const payload = { email, password: digest, existing: !creatingAccount };
      console.log(payload);

      const response = await request("POST", "/authenticate", payload);
      const json = await response.json();

      if (response.status == 200) {
        console.log("success!");
        storageSet("jwt", json["token"]);
        router.navigate("/");
      } else if (response.status == 406) {
        // signal a user error
        let msg = json["details"];
        msg = msg.charAt(0).toUpperCase() + msg.slice(1);
        setError(msg);
      } else {
        setError("Something went wrong...");
        console.log("invalid request!");
      }

    } catch (error) {
      setError("Something went wrong...");
    }
  }

  return (
    <Page>
      <View flex={1} justifyContent="center">
        <H2 fontWeight="bold" textAlign="center">Snapcram</H2>

        <Card gap={25} padding={5}>
          {error.length > 0 && <Text color="red" textAlign="center">{error}</Text>}

          <Input inputMode="email" onChangeText={(text) => setEmail(text.trim())} placeholder="Email" />
          <Input onChangeText={(text) => setPassword(text.trim())} placeholder="Password" />

          {creatingAccount &&
            <Input
              onChangeText={(text) => setRepeatedPassword(text.trim())}
              placeholder="Repeat password"
            />
          }

          <Button
            themeInverse
            onPress={authenticate}
            disabled={!buttonEnabled}
            disabledStyle={{ backgroundColor: "grey" }}
          >
            {creatingAccount ? "Create account" : "Login"}
          </Button>

          <Anchor
            textAlign="right"
            onPress={() => setCreatingAccount(!creatingAccount)}
          >
            {creatingAccount ?  "I already have an account" : "I don't have an account"}
          </Anchor>
        </Card>

      </View>
    </Page>
  );
}
