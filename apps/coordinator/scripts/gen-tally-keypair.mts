import { generateKeypair } from "@maci-protocol/crypto";
const kp = generateKeypair();
// privateKey is a bigint, publicKey is [bigint, bigint]
console.log("PRIVATE_KEY=" + kp.privateKey.toString());
console.log("PUBLIC_KEY_X=" + kp.publicKey[0].toString());
console.log("PUBLIC_KEY_Y=" + kp.publicKey[1].toString());
console.log(
  "SERIALIZED=macipk." +
    kp.publicKey[0].toString(16).padStart(64, "0") +
    kp.publicKey[1].toString(16).padStart(64, "0"),
);
